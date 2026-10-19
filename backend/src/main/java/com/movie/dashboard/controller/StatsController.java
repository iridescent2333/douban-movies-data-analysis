package com.movie.dashboard.controller;

import com.movie.dashboard.dto.*;
import com.movie.dashboard.exception.Result;
import com.movie.dashboard.service.StatsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * 统计图表控制器。
 * <p>
 * 全部接口给前端图表用：折线、柱状、散点、热力、雷达、TOP 榜。
 * 所有接口共享的查询参数可用于按年份 / 类型 / 国家 / 评分 筛选。
 * </p>
 */
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    @Autowired
    private StatsService statsService;

    /** 年份趋势折线：每年电影数 / 平均评分 / 平均票房 */
    @GetMapping("/year-trend")
    public Result<List<YearTrendDTO>> yearTrend(
            @RequestParam(required = false) Integer yearStart,
            @RequestParam(required = false) Integer yearEnd,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) BigDecimal ratingMin,
            @RequestParam(required = false) BigDecimal ratingMax) {
        MovieQueryDTO q = buildQuery(yearStart, yearEnd, genres, country, ratingMin, ratingMax);
        return Result.ok(statsService.yearTrend(q));
    }

    /** 类型对比柱状：每类型电影数 / 平均评分 / 平均票房 */
    @GetMapping("/genre-compare")
    public Result<List<GenreCompareDTO>> genreCompare(
            @RequestParam(required = false) Integer yearStart,
            @RequestParam(required = false) Integer yearEnd,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) BigDecimal ratingMin,
            @RequestParam(required = false) BigDecimal ratingMax) {
        MovieQueryDTO q = buildQuery(yearStart, yearEnd, genres, country, ratingMin, ratingMax);
        return Result.ok(statsService.genreCompare(q));
    }

    /** 成本-票房散点 */
    @GetMapping("/scatter-cost-box")
    public Result<List<ScatterPointDTO>> scatterCostBox(
            @RequestParam(required = false) Integer yearStart,
            @RequestParam(required = false) Integer yearEnd,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) BigDecimal ratingMin,
            @RequestParam(required = false) BigDecimal ratingMax) {
        MovieQueryDTO q = buildQuery(yearStart, yearEnd, genres, country, ratingMin, ratingMax);
        return Result.ok(statsService.scatterCostBox(q));
    }

    /** 国家 × 类型 热力图 */
    @GetMapping("/heatmap")
    public Result<List<HeatmapDTO>> heatmap(
            @RequestParam(required = false) Integer yearStart,
            @RequestParam(required = false) Integer yearEnd,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) BigDecimal ratingMin,
            @RequestParam(required = false) BigDecimal ratingMax) {
        MovieQueryDTO q = buildQuery(yearStart, yearEnd, genres, country, ratingMin, ratingMax);
        return Result.ok(statsService.heatmap(q));
    }

    /** 档期 × 类型 交叉分析 */
    @GetMapping("/season-analysis")
    public Result<List<SeasonAnalysisDTO>> seasonAnalysis(
            @RequestParam(required = false) Integer yearStart,
            @RequestParam(required = false) Integer yearEnd,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) BigDecimal ratingMin,
            @RequestParam(required = false) BigDecimal ratingMax) {
        MovieQueryDTO q = buildQuery(yearStart, yearEnd, genres, country, ratingMin, ratingMax);
        return Result.ok(statsService.seasonAnalysis(q));
    }

    /** 导演 TOP N */
    @GetMapping("/top-directors")
    public Result<List<DirectorTopDTO>> topDirectors(
            @RequestParam(defaultValue = "10") int n,
            @RequestParam(required = false) Integer yearStart,
            @RequestParam(required = false) Integer yearEnd,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) BigDecimal ratingMin,
            @RequestParam(required = false) BigDecimal ratingMax) {
        MovieQueryDTO q = buildQuery(yearStart, yearEnd, genres, country, ratingMin, ratingMax);
        return Result.ok(statsService.topDirectors(n, q));
    }

    /** 构造共享查询 DTO */
    private MovieQueryDTO buildQuery(Integer yearStart, Integer yearEnd, List<String> genres,
                                      String country, BigDecimal ratingMin, BigDecimal ratingMax) {
        MovieQueryDTO q = new MovieQueryDTO();
        q.setYearStart(yearStart);
        q.setYearEnd(yearEnd);
        q.setGenres(genres);
        q.setCountry(country);
        q.setRatingMin(ratingMin);
        q.setRatingMax(ratingMax);
        return q;
    }
}
