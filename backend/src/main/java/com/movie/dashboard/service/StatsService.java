package com.movie.dashboard.service;

import com.movie.dashboard.dto.*;
import com.movie.dashboard.entity.Genre;
import com.movie.dashboard.entity.Movie;
import com.movie.dashboard.entity.MovieFinancial;
import com.movie.dashboard.repository.MovieFinancialRepository;
import com.movie.dashboard.repository.MovieRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 统计图表 Service。
 * <p>
 * 面向多个可视化图表提供聚合数据，
 * 统计运算尽量由 Java 内存分组完成，减少复杂 SQL 维护成本。
 * 所有方法都支持通过 MovieQueryDTO 进行筛选（年份 / 类型 / 国家 / 评分）。
 * </p>
 * <p>
 * 性能改造：把"取数据"与"算数据"拆开。
 * 单个统计接口调用 {@link #loadContext} 取一次数据即可完成计算；
 * 看板聚合接口 {@link #overview} 复用同一份上下文算出全部 6 类图表，
 * 把原先 6 次全表查询 + 6 次网络往返压缩为 1 次。
 * </p>
 */
@Service
public class StatsService {

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private MovieFinancialRepository financialRepository;

    /**
     * 统计上下文：一次查询得到的数据，供所有统计方法复用。
     */
    private static class StatsContext {
        /** 筛选后的电影列表 */
        final List<Movie> movies;
        /** 电影 ID → 票房（万元） */
        final Map<Long, BigDecimal> boxMap;
        /** 电影 ID → 电影（用于散点/档期取标题、评分等） */
        final Map<Long, Movie> movieMap;
        /** 含预算或票值的财务记录 */
        final List<MovieFinancial> fins;

        StatsContext(List<Movie> movies, List<MovieFinancial> fins) {
            this.movies = movies;
            this.fins = fins;
            this.boxMap = fins.stream()
                    .collect(Collectors.toMap(MovieFinancial::getMovieId,
                            mf -> mf.getBoxOfficeWan() == null ? BigDecimal.ZERO : mf.getBoxOfficeWan(),
                            (a, b) -> a));
            this.movieMap = movies.stream()
                    .filter(m -> m.getId() != null)
                    .collect(Collectors.toMap(Movie::getId, m -> m, (a, b) -> a));
        }
    }

    /**
     * 加载统计上下文：一次 movies 全量查询 + 一次财务查询，之后所有统计都在内存里算。
     */
    private StatsContext loadContext(MovieQueryDTO q) {
        List<Movie> movies = filterMovies(movieRepository.findAll(), q);
        List<MovieFinancial> fins = financialRepository.findAllWithBudgetOrBoxOffice();
        return new StatsContext(movies, fins);
    }

    /**
     * 通用筛选：根据 MovieQueryDTO 条件过滤 movie 列表。
     * <p>
     * 类型语义为 AND（同时包含所有选中类型），与列表接口
     * {@link MovieService#getMovies} 保持一致，避免"图表"与"列表"筛选结果不一致。
     * </p>
     */
    private List<Movie> filterMovies(List<Movie> all, MovieQueryDTO q) {
        if (q == null) return all;
        return all.stream()
                .filter(m -> q.getYearStart() == null || m.getYear() != null && m.getYear() >= q.getYearStart())
                .filter(m -> q.getYearEnd() == null || m.getYear() != null && m.getYear() <= q.getYearEnd())
                .filter(m -> q.getCountry() == null || q.getCountry().isBlank() || q.getCountry().equals(m.getCountry()))
                .filter(m -> q.getRatingMin() == null || m.getRating() != null && m.getRating().compareTo(q.getRatingMin()) >= 0)
                .filter(m -> q.getRatingMax() == null || m.getRating() != null && m.getRating().compareTo(q.getRatingMax()) <= 0)
                .filter(m -> {
                    if (q.getGenres() == null || q.getGenres().isEmpty()) return true;
                    if (m.getGenres() == null || m.getGenres().isEmpty()) return false;
                    Set<String> want = new HashSet<>(q.getGenres());
                    return m.getGenres().stream().map(Genre::getName).allMatch(want::contains);
                })
                .collect(Collectors.toList());
    }

    // ---------- 年份趋势（折线图） ----------

    /**
     * 每年电影数 / 平均评分 / 平均票房。
     */
    @Transactional(readOnly = true)
    public List<YearTrendDTO> yearTrend(MovieQueryDTO q) {
        return computeYearTrend(loadContext(q));
    }

    private List<YearTrendDTO> computeYearTrend(StatsContext ctx) {
        Map<Integer, List<Movie>> byYear = ctx.movies.stream()
                .filter(m -> m.getYear() != null)
                .collect(Collectors.groupingBy(Movie::getYear, TreeMap::new, Collectors.toList()));

        List<YearTrendDTO> result = new ArrayList<>();
        for (Map.Entry<Integer, List<Movie>> e : byYear.entrySet()) {
            int year = e.getKey();
            List<Movie> ms = e.getValue();
            long count = ms.size();
            BigDecimal avgRating = avgBigDecimal(ms.stream().map(Movie::getRating).toList());
            BigDecimal avgBoxOffice = avgBigDecimal(ms.stream()
                    .map(m -> ctx.boxMap.getOrDefault(m.getId(), BigDecimal.ZERO)).toList());
            result.add(new YearTrendDTO(year, count, avgRating, avgBoxOffice));
        }
        return result;
    }

    // ---------- 类型对比（柱状图） ----------

    /**
     * 按电影类型聚合：电影数 / 平均评分 / 平均票房。
     */
    @Transactional(readOnly = true)
    public List<GenreCompareDTO> genreCompare(MovieQueryDTO q) {
        return computeGenreCompare(loadContext(q));
    }

    private List<GenreCompareDTO> computeGenreCompare(StatsContext ctx) {
        Map<String, List<Movie>> byGenre = new HashMap<>();
        for (Movie m : ctx.movies) {
            if (m.getGenres() == null) continue;
            for (Genre g : m.getGenres()) {
                byGenre.computeIfAbsent(g.getName(), k -> new ArrayList<>()).add(m);
            }
        }

        return byGenre.entrySet().stream().map(e -> {
            String name = e.getKey();
            List<Movie> ms = e.getValue();
            BigDecimal avgRating = avgBigDecimal(ms.stream().map(Movie::getRating).toList());
            BigDecimal avgBox = avgBigDecimal(ms.stream()
                    .map(m -> ctx.boxMap.getOrDefault(m.getId(), BigDecimal.ZERO)).toList());
            return new GenreCompareDTO(name, avgRating, avgBox, (long) ms.size());
        }).sorted(Comparator.comparingLong(GenreCompareDTO::getCount).reversed())
                .collect(Collectors.toList());
    }

    // ---------- 成本-票房散点图 ----------

    /**
     * 返回所有具备预算/票房数据的电影散点。
     */
    @Transactional(readOnly = true)
    public List<ScatterPointDTO> scatterCostBox(MovieQueryDTO q) {
        return computeScatter(loadContext(q));
    }

    private List<ScatterPointDTO> computeScatter(StatsContext ctx) {
        List<ScatterPointDTO> result = new ArrayList<>();
        for (MovieFinancial mf : ctx.fins) {
            Movie m = ctx.movieMap.get(mf.getMovieId());
            if (m == null) continue;
            result.add(new ScatterPointDTO(
                    zeroNull(mf.getBudgetWan()),
                    zeroNull(mf.getBoxOfficeWan()),
                    m.getRating(),
                    m.getTitle(),
                    m.getCountry()));
        }
        return result;
    }

    // ---------- 国家 × 类型 热力图 ----------

    /**
     * 返回 country × genre 二维聚合。
     */
    @Transactional(readOnly = true)
    public List<HeatmapDTO> heatmap(MovieQueryDTO q) {
        return computeHeatmap(loadContext(q));
    }

    private List<HeatmapDTO> computeHeatmap(StatsContext ctx) {
        Map<String, List<Movie>> bucket = new HashMap<>();
        for (Movie m : ctx.movies) {
            if (m.getCountry() == null || m.getCountry().isBlank()) continue;
            if (m.getGenres() == null) continue;
            for (Genre g : m.getGenres()) {
                String key = m.getCountry() + "||" + g.getName();
                bucket.computeIfAbsent(key, k -> new ArrayList<>()).add(m);
            }
        }
        return bucket.entrySet().stream().map(e -> {
            String[] parts = e.getKey().split("\\|\\|", 2);
            String country = parts[0], genre = parts[1];
            List<Movie> ms = e.getValue();
            BigDecimal avgRating = avgBigDecimal(ms.stream().map(Movie::getRating).toList());
            return new HeatmapDTO(country, genre, avgRating, (long) ms.size());
        }).collect(Collectors.toList());
    }

    // ---------- 档期 × 类型 交叉分析 ----------

    /**
     * seasonTag × genre 下的 平均票房 / 平均评分 / 数量。
     */
    @Transactional(readOnly = true)
    public List<SeasonAnalysisDTO> seasonAnalysis(MovieQueryDTO q) {
        return computeSeasonAnalysis(loadContext(q));
    }

    private List<SeasonAnalysisDTO> computeSeasonAnalysis(StatsContext ctx) {
        Map<String, List<MovieFinancial>> bucket = new HashMap<>();
        for (MovieFinancial mf : ctx.fins) {
            if (mf.getSeasonTag() == null || mf.getSeasonTag().isBlank()) continue;
            Movie m = ctx.movieMap.get(mf.getMovieId());
            if (m == null || m.getGenres() == null) continue;
            for (Genre g : m.getGenres()) {
                String key = mf.getSeasonTag() + "||" + g.getName();
                bucket.computeIfAbsent(key, k -> new ArrayList<>()).add(mf);
            }
        }
        return bucket.entrySet().stream().map(e -> {
            String[] parts = e.getKey().split("\\|\\|", 2);
            String season = parts[0], genre = parts[1];
            List<MovieFinancial> list = e.getValue();
            BigDecimal avgBox = avgBigDecimal(list.stream()
                    .map(mf -> mf.getBoxOfficeWan() == null ? BigDecimal.ZERO : mf.getBoxOfficeWan()).toList());
            BigDecimal avgRating = avgBigDecimal(list.stream()
                    .map(mf -> ctx.movieMap.get(mf.getMovieId()))
                    .filter(Objects::nonNull)
                    .map(Movie::getRating)
                    .toList());
            return new SeasonAnalysisDTO(season, genre, avgBox, avgRating, (long) list.size());
        }).collect(Collectors.toList());
    }

    // ---------- 导演 TOP N ----------

    /**
     * 执导电影数最多的前 N 位导演（按数量降序，同数量按平均评分降序）。
     */
    @Transactional(readOnly = true)
    public List<DirectorTopDTO> topDirectors(int n, MovieQueryDTO q) {
        return computeTopDirectors(loadContext(q), n);
    }

    private List<DirectorTopDTO> computeTopDirectors(StatsContext ctx, int n) {
        Map<String, List<Movie>> byDirector = new HashMap<>();
        for (Movie m : ctx.movies) {
            if (m.getDirector() == null || m.getDirector().isBlank()) continue;
            byDirector.computeIfAbsent(m.getDirector(), k -> new ArrayList<>()).add(m);
        }
        return byDirector.entrySet().stream()
                .map(e -> {
                    BigDecimal avgRating = avgBigDecimal(e.getValue().stream().map(Movie::getRating).toList());
                    return new DirectorTopDTO(e.getKey(), (long) e.getValue().size(), avgRating);
                })
                .sorted(Comparator
                        .comparingLong(DirectorTopDTO::getCount).reversed()
                        .thenComparing(DirectorTopDTO::getAvgRating,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(Math.max(1, n))
                .collect(Collectors.toList());
    }

    // ---------- 看板聚合（一次请求出全部图表 + KPI） ----------

    /**
     * 看板聚合接口：一次数据加载算出 6 类图表 + KPI 汇总。
     * <p>
     * 相比前端并发 6 个统计接口，这里只查一次 movies、一次 financials，
     * 6 类图表全部在内存中基于同一份数据算出。
     * </p>
     *
     * @param q    筛选条件
     * @param topN 导演榜返回条数
     */
    @Transactional(readOnly = true)
    public StatsOverviewDTO overview(MovieQueryDTO q, int topN) {
        StatsContext ctx = loadContext(q);

        List<YearTrendDTO> yearTrend = computeYearTrend(ctx);
        List<GenreCompareDTO> genreCompare = computeGenreCompare(ctx);
        List<ScatterPointDTO> scatter = computeScatter(ctx);
        List<HeatmapDTO> heatmap = computeHeatmap(ctx);
        List<SeasonAnalysisDTO> season = computeSeasonAnalysis(ctx);
        List<DirectorTopDTO> directors = computeTopDirectors(ctx, topN);

        return new StatsOverviewDTO(
                computeKpi(ctx, yearTrend),
                yearTrend, genreCompare, scatter, heatmap, season, directors);
    }

    /**
     * KPI 汇总：总数 / 加权平均评分 / 年代跨度 / 覆盖国家数。
     */
    private StatsOverviewDTO.KpiDTO computeKpi(StatsContext ctx, List<YearTrendDTO> yearTrend) {
        long total = ctx.movies.size();

        // 平均评分：按年份聚合后的电影数加权（比简单平均更接近真实口碑）
        BigDecimal weighted = BigDecimal.ZERO;
        long weight = 0;
        for (YearTrendDTO d : yearTrend) {
            long c = d.getCount() == null ? 0L : d.getCount();
            weighted = weighted.add(d.getAvgRating() == null ? BigDecimal.ZERO : d.getAvgRating()
                    .multiply(BigDecimal.valueOf(c)));
            weight += c;
        }
        BigDecimal avgRating = weight > 0
                ? weighted.divide(BigDecimal.valueOf(weight), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        Integer yearMin = null, yearMax = null;
        Set<String> countries = new HashSet<>();
        for (Movie m : ctx.movies) {
            if (m.getYear() != null) {
                if (yearMin == null || m.getYear() < yearMin) yearMin = m.getYear();
                if (yearMax == null || m.getYear() > yearMax) yearMax = m.getYear();
            }
            if (m.getCountry() != null && !m.getCountry().isBlank()) countries.add(m.getCountry());
        }

        return new StatsOverviewDTO.KpiDTO(total, avgRating, yearMin, yearMax, countries.size());
    }

    // ---------- 辅助 ----------

    /**
     * 计算列表平均值，跳过 null，空列表返回 0。
     */
    private BigDecimal avgBigDecimal(List<BigDecimal> values) {
        List<BigDecimal> cleaned = values.stream()
                .filter(Objects::nonNull)
                .filter(v -> v.compareTo(BigDecimal.ZERO) >= 0)
                .toList();
        if (cleaned.isEmpty()) return BigDecimal.ZERO;
        BigDecimal sum = cleaned.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(cleaned.size()), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal zeroNull(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
