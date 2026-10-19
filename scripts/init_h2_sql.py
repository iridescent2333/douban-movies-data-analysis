"""
H2 数据库初始化 SQL 生成器

读取 generate_data.py 产出的 scripts/movies.csv，
输出 backend/src/main/resources/data/data.sql
（H2 兼容的 INSERT 语句 + 可选 CREATE TABLE）

运行方式：python init_h2_sql.py
依赖：pandas（可选，没装也能跑）
"""

import os
import sys
import csv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
CSV_PATH = os.path.join(SCRIPT_DIR, "movies.csv")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "backend", "src", "main", "resources", "data")
OUTPUT_SQL = os.path.join(OUTPUT_DIR, "data.sql")
OUTPUT_CSV = os.path.join(OUTPUT_DIR, "movies.csv")


# ============================================================
#  H2 建表语句（作为 data.sql 头部）
# ============================================================
SCHEMA_SQL = """-- =====================================================
-- 豆瓣电影数据看板 - H2 初始化脚本
-- 生成时间: {timestamp}
-- 说明: H2 data.sql 会在 DDL 之后自动执行
-- =====================================================

DROP TABLE IF EXISTS movies;

CREATE TABLE movies (
    id              BIGINT       NOT NULL PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    director        VARCHAR(500),
    actors          VARCHAR(1000),
    genres          VARCHAR(500),
    country         VARCHAR(100),
    year            INT,
    runtime         INT,
    rating          DECIMAL(3,1),
    votes           BIGINT,
    synopsis        VARCHAR(2000),
    budget          DECIMAL(15,2),
    box_office      DECIMAL(15,2),
    release_date    DATE,
    slot            VARCHAR(50)
);

"""


# ============================================================
#  SQL 转义
# ============================================================

def sql_escape(val):
    """SQL 字符串转义：' -> ''，同时过滤 NUL"""
    if val is None:
        return "NULL"
    s = str(val)
    s = s.replace("\\", "\\\\").replace("'", "''").replace("\x00", "")
    return f"'{s}'"


def sql_date(val):
    """日期字符串 -> H2 DATE，空值 -> NULL"""
    if not val or val.strip() == "":
        return "NULL"
    # 期望 'YYYY-MM-DD'，H2 可以直接用 DATE 'YYYY-MM-DD' 或字符串自动转换
    return f"DATE '{val.strip()}'"


def sql_decimal(val):
    """DECIMAL 值，空 -> NULL"""
    if not val or val.strip() == "":
        return "NULL"
    try:
        f = float(val)
        if f <= 0:
            return "NULL"
        # H2 的 DECIMAL 直接写数字即可
        return f"{f:.2f}"
    except ValueError:
        return "NULL"


def sql_int(val):
    if not val or val.strip() == "":
        return "NULL"
    try:
        return str(int(float(val)))
    except ValueError:
        return "NULL"


def sql_bigint(val):
    return sql_int(val)


# ============================================================
#  读取 CSV
# ============================================================

def read_movies_csv(path):
    """优先 pandas，fallback 到标准 csv 模块。"""
    try:
        import pandas as pd
        print("[INFO] 使用 pandas 读取 CSV")
        df = pd.read_csv(path, encoding="utf-8-sig", dtype=str, keep_default_na=False)
        return df.to_dict("records")
    except ImportError:
        print("[INFO] pandas 未安装，使用标准 csv 模块")
    except Exception as e:
        print(f"[WARN] pandas 读取失败: {e}，回退到 csv")

    rows = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return rows


# ============================================================
#  生成 INSERT
# ============================================================

def row_to_insert(row):
    cols = [
        "id", "title", "director", "actors", "genres", "country",
        "year", "runtime", "rating", "votes", "synopsis",
        "budget", "box_office", "release_date", "slot",
    ]

    values = []
    for c in cols:
        v = row.get(c, "")
        if c == "id":
            values.append(sql_bigint(v))
        elif c == "year" or c == "runtime":
            values.append(sql_int(v))
        elif c == "rating":
            if v:
                try:
                    values.append(f"{float(v):.1f}")
                except ValueError:
                    values.append("NULL")
            else:
                values.append("NULL")
        elif c == "votes":
            values.append(sql_bigint(v))
        elif c in ("budget", "box_office"):
            values.append(sql_decimal(v))
        elif c == "release_date":
            values.append(sql_date(v))
        else:
            values.append(sql_escape(v))

    col_list = ", ".join(cols)
    val_list = ", ".join(values)
    return f"INSERT INTO movies ({col_list}) VALUES ({val_list});"


# ============================================================
#  入口
# ============================================================

def main():
    print("=" * 60)
    print("  H2 SQL 初始化生成器")
    print("=" * 60)

    # 1. 检查 CSV
    if not os.path.exists(CSV_PATH):
        print(f"[ERROR] 找不到 {CSV_PATH}，请先运行 python generate_data.py")
        return 1

    # 2. 读 CSV
    rows = read_movies_csv(CSV_PATH)
    print(f"[INFO] 读取到 {len(rows)} 行数据")

    # 3. 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 4. 写 data.sql
    from datetime import datetime as dt
    header = SCHEMA_SQL.format(timestamp=dt.now().strftime("%Y-%m-%d %H:%M:%S"))

    inserts = []
    for row in rows:
        try:
            inserts.append(row_to_insert(row))
        except Exception as e:
            print(f"[WARN] 跳过一行（id={row.get('id')}）: {e}")

    # 每 50 条加一个 commit 注释块（H2 也可以分 batch）
    with open(OUTPUT_SQL, "w", encoding="utf-8") as f:
        f.write(header)
        f.write(f"-- 共 {len(inserts)} 条 INSERT\n")
        f.write("-- 字段: id, title, director, actors, genres, country,\n")
        f.write("--        year, runtime, rating, votes, synopsis,\n")
        f.write("--        budget, box_office, release_date, slot\n\n")

        batch_size = 50
        for i in range(0, len(inserts), batch_size):
            f.write(f"-- batch {i // batch_size + 1}: rows {i + 1}-{min(i + batch_size, len(inserts))}\n")
            f.write("\n".join(inserts[i:i + batch_size]))
            f.write("\n\n")

    print(f"[OK] SQL 已写入: {OUTPUT_SQL}  ({len(inserts)} 条 INSERT)")

    # 5. 同时复制一份 CSV 到 resources/data/ 备用
    import shutil
    shutil.copy2(CSV_PATH, OUTPUT_CSV)
    print(f"[OK] CSV 已复制: {OUTPUT_CSV}")

    # 6. 简单预览前 3 条 SQL
    print("\n--- INSERT 预览（前 3 条）---")
    for line in inserts[:3]:
        # 截断过长的 synopsis
        if len(line) > 260:
            line = line[:260] + "..."
        print(" ", line)

    print(f"\n[OK] 全部完成 ✅  请在 backend/src/main/resources/ 配置 spring.datasource.data=classpath:data/data.sql")
    return 0


if __name__ == "__main__":
    sys.exit(main())
