# -*- coding: utf-8 -*-
"""
import_douban_data.py —— Kaggle 豆瓣电影数据集 → MySQL 导入脚本生成器

背景（课程硬性要求）：
  项目数据必须来自 Kaggle 公开豆瓣电影数据集（不自己写爬虫访问豆瓣网站，遵守 robots 协议），
  csv 必须导入 MySQL，后端只能从数据库查询，禁止读取静态 csv。

数据集来源（Kaggle 公开数据集）：
  https://www.kaggle.com/datasets/dengfuping/douban-movies-dataset
  文件：douban_all_movies.csv（约 2065 部真实豆瓣电影，含海报 URL）
  该数据集由 dengfuping 的豆瓣爬虫项目整理发布（CC0 公共领域），
  我们只使用其导出的 csv，不在项目里写爬虫。

用法：
  1. 从 Kaggle 下载 douban_all_movies.csv，放到本脚本同级目录（或任意路径后用参数指定）
  2. python scripts/import_douban_data.py [csv路径]
  3. 生成两个文件：
       docs/schema.sql       建表脚本（3 张表：movies / genres / movie_genres）
       docs/douban-data.sql  数据脚本（INSERT 语句，含 poster_url 海报字段）
  4. 在 MySQL Workbench 里依次执行 schema.sql、douban-data.sql 完成导入
     （或命令行：mysql -uroot -p movie_dashboard < docs/douban-data.sql）

清洗规则：
  - movie_id      → movies.id
  - title         → movies.title
  - directors     → movies.director（豆瓣该字段本身只含第一位导演）
  - actors        → movies.lead_actor（最多 5 位，统一用 "; " 分隔）
  - countries     → movies.country（取第一个制片国家/地区）
  - release_date  → movies.release_year + movies.release_date（日期解析失败只保留年份）
  - runtime       → movies.duration（"117分钟" → 117）
  - rating        → movies.rating
  - total_ratings → movies.vote_count（评价人数）
  - summary       → movies.intro（故事梗概）
  - poster        → movies.poster_url（真实豆瓣海报链接，img*.doubanio.com）
  - genres        → 拆分写入 genres 字典表 + movie_genres 关联表（多对多，满足第三范式）
"""
import csv
import os
import re
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CSV = os.path.join(HERE, 'douban_all_movies.csv')
SCHEMA_OUT = os.path.join(HERE, '..', 'docs', 'schema.sql')
DATA_OUT = os.path.join(HERE, '..', 'docs', 'douban-data.sql')

KAGGLE_URL = 'https://www.kaggle.com/datasets/dengfuping/douban-movies-dataset'


def sql_str(value):
    """转义为 SQL 字符串字面量；None/空 → NULL"""
    if value is None:
        return 'NULL'
    s = str(value).strip()
    if not s:
        return 'NULL'
    s = s.replace('\\', '\\\\').replace("'", "''")
    # 去掉会破坏 SQL 语句的控制字符
    s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', s)
    return "'" + s + "'"


def parse_year(release_date):
    m = re.match(r'(\d{4})', (release_date or '').strip())
    return int(m.group(1)) if m else None


def parse_date(release_date):
    """'2018-07-05' → '2018-07-05'；无法解析返回 None"""
    s = (release_date or '').strip()
    if re.match(r'^\d{4}-\d{2}-\d{2}$', s):
        try:
            datetime.strptime(s, '%Y-%m-%d')
            return s
        except ValueError:
            return None
    return None


def parse_duration(runtime):
    m = re.search(r'(\d+)', runtime or '')
    return int(m.group(1)) if m else None


def split_list(text, sep=','):
    """按分隔符拆分并去空白去空项，保持顺序去重"""
    out = []
    for part in (text or '').split(sep):
        p = part.strip()
        if p and p not in out:
            out.append(p)
    return out


def load_movies(csv_path):
    movies = []
    genre_names = []
    with open(csv_path, encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f):
            title = (row.get('title') or '').strip()
            rating_raw = (row.get('rating') or '').strip()
            if not title or not rating_raw:
                continue                      # 缺标题或评分的记录没有分析价值，丢弃
            try:
                rating = float(rating_raw)
            except ValueError:
                continue
            try:
                votes = int((row.get('total_ratings') or '0').strip() or 0)
            except ValueError:
                votes = 0

            # 主演：最多保留 5 位，统一 "; " 分隔（CSV 里是 "a, b, c"）
            actors = split_list(row.get('actors'), ',')[:5]
            # 制片国家：取第一个（"中国大陆 / 中国香港" → "中国大陆"）
            countries = split_list(row.get('countries'), '/')
            # 类型：多对多拆分
            genres = split_list(row.get('genres'), ',')
            for g in genres:
                if g not in genre_names:
                    genre_names.append(g)

            movies.append({
                'id': int(row['movie_id']),
                'title': title,
                'director': (row.get('directors') or '').strip() or None,
                'lead_actor': '; '.join(actors) if actors else None,
                'country': countries[0] if countries else None,
                'release_year': parse_year(row.get('release_date')),
                'release_date': parse_date(row.get('release_date')),
                'duration': parse_duration(row.get('runtime')),
                'rating': rating,
                'vote_count': votes,
                'intro': (row.get('summary') or '').strip() or None,
                'poster_url': (row.get('poster') or '').strip() or None,
                'genres': genres,
            })
    genre_names.sort()
    return movies, genre_names


def write_schema(path):
    sql = '''-- ============================================================
-- 豆瓣电影数据洞察看板 —— 建表脚本
-- 数据来源：Kaggle 公开豆瓣电影数据集（%s）
-- 在 MySQL Workbench 中先执行本脚本，再执行 douban-data.sql 导入数据
-- ============================================================
DROP DATABASE IF EXISTS movie_dashboard;
CREATE DATABASE movie_dashboard
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE movie_dashboard;

-- 电影主表（poster_url 为真实豆瓣海报链接，供前端展示封面）
CREATE TABLE movies (
  id           BIGINT       PRIMARY KEY COMMENT '豆瓣电影 ID',
  title        VARCHAR(200) NOT NULL COMMENT '电影标题',
  director     VARCHAR(100) NULL COMMENT '导演',
  lead_actor   VARCHAR(300) NULL COMMENT '主演（多位用 ; 分隔）',
  country      VARCHAR(50)  NULL COMMENT '制片国家/地区',
  release_year INT          NULL COMMENT '上映年份',
  release_date DATE         NULL COMMENT '上映日期',
  duration     INT          NULL COMMENT '片长（分钟）',
  rating       DECIMAL(3,1) NULL COMMENT '豆瓣评分',
  vote_count   INT          NULL COMMENT '评价人数',
  intro        TEXT         NULL COMMENT '故事梗概',
  poster_url   VARCHAR(500) NULL COMMENT '海报封面图片 URL',
  INDEX idx_year (release_year),
  INDEX idx_rating (rating),
  INDEX idx_country (country),
  INDEX idx_votes (vote_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='电影主表';

-- 类型字典表（多对多拆分，满足第三范式）
CREATE TABLE genres (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE COMMENT '类型中文名'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='类型字典表';

-- 电影-类型关联表
CREATE TABLE movie_genres (
  movie_id BIGINT NOT NULL,
  genre_id INT    NOT NULL,
  PRIMARY KEY (movie_id, genre_id),
  INDEX idx_genre (genre_id),
  CONSTRAINT fk_mg_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  CONSTRAINT fk_mg_genre FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='电影-类型关联表';
''' % KAGGLE_URL
    with open(path, 'w', encoding='utf-8') as f:
        f.write(sql)


def write_data(path, movies, genre_names):
    genre_id = {name: i + 1 for i, name in enumerate(genre_names)}
    lines = []
    lines.append('-- ============================================================')
    lines.append('-- 豆瓣电影数据（%d 部）—— 由 scripts/import_douban_data.py 生成' % len(movies))
    lines.append('-- 数据来源：Kaggle 公开豆瓣电影数据集 %s' % KAGGLE_URL)
    lines.append('-- 执行前请先运行 schema.sql 建表')
    lines.append('-- ============================================================')
    lines.append('USE movie_dashboard;')
    lines.append('SET NAMES utf8mb4;')
    lines.append('')

    # 1. 类型字典
    lines.append('-- 类型字典（%d 种）' % len(genre_names))
    values = ['(%d, %s)' % (i + 1, sql_str(name)) for i, name in enumerate(genre_names)]
    for i in range(0, len(values), 20):
        lines.append('INSERT INTO genres (id, name) VALUES ' + ',\n  '.join(values[i:i + 20]) + ';')
    lines.append('')

    # 2. 电影主表
    lines.append('-- 电影主表（%d 部，每批 50 条）' % len(movies))
    cols = ('id', 'title', 'director', 'lead_actor', 'country', 'release_year',
            'release_date', 'duration', 'rating', 'vote_count', 'intro', 'poster_url')
    batch = []
    for m in movies:
        vals = [
            str(m['id']),
            sql_str(m['title']),
            sql_str(m['director']),
            sql_str(m['lead_actor']),
            sql_str(m['country']),
            str(m['release_year']) if m['release_year'] else 'NULL',
            sql_str(m['release_date']),
            str(m['duration']) if m['duration'] else 'NULL',
            ('%.1f' % m['rating']),
            str(m['vote_count']),
            sql_str(m['intro']),
            sql_str(m['poster_url']),
        ]
        batch.append('(' + ', '.join(vals) + ')')
        if len(batch) >= 50:
            lines.append('INSERT INTO movies (%s) VALUES\n  %s;' % (', '.join(cols), ',\n  '.join(batch)))
            batch = []
    if batch:
        lines.append('INSERT INTO movies (%s) VALUES\n  %s;' % (', '.join(cols), ',\n  '.join(batch)))
    lines.append('')

    # 3. 电影-类型关联
    lines.append('-- 电影-类型关联（%d 条，每批 100 条）' % sum(len(m['genres']) for m in movies))
    links = []
    for m in movies:
        for g in m['genres']:
            links.append('(%d, %d)' % (m['id'], genre_id[g]))
    for i in range(0, len(links), 100):
        lines.append('INSERT INTO movie_genres (movie_id, genre_id) VALUES ' + ', '.join(links[i:i + 100]) + ';')

    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    if not os.path.exists(csv_path):
        print('未找到数据文件: %s' % csv_path)
        print('请从 Kaggle 下载公开豆瓣电影数据集：%s' % KAGGLE_URL)
        print('下载 douban_all_movies.csv 后放到 scripts/ 目录，或作为参数传入路径。')
        sys.exit(1)

    movies, genre_names = load_movies(csv_path)
    if len(movies) < 500:
        print('记录数不足 500（当前 %d），请检查数据文件' % len(movies))
        sys.exit(1)

    write_schema(os.path.abspath(SCHEMA_OUT))
    write_data(os.path.abspath(DATA_OUT), movies, genre_names)

    no_poster = sum(1 for m in movies if not m['poster_url'])
    no_year = sum(1 for m in movies if not m['release_year'])
    print('清洗完成：')
    print('  电影记录   : %d 部（要求 ≥500）' % len(movies))
    print('  类型       : %d 种' % len(genre_names))
    print('  电影-类型关联: %d 条' % sum(len(m['genres']) for m in movies))
    print('  无海报 URL : %d 部' % no_poster)
    print('  无上映年份 : %d 部' % no_year)
    years = [m['release_year'] for m in movies if m['release_year']]
    print('  年份范围   : %d - %d' % (min(years), max(years)))
    ratings = [m['rating'] for m in movies]
    print('  评分范围   : %.1f - %.1f' % (min(ratings), max(ratings)))
    print('  生成文件   : docs/schema.sql, docs/douban-data.sql')


if __name__ == '__main__':
    main()
