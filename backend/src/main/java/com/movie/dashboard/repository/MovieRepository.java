package com.movie.dashboard.repository;

import com.movie.dashboard.entity.Movie;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

/**
 * 电影主表 Repository。
 * <p>
 * 除了基础 CRUD，提供多条件筛选 / 统计所需的 JPQL 方法，
 * 供 Service 层调用。
 * </p>
 */
@Repository
public interface MovieRepository extends JpaRepository<Movie, Long> {

    /**
     * 按标题模糊搜索。
     */
    List<Movie> findByTitleContaining(String title);

    /**
     * 按上映年份精确过滤。
     */
    List<Movie> findByYear(Integer year);

    /**
     * 按制片国家/地区精确过滤。
     */
    List<Movie> findByCountry(String country);

    /**
     * 评分区间过滤。
     */
    List<Movie> findByRatingBetween(BigDecimal min, BigDecimal max);

    /**
     * 获取所有 distinct 年份，升序。
     * 业务含义：填充前端年份下拉筛选器。
     */
    @Query("SELECT DISTINCT m.year FROM Movie m WHERE m.year IS NOT NULL ORDER BY m.year ASC")
    List<Integer> findDistinctYears();

    /**
     * 获取所有 distinct 国家/地区。
     * 业务含义：填充前端地区下拉筛选器。
     */
    @Query("SELECT DISTINCT m.country FROM Movie m WHERE m.country IS NOT NULL AND m.country <> '' ORDER BY m.country ASC")
    List<String> findDistinctCountries();

    /**
     * 多条件筛选分页（主查询）。
     * <p>
     * 业务含义：按年份区间 / 类型名 / 国家 / 评分区间 / 标题关键字 组合查询，
     * 任何一个条件传 null 就代表不启用。
     * </p>
     *
     * @param yearStart 起始年份（含）
     * @param yearEnd   结束年份（含）
     * @param country   国家/地区
     * @param ratingMin 最低评分
     * @param ratingMax 最高评分
     * @param title     标题关键字（模糊）
     * @param genre     类型名（精确匹配一个，类型过滤由调用方传入）
     */
    @Query(value = """
            SELECT DISTINCT m FROM Movie m
            LEFT JOIN FETCH m.genres
            WHERE (:yearStart IS NULL OR m.year >= :yearStart)
              AND (:yearEnd   IS NULL OR m.year <= :yearEnd)
              AND (:country   IS NULL OR m.country LIKE CONCAT('%', :country, '%'))
              AND (:ratingMin IS NULL OR m.rating >= :ratingMin)
              AND (:ratingMax IS NULL OR m.rating <= :ratingMax)
              AND (:title     IS NULL OR m.title LIKE CONCAT('%', :title, '%'))
              AND (:genre     IS NULL OR EXISTS (
                    SELECT g FROM Genre g
                    JOIN m.genres mg WHERE mg.name = :genre))
            ORDER BY m.rating DESC
            """,
            countQuery = """
            SELECT COUNT(DISTINCT m) FROM Movie m
            WHERE (:yearStart IS NULL OR m.year >= :yearStart)
              AND (:yearEnd   IS NULL OR m.year <= :yearEnd)
              AND (:country   IS NULL OR m.country LIKE CONCAT('%', :country, '%'))
              AND (:ratingMin IS NULL OR m.rating >= :ratingMin)
              AND (:ratingMax IS NULL OR m.rating <= :ratingMax)
              AND (:title     IS NULL OR m.title LIKE CONCAT('%', :title, '%'))
              AND (:genre     IS NULL OR EXISTS (
                    SELECT g FROM Genre g
                    JOIN m.genres mg WHERE mg.name = :genre))
            """)
    Page<Movie> findByMultiCriteria(@Param("yearStart") Integer yearStart,
                                    @Param("yearEnd")   Integer yearEnd,
                                    @Param("country")   String country,
                                    @Param("ratingMin") BigDecimal ratingMin,
                                    @Param("ratingMax") BigDecimal ratingMax,
                                    @Param("title")     String title,
                                    @Param("genre")     String genre,
                                    Pageable pageable);
}
