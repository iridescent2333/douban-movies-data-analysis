-- ============================================================
-- 豆瓣电影数据洞察看板 —— 建表脚本
-- 数据来源：Kaggle 公开豆瓣电影数据集（https://www.kaggle.com/datasets/dengfuping/douban-movies-dataset）
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
