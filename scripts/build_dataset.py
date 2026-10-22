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
  country       制片国家/地区（合拍片保留全部，" / " 分隔，如 "中国大陆 / 中国香港"）
  year          上映年份（release_date 前 4 位）
  duration      片长（分钟，从 "117分钟" 提取数字）
  rating        豆瓣评分
  vote_count    评价人数
  release_date  上映日期（YYYY-MM-DD）
  season_tag    档期（按上映月份映射：春季档/暑期档/秋季档/贺岁档）
  intro         剧情简介
  poster_url    豆瓣海报图片 URL（img*.doubanio.com）
  link          豆瓣条目页 URL
  genres        类型（"; " 分隔，导入时拆分进 genres / movie_genres 两张表）
"""
import argparse
import csv
import re
import sys
from collections import OrderedDict


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
    for link, (r, title, rating, votes, genres, (year, month, release_date)) in seen.items():
        # 豆瓣条目 ID：从链接 https://movie.douban.com/subject/26752088/ 提取
        m = re.search(r'/subject/(\d+)', link)
        if not m:
            continue
        subject_id = m.group(1)

        actors = [a.strip() for a in (r.get('actors') or '').split(',') if a.strip()]
        # 国家/地区在数据源里是 " / " 分隔（如 "中国大陆 / 中国香港"）。
        # 保留完整串：分地区热榜按"包含"匹配，合拍片同时计入每个地区的热门榜，
        # 这样德国/意大利/西班牙等传统电影强国也能凑够 ≥20 部组成完整榜单
        countries = [c.strip() for c in re.split(r'[/,]', (r.get('countries') or '')) if c.strip()]
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
            ('country', ' / '.join(countries) if countries else '其他'),
            ('year', year),
            ('duration', duration if duration is not None else ''),
            ('rating', rating),
            ('vote_count', votes),
            ('release_date', release_date),
            ('season_tag', month_to_season(int(month))),
            ('intro', summary),
            ('poster_url', poster),
            ('link', link),
            ('genres', ' ; '.join(genres)),
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
