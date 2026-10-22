-- =============================================================
-- 豆瓣电影数据看板 - 建表脚本（MySQL 8.0）
--
-- 注意：正常情况下不需要手动执行本脚本——
--   Hibernate ddl-auto: update 会在启动时自动建表，
--   DataInitializer 检测到 movies 表为空时自动导入
--   classpath:data/movies.csv（Kaggle 真实豆瓣数据集，2050 条）。
-- 本脚本的用途：
--   1) 课程要求提交"完整建表 SQL 脚本"；
--   2) 手动建库/换库时直接执行（与 Entity 字段一一对应）。
--
-- 数据导入说明见 docs/数据说明.md 第 2 节。
-- =============================================================

CREATE DATABASE IF NOT EXISTS movie_dashboard
    DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE movie_dashboard;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS movie_genres;
DROP TABLE IF EXISTS genres;
DROP TABLE IF EXISTS movies;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. 类型字典表
CREATE TABLE genres (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 2. 电影主表（主键 = 豆瓣真实 subject id，可溯源）
CREATE TABLE movies (
    id           BIGINT       PRIMARY KEY,              -- 豆瓣 subject id，如 1292052（肖申克的救赎）
    title        VARCHAR(200) NOT NULL,
    director     VARCHAR(100),
    lead_actor   VARCHAR(500),                          -- 主演最多 5 位，"; " 分隔
    country      VARCHAR(100),                          -- 制片国家/地区（取第一个）
    release_year INT,                                   -- 上映年份（year 是保留字，避免使用）
    release_date DATE,                                  -- 上映日期（可精确到日，用于档期统计）
    season_tag   VARCHAR(20),                           -- 档期：春季档/暑期档/秋季档/贺岁档
    duration     INT,                                   -- 片长（分钟）
    rating       DECIMAL(3,1),                          -- 豆瓣评分（0-10）
    vote_count   INT,                                   -- 评价人数
    intro        TEXT,                                  -- 剧情简介
    poster_url   VARCHAR(500),                          -- 豆瓣海报 URL（前端经后端代理加载）
    link         VARCHAR(200)                           -- 豆瓣条目页链接
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_movies_year    ON movies (release_year);
CREATE INDEX idx_movies_rating  ON movies (rating);
CREATE INDEX idx_movies_country ON movies (country);
CREATE INDEX idx_movies_votes   ON movies (vote_count);

-- 3. 电影-类型 多对多中间表
CREATE TABLE movie_genres (
    movie_id BIGINT NOT NULL,
    genre_id INT    NOT NULL,
    PRIMARY KEY (movie_id, genre_id),
    CONSTRAINT fk_mg_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    CONSTRAINT fk_mg_genre FOREIGN KEY (genre_id) REFERENCES genres(id)  ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
