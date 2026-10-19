package com.movie.dashboard.service;

import com.movie.dashboard.dto.*;
import com.movie.dashboard.entity.Genre;
import com.movie.dashboard.entity.Movie;
import com.movie.dashboard.entity.MovieFinancial;
import com.movie.dashboard.repository.GenreRepository;
import com.movie.dashboard.repository.MovieFinancialRepository;
import com.movie.dashboard.repository.MovieRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 */
@Service
public class StatsService {

    private static final Logger log = LoggerFactory.getLogger(StatsService.class);

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private GenreRepository genreRepository;

    @Autowired
    private MovieFinancialRepository financialRepository;

    /**
     * 通用筛选：根据 MovieQueryDTO 条件过滤 movie 列表。
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
                    if (m.getGenres() == null) return false;
                    Set<String> want = new HashSet<>(q.getGenres());
                    return m.getGenres().stream().anyMatch(g -> want.contains(g.getName()));
                })
                .collect(Collectors.toList());
    }

    // ---------- 年份趋势（折线图） ----------

    /**
     * 每年电影数 / 平均评分 / 平均票房。
     */
    @Transactional(readOnly = true)
    public List<YearTrendDTO> yearTrend(MovieQueryDTO q) {
        List<Movie> movies = filterMovies(movieRepository.findAll(), q);
        List<MovieFinancial> allFin = financialRepository.findAll();
        Map<Long, BigDecimal> boxMap = allFin.stream()
                .collect(Collectors.toMap(MovieFinancial::getMovieId,
                        mf -> mf.getBoxOfficeWan() == null ? BigDecimal.ZERO : mf.getBoxOfficeWan(),
                        (a, b) -> a));

        Map<Integer, List<Movie>> byYear = movies.stream()
                .filter(m -> m.getYear() != null)
                .collect(Collectors.groupingBy(Movie::getYear, TreeMap::new, Collectors.toList()));

        List<YearTrendDTO> result = new ArrayList<>();
        for (Map.Entry<Integer, List<Movie>> e : byYear.entrySet()) {
            int year = e.getKey();
            List<Movie> ms = e.getValue();
            long count = ms.size();
            BigDecimal avgRating = avgBigDecimal(ms.stream().map(Movie::getRating).toList());
            BigDecimal avgBoxOffice = avgBigDecimal(ms.stream()
                    .map(m -> boxMap.getOrDefault(m.getId(), BigDecimal.ZERO)).toList());
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
        List<Movie> movies = filterMovies(movieRepository.findAll(), q);
        List<MovieFinancial> allFin = financialRepository.findAll();
        Map<Long, BigDecimal> boxMap = allFin.stream()
                .collect(Collectors.toMap(MovieFinancial::getMovieId,
                        mf -> mf.getBoxOfficeWan() == null ? BigDecimal.ZERO : mf.getBoxOfficeWan(),
                        (a, b) -> a));

        Map<String, List<Movie>> byGenre = new HashMap<>();
        for (Movie m : movies) {
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
                    .map(m -> boxMap.getOrDefault(m.getId(), BigDecimal.ZERO)).toList());
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
        // 先取带筛选的 movie ids
        Set<Long> validIds = filterMovies(movieRepository.findAll(), q).stream()
                .map(Movie::getId).collect(Collectors.toSet());

        List<MovieFinancial> fins = financialRepository.findAllWithBudgetOrBoxOffice();
        List<MovieFinancial> filtered = fins.stream()
                .filter(f -> validIds.contains(f.getMovieId()))
                .collect(Collectors.toList());

        Map<Long, Movie> movieMap = movieRepository.findAllById(validIds).stream()
                .collect(Collectors.toMap(Movie::getId, m -> m));

        List<ScatterPointDTO> result = new ArrayList<>();
        for (MovieFinancial mf : filtered) {
            Movie m = movieMap.get(mf.getMovieId());
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
        List<Movie> movies = filterMovies(movieRepository.findAll(), q);

        Map<String, List<Movie>> bucket = new HashMap<>();
        for (Movie m : movies) {
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
        Set<Long> validIds = filterMovies(movieRepository.findAll(), q).stream()
                .map(Movie::getId).collect(Collectors.toSet());

        List<MovieFinancial> fins = financialRepository.findAllWithBudgetOrBoxOffice();
        List<MovieFinancial> filtered = fins.stream()
                .filter(f -> validIds.contains(f.getMovieId()))
                .collect(Collectors.toList());

        Map<Long, Movie> movieMap = movieRepository.findAllById(validIds).stream()
                .collect(Collectors.toMap(Movie::getId, m -> m));

        Map<String, List<MovieFinancial>> bucket = new HashMap<>();
        for (MovieFinancial mf : filtered) {
            if (mf.getSeasonTag() == null || mf.getSeasonTag().isBlank()) continue;
            Movie m = movieMap.get(mf.getMovieId());
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
                    .map(mf -> movieMap.get(mf.getMovieId()))
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
        List<Movie> movies = filterMovies(movieRepository.findAll(), q);

        Map<String, List<Movie>> byDirector = new HashMap<>();
        for (Movie m : movies) {
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
