-- =============================================================
-- 豆瓣电影数据看板 - H2 2.2 初始化脚本
-- Spring Boot sql.init 会在 Hibernate 启动前执行
-- 表名/列名必须与 Entity 的 @Table/@Column 完全一致
-- =============================================================

DROP TABLE IF EXISTS movie_financials;
DROP TABLE IF EXISTS movie_genres;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS genres;

-- 1. 类型字典表
CREATE TABLE genres (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. 电影主表
CREATE TABLE movies (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    director    VARCHAR(100),
    lead_actor  VARCHAR(300),
    country     VARCHAR(50),
    year        INT,
    duration    INT,
    rating      DECIMAL(3,1),
    vote_count  INT,
    intro       TEXT,
    poster_url  VARCHAR(500)
);

CREATE INDEX idx_movies_year    ON movies (year);
CREATE INDEX idx_movies_rating  ON movies (rating);
CREATE INDEX idx_movies_country ON movies (country);

-- 3. 电影-类型 多对多中间表
CREATE TABLE movie_genres (
    movie_id BIGINT NOT NULL,
    genre_id INT    NOT NULL,
    PRIMARY KEY (movie_id, genre_id),
    CONSTRAINT fk_mg_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    CONSTRAINT fk_mg_genre FOREIGN KEY (genre_id) REFERENCES genres(id)  ON DELETE CASCADE
);

-- 4. 财务数据表（一对一）
CREATE TABLE movie_financials (
    movie_id        BIGINT PRIMARY KEY,
    budget_wan      DECIMAL(12,2),
    box_office_wan  DECIMAL(12,2),
    release_date    DATE,
    season_tag      VARCHAR(30),
    CONSTRAINT fk_mf_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);
