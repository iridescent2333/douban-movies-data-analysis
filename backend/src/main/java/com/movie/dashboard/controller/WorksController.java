package com.movie.dashboard.controller;

import com.movie.dashboard.dto.*;
import com.movie.dashboard.exception.Result;
import com.movie.dashboard.service.MovieService;
import com.movie.dashboard.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * 作品（电影）数据控制器 —— 对应课程要求接口 A1-A5。
 * <p>
 * 路径与课程《项目需求文档三：图书/电影数据分析看板》保持一致：
 * <ul>
 *   <li>A1 GET /api/types        类型列表（在 {@link TypesController}）</li>
 *   <li>A2 GET /api/works        按类型/年份/评分查询，分页</li>
 *   <li>A3 GET /api/works/{id}   单条作品详情</li>
 *   <li>A4 GET /api/works/stats  统计：评分分布、年度趋势、类型对比</li>
 *   <li>A5 GET /api/works/top    TOP10（按评分或评价人数）</li>
 * </ul>
 * </p>
 */
@RestController
@RequestMapping("/api/works")
@Tag(name = "作品数据（A2-A5）", description = "电影作品查询、详情、统计与排行")
public class WorksController {

    @Autowired
    private MovieService movieService;

    @Autowired
    private StatsService statsService;

    /** A2：按类型、年份区间、评分区间查询作品，分页返回 */
    @Operation(summary = "A2 作品分页列表", description = "支持类型、年份区间、评分区间、标题关键字组合筛选；page 从 0 开始")
    @GetMapping("")
    public Result<Page<MovieDTO>> list(
            @Parameter(description = "页码，从 0 开始") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页条数，默认 20") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "类型（精确匹配）") @RequestParam(required = false) String type,
            @Parameter(description = "起始年份（含）") @RequestParam(required = false) Integer yearStart,
            @Parameter(description = "结束年份（含）") @RequestParam(required = false) Integer yearEnd,
            @Parameter(description = "最低评分（含）") @RequestParam(required = false) BigDecimal ratingMin,
            @Parameter(description = "最高评分（含）") @RequestParam(required = false) BigDecimal ratingMax,
            @Parameter(description = "标题关键字（模糊）") @RequestParam(required = false) String title) {

        MovieQueryDTO q = new MovieQueryDTO();
        q.setPage(page);
        q.setSize(size);
        q.setGenres(type == null || type.isBlank() ? null : List.of(type));
        q.setYearStart(yearStart);
        q.setYearEnd(yearEnd);
        q.setRatingMin(ratingMin);
        q.setRatingMax(ratingMax);
        q.setTitle(title);
        return Result.ok(movieService.getMovies(q));
    }

    /** A3：单条作品详情 */
    @Operation(summary = "A3 作品详情", description = "返回完整字段，含类型标签与财务信息")
    @GetMapping("/{id}")
    public Result<MovieDetailDTO> detail(
            @Parameter(description = "作品 ID") @PathVariable Long id) {
        return Result.ok(movieService.getById(id));
    }

    /** A4：统计：评分分布、年度趋势、类型对比 */
    @Operation(summary = "A4 统计数据", description = "一次返回评分分布直方图、年度趋势、类型对比三份统计，均遵循同一套筛选条件")
    @GetMapping("/stats")
    public Result<WorksStatsDTO> stats(
            @Parameter(description = "类型（精确匹配）") @RequestParam(required = false) String type,
            @Parameter(description = "起始年份（含）") @RequestParam(required = false) Integer yearStart,
            @Parameter(description = "结束年份（含）") @RequestParam(required = false) Integer yearEnd,
            @Parameter(description = "最低评分（含）") @RequestParam(required = false) BigDecimal ratingMin,
            @Parameter(description = "最高评分（含）") @RequestParam(required = false) BigDecimal ratingMax,
            @Parameter(description = "标题关键字（模糊）") @RequestParam(required = false) String title) {

        MovieQueryDTO q = new MovieQueryDTO();
        q.setGenres(type == null || type.isBlank() ? null : List.of(type));
        q.setYearStart(yearStart);
        q.setYearEnd(yearEnd);
        q.setRatingMin(ratingMin);
        q.setRatingMax(ratingMax);
        q.setTitle(title);
        return Result.ok(new WorksStatsDTO(
                statsService.ratingDistribution(q),
                statsService.yearTrend(q),
                statsService.genreCompare(q)));
    }

    /** A5：TOP10（按评分或评价人数） */
    @Operation(summary = "A5 热门作品 TOP N", description = "by=rating 按评分降序（默认），by=votes 按评价人数降序")
    @GetMapping("/top")
    public Result<List<MovieDTO>> top(
            @Parameter(description = "返回条数，默认 10") @RequestParam(defaultValue = "10") int n,
            @Parameter(description = "排序依据：rating / votes") @RequestParam(defaultValue = "rating") String by,
            @Parameter(description = "类型（精确匹配）") @RequestParam(required = false) String type,
            @Parameter(description = "起始年份（含）") @RequestParam(required = false) Integer yearStart,
            @Parameter(description = "结束年份（含）") @RequestParam(required = false) Integer yearEnd,
            @Parameter(description = "最低评分（含）") @RequestParam(required = false) BigDecimal ratingMin,
            @Parameter(description = "最高评分（含）") @RequestParam(required = false) BigDecimal ratingMax,
            @Parameter(description = "标题关键字（模糊）") @RequestParam(required = false) String title) {

        MovieQueryDTO q = new MovieQueryDTO();
        q.setGenres(type == null || type.isBlank() ? null : List.of(type));
        q.setYearStart(yearStart);
        q.setYearEnd(yearEnd);
        q.setRatingMin(ratingMin);
        q.setRatingMax(ratingMax);
        q.setTitle(title);
        return Result.ok(statsService.topWorks(n, by, q));
    }
}
