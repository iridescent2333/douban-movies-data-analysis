-- =============================================================
-- 豆瓣电影数据看板 - MySQL 8.0 初始化
-- 账号密码由你自己决定，配置在 application-local.yml 或环境变量中（不在本文件里）
-- 用法: MySQLWorkbench 打开后，File → Open SQL Script → 选本文件 → 闪电图标执行
-- 只需执行一次，后端启动后 Hibernate 自动建 4 张表
-- =============================================================

CREATE DATABASE IF NOT EXISTS movie_dashboard
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE movie_dashboard;

-- 确认（应该是空的，后端启动后自动建表 + DataInitializer 加载数据）
SHOW TABLES;
