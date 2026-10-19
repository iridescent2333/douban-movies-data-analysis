package com.movie.dashboard.entity;

import jakarta.persistence.*;

import java.util.Objects;

/**
 * 电影类型字典（genre）。
 * <p>
 * 与 Movie 之间是多对多关联，中间表为 movie_genres。
 * </p>
 */
@Entity
@Table(name = "genres")
public class Genre {

    /** 主键，自增 */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /** 类型名称，唯一，例如 "剧情"、"喜剧" */
    @Column(name = "name", nullable = false, unique = true, length = 50)
    private String name;

    public Genre() {
    }

    public Genre(Integer id, String name) {
        this.id = id;
        this.name = name;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Genre genre = (Genre) o;
        return Objects.equals(id, genre.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Genre{id=" + id + ", name='" + name + "'}";
    }
}
