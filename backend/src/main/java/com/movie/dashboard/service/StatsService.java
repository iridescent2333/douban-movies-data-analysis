package com.movie.dashboard.service;

import com.movie.dashboard.dto.*;
import com.movie.dashboard.entity.Genre;
import com.movie.dashboard.entity.Movie;
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
 * 全部统计基于 MySQL 中的真实豆瓣数据（Kaggle 公开数据集导入），
 * 不包含任何编造字段；公开数据集没有真实的制作预算/票房，
 * 因此不做"成本-票房"类统计，改为"评分 × 热度"散点与"档期 × 类型"交叉分析。
 * </p>
 * <p>
 * 性能设计：把"取数"（{@link #loadContext}）与"算数"（computeXxx）拆开——
 * 单个统计接口取一次数据算一次；看板聚合接口 {@link #overview}
 * 复用同一份上下文算出全部图表 + KPI，避免重复全表查询。
 * </p>
 */
@Service
public class StatsService {

    /** 评分分布直方图：桶宽 0.5 分，覆盖 2.0 – 10.0 */
    private static final int RATING_BUCKETS = 16;
    private static final double RATING_BUCKET_MIN = 2.0;
    private static final double RATING_BUCKET_WIDTH = 0.5;

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private MovieService movieService;

    /**
     * 统计上下文：一次查询得到的数据，供所有统计方法复用。
     */
    private static class StatsContext {
        /** 筛选后的电影列表 */
        final List<Movie> movies;

        StatsContext(List<Movie> movies) {
            this.movies = movies;
        }
    }

    /**
     * 加载统计上下文：一次 movies 全量查询，之后所有统计都在内存里算。
     */
    private StatsContext loadContext(MovieQueryDTO q) {
        List<Movie> movies = filterMovies(movieRepository.findAll(), q);
        return new StatsContext(movies);
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
                .filter(m -> q.getCountry() == null || q.getCountry().isBlank() || countryContains(m.getCountry(), q.getCountry()))
                .filter(m -> q.getRatingMin() == null || m.getRating() != null && m.getRating().compareTo(q.getRatingMin()) >= 0)
                .filter(m -> q.getRatingMax() == null || m.getRating() != null && m.getRating().compareTo(q.getRatingMax()) <= 0)
                .filter(m -> {
                    if (q.getGenres() == null || q.getGenres().isEmpty()) return true;
                    if (m.getGenres() == null || m.getGenres().isEmpty()) return false;
                    // AND 语义：影片须同时包含所有选中类型（影片的类型集 ⊇ 选中集）。
                    // 注意方向不能写反：若写成"影片的每个类型都在选中集里"，
                    // 单选"科幻"时只有"纯科幻"影片命中，科幻+动作的合拍类型全部被误杀
                    Set<String> movieGenres = m.getGenres().stream()
                            .map(Genre::getName).collect(Collectors.toSet());
                    return movieGenres.containsAll(q.getGenres());
                })
                .collect(Collectors.toList());
    }

    // ---------- 年份趋势（F6 折线图） ----------

    /**
     * 每年电影数 / 平均评分。
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
            List<Movie> ms = e.getValue();
            BigDecimal avgRating = avgBigDecimal(ms.stream().map(Movie::getRating).toList());
            // 公开数据集无真实票房，avgBoxOffice 置 null（前端不渲染该系列）
            result.add(new YearTrendDTO(e.getKey(), (long) ms.size(), avgRating, null));
        }
        return result;
    }

    // ---------- 类型对比（F8 柱状图 / 雷达图） ----------

    /**
     * 按电影类型聚合：电影数 / 平均评分 / 平均评价人数（热度）。
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
            List<Movie> ms = e.getValue();
            BigDecimal avgRating = avgBigDecimal(ms.stream().map(Movie::getRating).toList());
            // 数据集无真实票房 → 第三维度改用"平均评价人数"（热度），同样是豆瓣真实数据
            BigDecimal avgVotes = avgBigDecimal(ms.stream()
                    .map(m -> m.getVoteCount() == null ? null : BigDecimal.valueOf(m.getVoteCount()))
                    .toList());
            return new GenreCompareDTO(e.getKey(), avgRating, avgVotes, (long) ms.size());
        }).sorted(Comparator.comparingLong(GenreCompareDTO::getCount).reversed())
                .collect(Collectors.toList());
    }

    // ---------- 评分 × 热度散点 ----------

    /**
     * 返回所有电影的"评分 × 评价人数"散点（两个维度都是豆瓣真实数据）。
     */
    @Transactional(readOnly = true)
    public List<ScatterPointDTO> ratingVotesScatter(MovieQueryDTO q) {
        return computeScatter(loadContext(q));
    }

    private List<ScatterPointDTO> computeScatter(StatsContext ctx) {
        return ctx.movies.stream()
                .filter(m -> m.getRating() != null && m.getVoteCount() != null)
                .map(m -> new ScatterPointDTO(
                        m.getId(),
                        m.getTitle(),
                        m.getRating(),
                        m.getVoteCount(),
                        primaryCountry(m.getCountry()),
                        firstGenre(m)))
                .collect(Collectors.toList());
    }

    private String firstGenre(Movie m) {
        if (m.getGenres() == null || m.getGenres().isEmpty()) return "其他";
        return m.getGenres().iterator().next().getName();
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
            // 合拍片拆分到每个地区分别计数（与分地区热榜的"包含"口径一致）
            for (String country : m.getCountry().split("/")) {
                String c = country.trim();
                if (c.isEmpty()) continue;
                for (Genre g : m.getGenres()) {
                    String key = c + "||" + g.getName();
                    bucket.computeIfAbsent(key, k -> new ArrayList<>()).add(m);
                }
            }
        }
        return bucket.entrySet().stream().map(e -> {
            String[] parts = e.getKey().split("\\|\\|", 2);
            List<Movie> ms = e.getValue();
            BigDecimal avgRating = avgBigDecimal(ms.stream().map(Movie::getRating).toList());
            return new HeatmapDTO(parts[0], parts[1], avgRating, (long) ms.size());
        }).collect(Collectors.toList());
    }

    // ---------- 档期 × 类型 交叉分析 ----------

    /**
     * seasonTag（由真实上映月份映射：春季档/暑期档/秋季档/贺岁档）× genre 下的平均评分 / 数量。
     */
    @Transactional(readOnly = true)
    public List<SeasonAnalysisDTO> seasonAnalysis(MovieQueryDTO q) {
        return computeSeasonAnalysis(loadContext(q));
    }

    private List<SeasonAnalysisDTO> computeSeasonAnalysis(StatsContext ctx) {
        // key = 档期||类型；seasonTag 已在数据导入阶段按上映月份算好
        Map<String, List<Movie>> bucket = new HashMap<>();
        for (Movie m : ctx.movies) {
            if (m.getSeasonTag() == null || m.getSeasonTag().isBlank()) continue;
            if (m.getGenres() == null) continue;
            for (Genre g : m.getGenres()) {
                String key = m.getSeasonTag() + "||" + g.getName();
                bucket.computeIfAbsent(key, k -> new ArrayList<>()).add(m);
            }
        }
        return bucket.entrySet().stream().map(e -> {
            String[] parts = e.getKey().split("\\|\\|", 2);
            List<Movie> ms = e.getValue();
            BigDecimal avgRating = avgBigDecimal(ms.stream().map(Movie::getRating).toList());
            return new SeasonAnalysisDTO(parts[0], parts[1], avgRating, (long) ms.size());
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

    // ---------- 评分分布直方图（F5） ----------

    /**
     * 按 0.5 分粒度统计各评分段的电影数量。
     */
    @Transactional(readOnly = true)
    public List<RatingDistributionDTO> ratingDistribution(MovieQueryDTO q) {
        return computeRatingDistribution(loadContext(q));
    }

    private List<RatingDistributionDTO> computeRatingDistribution(StatsContext ctx) {
        // 预建 16 个桶，保证没有数据的评分段也返回（count=0），前端画图连续
        List<List<BigDecimal>> buckets = new ArrayList<>(RATING_BUCKETS);
        for (int i = 0; i < RATING_BUCKETS; i++) buckets.add(new ArrayList<>());

        for (Movie m : ctx.movies) {
            if (m.getRating() == null) continue;
            double r = m.getRating().doubleValue();
            int idx = (int) Math.floor((r - RATING_BUCKET_MIN) / RATING_BUCKET_WIDTH);
            if (idx < 0) idx = 0;
            if (idx >= RATING_BUCKETS) idx = RATING_BUCKETS - 1;
            buckets.get(idx).add(m.getRating());
        }

        List<RatingDistributionDTO> result = new ArrayList<>(RATING_BUCKETS);
        for (int i = 0; i < RATING_BUCKETS; i++) {
            double lo = RATING_BUCKET_MIN + i * RATING_BUCKET_WIDTH;
            double hi = lo + RATING_BUCKET_WIDTH;
            String label = (hi > 9.9 ? lo + "+" : String.format("%.1f-%.1f", lo, hi));
            List<BigDecimal> values = buckets.get(i);
            result.add(new RatingDistributionDTO(label, (long) values.size(), avgBigDecimal(values)));
        }
        return result;
    }

    // ---------- 热门作品 TOP N（F7） ----------

    /**
     * 热门作品 TOP N。
     *
     * @param n  返回条数
     * @param by 排序依据：rating（评分，默认）或 votes（评价人数）
     */
    @Transactional(readOnly = true)
    public List<MovieDTO> topWorks(int n, String by, MovieQueryDTO q) {
        return computeTopWorks(loadContext(q), n, by);
    }

    private List<MovieDTO> computeTopWorks(StatsContext ctx, int n, String by) {
        // 主排序维度（评分 / 评价人数），次级维度固定按评价人数降序——
        // 保证评分相同时（如两部 9.7 分）热度更高的排前面，榜单更符合直觉
        Comparator<Movie> primary = "votes".equalsIgnoreCase(by)
                ? Comparator.comparingInt(m -> m.getVoteCount() == null ? 0 : m.getVoteCount())
                : Comparator.comparing(m -> m.getRating() == null ? BigDecimal.ZERO : m.getRating());
        Comparator<Movie> cmp = primary.thenComparingInt(
                m -> m.getVoteCount() == null ? 0 : m.getVoteCount());
        return ctx.movies.stream()
                .filter(m -> m.getTitle() != null && !m.getTitle().isBlank())
                .sorted(cmp.reversed())
                .limit(Math.max(1, n))
                .map(movieService::toDTO)
                .collect(Collectors.toList());
    }

    // ---------- 看板聚合（一次请求出全部图表 + KPI） ----------

    /**
     * 看板聚合接口：一次数据加载算出全部图表 + KPI 汇总。
     *
     * @param q    筛选条件
     * @param topN 榜单返回条数
     */
    @Transactional(readOnly = true)
    public StatsOverviewDTO overview(MovieQueryDTO q, int topN) {
        StatsContext ctx = loadContext(q);

        List<RatingDistributionDTO> ratingDistribution = computeRatingDistribution(ctx);
        List<YearTrendDTO> yearTrend = computeYearTrend(ctx);
        List<GenreCompareDTO> genreCompare = computeGenreCompare(ctx);
        List<ScatterPointDTO> scatter = computeScatter(ctx);
        List<HeatmapDTO> heatmap = computeHeatmap(ctx);
        List<SeasonAnalysisDTO> season = computeSeasonAnalysis(ctx);
        List<DirectorTopDTO> directors = computeTopDirectors(ctx, topN);
        List<MovieDTO> topWorks = computeTopWorks(ctx, topN, "rating");

        return new StatsOverviewDTO(
                computeKpi(ctx, yearTrend),
                ratingDistribution, yearTrend, genreCompare, scatter, heatmap, season, directors, topWorks);
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
            if (m.getCountry() != null && !m.getCountry().isBlank()) {
                // 合拍片按地区拆分计数，KPI 的"覆盖地区数"才是真实地区数
                for (String c : m.getCountry().split("/")) {
                    if (!c.isBlank()) countries.add(c.trim());
                }
            }
        }

        return new StatsOverviewDTO.KpiDTO(total, avgRating, yearMin, yearMax, countries.size());
    }

    // ---------- 辅助 ----------

    /**
     * 地区"包含"匹配：合拍片的 country 字段是完整串（" / " 分隔，
     * 如 "中国大陆 / 中国香港"），任一地区命中即算该地区作品。
     * 这样德国、意大利等传统电影强国合拍片也能计入，凑够 ≥20 部组成完整榜单。
     */
    static boolean countryContains(String movieCountry, String want) {
        if (movieCountry == null || want == null) return false;
        for (String part : movieCountry.split("/")) {
            if (part.trim().equals(want.trim())) return true;
        }
        return false;
    }

    /** 合拍片取第一个地区作为主地区（散点图着色等单值场景用） */
    static String primaryCountry(String movieCountry) {
        if (movieCountry == null || movieCountry.isBlank()) return movieCountry;
        return movieCountry.split("/")[0].trim();
    }

    /**
     * 计算列表平均值，跳过 null，空列表返回 0。
     */
    private BigDecimal avgBigDecimal(List<BigDecimal> values) {
        List<BigDecimal> cleaned = values.stream()
                .filter(Objects::nonNull)
                .toList();
        if (cleaned.isEmpty()) return BigDecimal.ZERO;
        BigDecimal sum = cleaned.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(cleaned.size()), 2, RoundingMode.HALF_UP);
    }
}
