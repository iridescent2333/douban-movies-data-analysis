package com.movie.dashboard.config;

import com.movie.dashboard.entity.Genre;
import com.movie.dashboard.entity.Movie;
import com.movie.dashboard.entity.MovieFinancial;
import com.movie.dashboard.repository.GenreRepository;
import com.movie.dashboard.repository.MovieFinancialRepository;
import com.movie.dashboard.repository.MovieRepository;
import com.opencsv.CSVReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 启动时从 classpath:data/movies.csv 加载电影数据。
 * <p>
 * 只有当 movies 表为空时才执行加载；Hibernate ddl-auto: update 已在之前阶段完成建表。
 * CSV 列顺序：id,title,director,actors,genres,country,year,runtime,rating,
 *           votes,synopsis,budget,box_office,release_date,slot
 * </p>
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final int BATCH_SIZE = 50;

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private GenreRepository genreRepository;

    @Autowired
    private MovieFinancialRepository financialRepository;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager em;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        long existing = movieRepository.count();
        if (existing > 0) {
            log.info("[DataInit] movies 表已有 {} 条数据，跳过加载。", existing);
            return;
        }

        log.info("[DataInit] movies 表为空，开始从 CSV 加载数据...");
        long t0 = System.currentTimeMillis();

        // 1) 读 CSV
        ClassPathResource resource = new ClassPathResource("data/movies.csv");
        try (CSVReader reader = new CSVReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {

            List<String[]> rows = reader.readAll();
            if (rows.isEmpty()) {
                log.warn("[DataInit] CSV 文件为空！");
                return;
            }

            // 跳过表头
            String[] header = rows.get(0);
            log.info("[DataInit] CSV 列: {}", String.join(" | ", header));

            // 2) 收集所有唯一 genre 名
            Set<String> genreNames = new HashSet<>();
            for (int i = 1; i < rows.size(); i++) {
                String[] row = rows.get(i);
                if (row.length >= 5 && row[4] != null) {
                    for (String g : row[4].split(";")) {
                        String name = g.trim();
                        if (!name.isEmpty()) genreNames.add(name);
                    }
                }
            }

            // 3) 保存所有 Genre（MySQL/H2 自增 ID，拿到分配的 id 做映射）
            Map<String, Genre> genreMap = new HashMap<>();
            for (String name : genreNames) {
                Genre g = new Genre();
                g.setName(name);
                genreMap.put(name, genreRepository.save(g));
            }
            log.info("[DataInit] 已保存 {} 种类型", genreMap.size());

            // 4) 逐行保存 Movie + MovieFinancial
            int movieBatch = 0, finBatch = 0, totalMovies = 0, totalFin = 0;
            for (int i = 1; i < rows.size(); i++) {
                String[] r = rows.get(i);
                Movie m = null;
                try {
                    // --- Movie ---
                    m = parseMovie(r);
                    // genres 关联
                    if (r.length >= 5 && r[4] != null) {
                        Set<Genre> gs = new HashSet<>();
                        for (String g : r[4].split(";")) {
                            String name = g.trim();
                            if (!name.isEmpty() && genreMap.containsKey(name)) {
                                gs.add(genreMap.get(name));
                            }
                        }
                        m.setGenres(gs);
                    }
                    // save 返回的才是 managed 副本，必须接回 m！否则 m 始终是 detached
                    m = movieRepository.save(m);
                    totalMovies++;
                    if (++movieBatch >= BATCH_SIZE) {
                        movieRepository.flush();
                        // flush 后实体又变 detached，merge 拉回 managed 态给下面 MovieFinancial 用
                        m = em.merge(m);
                        movieBatch = 0;
                    }
                } catch (Exception ex) {
                    log.warn("[DataInit] 跳过第 {} 行 Movie: {}", i + 1, ex.getMessage());
                    continue;
                }

                // --- MovieFinancial ---
                try {
                    String budget = safeGet(r, 11);
                    String box = safeGet(r, 12);
                    String release = safeGet(r, 13);
                    if (budget != null || box != null || release != null) {
                        MovieFinancial f = new MovieFinancial();
                        Movie movieForFin = m;
                        f.setMovie(movieForFin);
                        if (budget != null)
                            f.setBudgetWan(new BigDecimal(budget));
                        if (box != null)
                            f.setBoxOfficeWan(new BigDecimal(box));
                        if (release != null)
                            f.setReleaseDate(LocalDate.parse(release, DATE_FMT));
                        String slot = safeGet(r, 14);
                        if (slot != null) f.setSeasonTag(slot);
                        financialRepository.save(f);
                        totalFin++;
                        if (++finBatch >= BATCH_SIZE) {
                            financialRepository.flush();
                            finBatch = 0;
                        }
                    }
                } catch (Exception ex) {
                    log.warn("[DataInit] 跳过第 {} 行 MovieFinancial: {}", i + 1, ex.getMessage());
                }
            }

            movieRepository.flush();
            financialRepository.flush();

            long dt = System.currentTimeMillis() - t0;
            log.info("================================================");
            log.info("[DataInit] 加载完成！");
            log.info("  电影总数: {}  类型: {}  财务记录: {}", totalMovies, genreMap.size(), totalFin);
            log.info("  耗时: {} ms", dt);
            log.info("================================================");

        } catch (Exception e) {
            log.error("[DataInit] CSV 加载失败: {}", e.getMessage(), e);
            throw e;
        }
    }

    /** 解析 Movie 字段（CSV 列：0=id,1=title,2=director,3=actors,5=country,6=year,...） */
    private Movie parseMovie(String[] r) {
        Movie m = new Movie();
        // id 由 Hibernate 自动生成（IDENTITY），但 CSV 有 id 字段 → 显式设置
        try {
            if (safeGet(r, 0) != null) {
                m.setId(Long.parseLong(safeGet(r, 0)));
            }
        } catch (NumberFormatException ignore) {}

        m.setTitle(safeGet(r, 1));
        m.setDirector(safeGet(r, 2));
        m.setLeadActor(safeGet(r, 3));
        m.setCountry(safeGet(r, 5));
        String year = safeGet(r, 6);
        if (year != null) m.setYear(Integer.parseInt(year));
        String runtime = safeGet(r, 7);
        if (runtime != null) m.setDuration(Integer.parseInt(runtime));
        String rating = safeGet(r, 8);
        if (rating != null) m.setRating(new BigDecimal(rating));
        String votes = safeGet(r, 9);
        if (votes != null) m.setVoteCount(Integer.parseInt(votes));
        m.setIntro(safeGet(r, 10));
        return m;
    }

    private String safeGet(String[] arr, int idx) {
        if (idx < 0 || idx >= arr.length) return null;
        String v = arr[idx];
        if (v == null) return null;
        v = v.trim();
        return v.isEmpty() ? null : v;
    }
}
