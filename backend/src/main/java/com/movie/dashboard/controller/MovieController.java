package com.movie.dashboard.controller;

import com.movie.dashboard.dto.*;
import com.movie.dashboard.exception.Result;
import com.movie.dashboard.service.MovieService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * 电影 REST 控制器。
 * <p>
 * 提供列表分页、详情、以及前端筛选器下拉数据。
 * 所有接口统一返回 Result&lt;T&gt;。
 * </p>
 */
@RestController
@RequestMapping("/api/movies")
public class MovieController {

    @Autowired
    private MovieService movieService;

    /**
     * 多条件筛选分页查询。
     *
     * @return 电影分页结果，按评分降序
     * 给图表用：列表页 / 筛选后展示区
     */
    @GetMapping
    public Result<PageResult<MovieDTO>> list(
            @RequestParam(required = false) Integer yearStart,
            @RequestParam(required = false) Integer yearEnd,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) BigDecimal ratingMin,
            @RequestParam(required = false) BigDecimal ratingMax,
            @RequestParam(required = false) String title,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {

        MovieQueryDTO q = new MovieQueryDTO();
        q.setYearStart(yearStart);
        q.setYearEnd(yearEnd);
        q.setGenres(genres);
        q.setCountry(country);
        q.setRatingMin(ratingMin);
        q.setRatingMax(ratingMax);
        q.setTitle(title);
        q.setPage(page);
        q.setSize(size);

        return Result.ok(movieService.getMovies(q));
    }

    /**
     * 查询单个电影详情。
     *
     * @param id 电影主键
     * @return 电影详情（含类型列表与可选财务数据）
     */
    @GetMapping("/{id}")
    public Result<MovieDetailDTO> detail(
            @PathVariable Long id) {
        return Result.ok(movieService.getById(id));
    }

    /**
     * 返回前端筛选器下拉所需的全部可选项：年份 / 国家 / 类型。
     *
     * @return 一次性聚合所有下拉数据
     */
    @GetMapping("/filters")
    public Result<FilterOptionsDTO> filters() {
        return Result.ok(movieService.getFilterOptions());
    }
}
