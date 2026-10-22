-- ============================================================
-- 重置电影数据（用于重新导入「12 类型 / 10 地区」标准化数据集）
-- ============================================================
-- 适用场景：
--   已修改 scripts/build_dataset.py 并重新生成了
--   backend/src/main/resources/data/movies.csv（每部电影归并为单一主类型 / 主地区）。
--   但 DataInitializer 仅在 movies 表为空时才导入，因此需要先清空三张表再重启后端。
--
-- 用法（任选其一）：
--   1) MySQL 命令行：  mysql -u root -p movie_dashboard < docs/reset-db.sql
--   2) IDEA Database 控制台：粘贴执行以下语句
--   3) 或直接在 MySQL 里 DROP DATABASE movie_dashboard; CREATE DATABASE movie_dashboard;
--      再重启后端（Hibernate 会按 ddl-auto:update 自动建表）
--
-- 注意：清空后重启 Spring Boot（端口 8081），DataInitializer 会自动从
--       movies.csv 重新导入 2050 条标准化电影；导入期间后端首次启动较慢属正常。
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE movie_genres;
TRUNCATE TABLE movies;
TRUNCATE TABLE genres;
SET FOREIGN_KEY_CHECKS = 1;
