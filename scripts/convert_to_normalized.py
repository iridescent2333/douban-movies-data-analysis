# -*- coding: utf-8 -*-
"""
把扁平 movies.csv 转换为规范化 4 表结构的 data.sql：
  - genres / movie_genres / movies / movie_financials
H2 兼容语法，与 Spring Boot 启动时 JPA ddl-auto: update 配套使用。

用法: python convert_to_normalized.py
输出: backend/src/main/resources/data/data.sql
"""
import csv
import os
from collections import OrderedDict

ROOT = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(ROOT, "movies.csv")
OUT_PATH = os.path.join(ROOT, "..", "backend", "src", "main", "resources", "data", "data.sql")


def esc(s):
    """转义单引号 + 截断 NULL/过长"""
    if s is None:
        return "NULL"
    s = str(s).strip()
    if s == "" or s.lower() == "null":
        return "NULL"
    # H2 中单引号用两个转义
    s = s.replace("'", "''")
    return f"'{s}'"


def main():
    # 读 CSV
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # ---- 1. 收集所有唯一 genre ----
    genre_order = OrderedDict()
    for r in rows:
        for g in str(r.get("genres", "")).split(";"):
            g = g.strip()
            if g and g not in genre_order:
                genre_order[g] = len(genre_order) + 1  # 从 1 开始自增

    # ---- 2. 写 SQL ----
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as out:
        out.write("-- ======================================================\n")
        out.write("-- 豆瓣电影数据看板 - H2 规范化 4 表初始化脚本\n")
        out.write("-- 由 scripts/convert_to_normalized.py 从 movies.csv 生成\n")
        out.write(f"-- 电影 {len(rows)} 条，类型 {len(genre_order)} 种\n")
        out.write("-- ======================================================\n\n")

        # --- genres ---
        out.write("-- ----------  genres  ----------\n")
        for name, gid in genre_order.items():
            out.write(f"MERGE INTO genres (id, name) VALUES ({gid}, {esc(name)});\n")
        out.write("\n")

        # --- movies ---
        out.write("-- ----------  movies  ----------\n")
        for r in rows:
            out.write(
                "MERGE INTO movies (id, title, director, lead_actor, country, year, "
                "duration, rating, vote_count, intro) VALUES ("
                f"{r['id']}, {esc(r['title'])}, {esc(r['director'])}, {esc(r['actors'])}, "
                f"{esc(r['country'])}, {r['year'] or 'NULL'}, {r['runtime'] or 'NULL'}, "
                f"{r['rating'] or 'NULL'}, {r['votes'] or 'NULL'}, {esc(r['synopsis'])}"
                ");\n"
            )
        out.write("\n")

        # --- movie_genres ---
        out.write("-- ----------  movie_genres  ----------\n")
        for r in rows:
            mid = r["id"]
            for g in str(r.get("genres", "")).split(";"):
                g = g.strip()
                if g:
                    gid = genre_order.get(g)
                    if gid:
                        out.write(
                            f"MERGE INTO movie_genres (movie_id, genre_id) VALUES ({mid}, {gid});\n"
                        )
        out.write("\n")

        # --- movie_financials （仅写入有预算或票房数据的）---
        out.write("-- ----------  movie_financials  ----------\n")
        for r in rows:
            budget = r.get("budget", "").strip()
            box = r.get("box_office", "").strip()
            release = r.get("release_date", "").strip()
            slot = r.get("slot", "").strip()
            # 有任一财务字段才写入
            if budget or box or release:
                # 预算和票房原始值保留（单位不影响 demo 展示，字段名已标注 wan）
                b_sql = f"CAST({budget} AS DECIMAL(12,2))" if budget else "NULL"
                x_sql = f"CAST({box} AS DECIMAL(12,2))" if box else "NULL"
                r_sql = f"DATE '{release}'" if release else "NULL"
                out.write(
                    "MERGE INTO movie_financials (movie_id, budget_wan, box_office_wan, "
                    "release_date, season_tag) VALUES ("
                    f"{r['id']}, {b_sql}, {x_sql}, {r_sql}, {esc(slot)}"
                    ");\n"
                )
        out.write("\n")

    # ---- 3. 打印摘要 ----
    genres_with_fin = sum(1 for r in rows if (r.get("budget") or r.get("box_office")))
    print(f"[OK] 已生成: {OUT_PATH}")
    print(f"     电影数  : {len(rows)}")
    print(f"     类型数  : {len(genre_order)} -> {list(genre_order.keys())}")
    print(f"     财务数  : {genres_with_fin}")


if __name__ == "__main__":
    main()
