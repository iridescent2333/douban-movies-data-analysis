package com.movie.dashboard.repository;

import com.movie.dashboard.entity.Genre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 类型字典 Repository。
 */
@Repository
public interface GenreRepository extends JpaRepository<Genre, Integer> {

    /**
     * 按类型名模糊搜索（用于筛选器联动）。
     *
     * @param name 关键字
     * @return 匹配的类型列表
     */
    List<Genre> findByNameContaining(String name);
}
