# -*- coding: utf-8 -*-
"""
build_dataset.py —— 把 Kaggle「Douban Movies Dataset」真实豆瓣数据
转换为本项目数据库所需的 movies.csv（DataInitializer 启动时自动导入 MySQL）。

数据来源（公开数据集，非自行爬取，遵守 robots 协议）：
  Kaggle: https://www.kaggle.com/datasets/dengfuping/douban-movies-dataset （CC0 公有领域）
  GitHub: https://github.com/dengfuping/douban-movies-spider （data/douban_all_movies.csv）

用法：
  python3 scripts/build_dataset.py \
      --input data-source/douban_all_movies.csv \
      --output backend/src/main/resources/data/movies.csv

输出 CSV 列（与 backend schema.sql 的 movies 表对应）：
  id            豆瓣真实 subject id（如 26752088），作为主键，保证数据可溯源
  title         片名
  director      导演（数据源仅保留第一位）
  lead_actor    主演（最多 5 位，"; " 分隔）
  country       制片国家/地区（归并后的「主地区」，仅取 10 个核心地区之一，如 "美国"）
  year          上映年份（release_date 前 4 位）
  duration      片长（分钟，从 "117分钟" 提取数字）
  rating        豆瓣评分
  vote_count    评价人数
  release_date  上映日期（YYYY-MM-DD）
  season_tag    档期（按上映月份映射：春季档/暑期档/秋季档/贺岁档）
  intro         剧情简介
  poster_url    豆瓣海报图片 URL（img*.doubanio.com）
  link          豆瓣条目页 URL
  genres        类型（归并后的单一「主类型」，仅取 12 个核心类型之一，如 "剧情"）
"""
import argparse
import csv
import re
import sys
from collections import OrderedDict

# ============================================================================
# 核心类型 / 核心地区字典（课程要求：全站统一口径，避免选项爆炸）
# ----------------------------------------------------------------------------
# 类型仅保留 12 个典型类型；地区仅保留 10 个核心电影产出国家/地区。
# 数据库里每部电影按「主类型 / 主地区」归类（合拍片取第一个命中的核心项），
# 小众类型 / 细碎多国组合标签全部剔除，保证课堂演示时每个筛选/榜单选项都有足够数据。
# ============================================================================

# 12 个核心电影类型（展示顺序即此顺序）
CORE_GENRES = [
    '剧情', '爱情', '喜剧', '恐怖', '悬疑', '战争',
    '历史', '纪录片', '动作', '动画', '奇幻', '科幻',
]

# 10 个核心电影产出国家/地区（展示顺序即此顺序）
CORE_REGIONS = [
    '中国大陆', '中国台湾', '中国香港', '美国', '日本',
    '韩国', '英国', '法国', '德国', '俄罗斯',
]

# 原始类型 → 核心类型 映射（合拍片拆分后只保留核心类型）
# 未在表中的原始类型会回退到「剧情」（绝大多数未在表中的类型本质即剧情向）
GENRE_MAP = {
    '剧情': '剧情', '爱情': '爱情', '喜剧': '喜剧', '恐怖': '恐怖', '悬疑': '悬疑',
    '战争': '战争', '历史': '历史', '纪录片': '纪录片', '动作': '动作', '动画': '动画',
    '奇幻': '奇幻', '科幻': '科幻',
    '犯罪': '剧情', '惊悚': '悬疑', '古装': '历史', '家庭': '剧情', '传记': '剧情',
    '武侠': '动作', '同性': '剧情', '音乐': '剧情', '歌舞': '喜剧', '运动': '剧情',
    '灾难': '动作', '儿童': '动画', '西部': '动作', '情色': '剧情', '短片': '剧情',
    # 其它长尾（短片/戏曲/情色等）一律归剧情，保证全部落入 12 个核心类型
}

# 主类型优先级：数值越大越「具体」，越优先作为影片主类型。
# 这样「剧情 ; 战争」会归为战争、「剧情 ; 爱情」归为爱情，避免战争/历史/爱情等
# 经常作为次要标签的类型被剧情「吞掉」而计数归零。剧情最泛，优先级最低。
GENRE_PRIORITY = {
    '纪录片': 12, '科幻': 11, '奇幻': 10, '动画': 9, '恐怖': 8, '战争': 7,
    '历史': 6, '悬疑': 5, '动作': 4, '喜剧': 3, '爱情': 2, '剧情': 1,
}


def main_core_genre(raw_genres):
    """取主类型：在能映射到核心类型的原始类型中，选优先级最高（最具体）的一个；
    都没有则回退剧情。"""
    best = None
    best_pri = -1
    for g in raw_genres:
        core = GENRE_MAP.get(g.strip())
        if not core:
            continue
        pri = GENRE_PRIORITY.get(core, 0)
        if pri > best_pri:
            best = core
            best_pri = pri
    return best or '剧情'


def main_core_region(raw_countries):
    """取主地区：按原始国家出现顺序，选第一个属于 10 核心地区的；都没有则保留原始主产地。"""
    for c in raw_countries:
        c = c.strip()
        if c in CORE_REGIONS:
            return c
    return raw_countries[0].strip() if raw_countries else '其他'


def month_to_season(month: int) -> str:
    """按中国大陆电影市场主流口径把上映月份映射到档期。"""
    if 3 <= month <= 5:
        return '春季档'
    if 6 <= month <= 8:
        return '暑期档'
    if 9 <= month <= 11:
        return '秋季档'
    return '贺岁档'          # 12、1、2 月（跨年 + 春节）


def parse_runtime(text: str):
    """'117分钟' -> 117；'117分钟(导演剪辑版)' -> 117；无法解析返回 None。"""
    if not text:
        return None
    m = re.search(r'(\d{2,3})\s*分钟', text)
    return int(m.group(1)) if m else None


def parse_release_date(text: str):
    """'2018-07-05' -> ('2018', '07', '2018-07-05')；兼容 1994/1995-01-01 等写法。"""
    if not text:
        return None
    m = re.match(r'^(\d{4})[-/]?(\d{2})?[-/]?(\d{2})?', text.strip())
    if not m:
        return None
    year = m.group(1)
    month = m.group(2) or '01'
    day = m.group(3) or '01'
    try:
        if not (1900 <= int(year) <= 2026):
            return None
        if not (1 <= int(month) <= 12):
            return None
    except ValueError:
        return None
    return year, month, f'{year}-{month}-{day}'


def clean_text(text: str) -> str:
    """去掉多余空白与 Excel 常见的非法控制字符。"""
    if not text:
        return ''
    return re.sub(r'\s+', ' ', text).strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True, help='Kaggle 原始 douban_all_movies.csv 路径')
    ap.add_argument('--output', required=True, help='输出 movies.csv 路径')
    args = ap.parse_args()

    with open(args.input, encoding='utf-8-sig') as f:   # utf-8-sig 处理 BOM
        rows = list(csv.DictReader(f))
    print(f'原始数据：{len(rows)} 条')

    seen = OrderedDict()          # link -> row，按出现顺序去重
    skipped = {'no_link': 0, 'bad_date': 0, 'no_genres': 0, 'dupe': 0}
    for r in rows:
        link = (r.get('link') or '').strip()
        if not link:
            skipped['no_link'] += 1
            continue
        title = clean_text(r.get('title'))
        rating = clean_text(r.get('rating'))
        votes = clean_text(r.get('total_ratings'))
        genres = [g.strip() for g in (r.get('genres') or '').split(',') if g.strip()]
        # 核心字段缺失或无类型 → 跳过（图表和榜单都依赖这些字段）
        if not title or not rating or not votes or not genres:
            skipped['no_genres'] += 1
            continue
        date = parse_release_date(r.get('release_date'))
        if date is None:
            skipped['bad_date'] += 1
            continue
        if link in seen:
            skipped['dupe'] += 1
            continue
        seen[link] = (r, title, rating, votes, genres, date)

    out_rows = []
    unmapped = 0
    for link, (r, title, rating, votes, genres, (year, month, release_date)) in seen.items():
        # 豆瓣条目 ID：从链接 https://movie.douban.com/subject/26752088/ 提取
        m = re.search(r'/subject/(\d+)', link)
        if not m:
            continue
        subject_id = m.group(1)

        actors = [a.strip() for a in (r.get('actors') or '').split(',') if a.strip()]
        # 国家/地区在数据源里是 " / " 分隔（如 "中国大陆 / 中国香港"）。
        # 按课程要求归并为单一主地区：取第一个命中的 10 个核心地区；
        # 纯非核心产地（如意大利）保留原始主产地，不进入 10 个筛选/榜单选项但仍在库。
        countries = [c.strip() for c in re.split(r'[/,]', (r.get('countries') or '')) if c.strip()]
        main_country = main_core_region(countries)

        # 类型归并为单一主类型：取第一个能映射到 12 个核心类型的原始类型；
        # 多类型合拍片拆分后只保留这一个核心「主类型」，剔除全部小众类型。
        main_genre = main_core_genre(genres)
        if main_genre not in CORE_GENRES:
            unmapped += 1
            main_genre = '剧情'

        duration = parse_runtime(r.get('runtime'))
        summary = clean_text(r.get('summary'))
        poster = clean_text(r.get('poster'))
        if not poster.startswith('http'):
            poster = ''

        out_rows.append(OrderedDict([
            ('id', subject_id),
            ('title', title),
            ('director', clean_text(r.get('directors')) or '未知'),
            ('lead_actor', ' ; '.join(actors)),
            ('country', main_country),
            ('year', year),
            ('duration', duration if duration is not None else ''),
            ('rating', rating),
            ('vote_count', votes),
            ('release_date', release_date),
            ('season_tag', month_to_season(int(month))),
            ('intro', summary),
            ('poster_url', poster),
            ('link', link),
            ('genres', main_genre),
        ]))

    # 按评价人数降序输出（可读性好，TOP 排行直接就是文件头部）
    out_rows.sort(key=lambda x: int(x['vote_count']), reverse=True)

    with open(args.output, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        writer.writeheader()
        writer.writerows(out_rows)

    print(f'清洗后有效数据：{len(out_rows)} 条 -> {args.output}')
    print(f'跳过：{skipped}')
    years = [int(r['year']) for r in out_rows]
    print(f'年份跨度：{min(years)}-{max(years)}；'
          f'有海报：{sum(1 for r in out_rows if r["poster_url"])} 条')
    return 0


if __name__ == '__main__':
    sys.exit(main())
