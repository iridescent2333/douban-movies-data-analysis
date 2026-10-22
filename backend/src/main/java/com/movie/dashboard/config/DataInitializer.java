package com.movie.dashboard.config;

import com.movie.dashboard.entity.Genre;
import com.movie.dashboard.entity.Movie;
import com.movie.dashboard.repository.GenreRepository;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 启动时从 classpath:data/movies.csv 加载真实豆瓣电影数据。
 * <p>
 * 数据来源：Kaggle 公开数据集「Douban Movies Dataset」（CC0 公有领域许可，
 * 镜像仓库 https://github.com/dengfuping/douban-movies-spider ），
 * 由 {@code scripts/build_dataset.py} 清洗转换为本 CSV —— 全部为豆瓣真实电影，
 * 含真实评分、评价人数、简介与豆瓣海报 URL，无任何编造字段。
 * </p>
 * <p>
 * 只有当 movies 表为空时才执行加载（首次启动或执行过清库脚本后触发）；
 * 表结构由 Hibernate ddl-auto: update 建表。
 * CSV 按表头名解析（不依赖列顺序），列：
 * id,title,director,lead_actor,country,year,duration,rating,vote_count,
 * release_date,season_tag,intro,poster_url,link,genres
 * </p>
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private static final int BATCH_SIZE = 50;

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private GenreRepository genreRepository;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        long existing = movieRepository.count();
        if (existing > 0) {
            log.info("[DataInit] movies 表已有 {} 条数据，跳过加载。", existing);
            return;
        }

        log.info("[DataInit] movies 表为空，开始从 CSV 加载真实豆瓣电影数据...");
        long t0 = System.currentTimeMillis();

        ClassPathResource resource = new ClassPathResource("data/movies.csv");
        try (CSVReader reader = new CSVReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {

            List<String[]> rows = reader.readAll();
            if (rows.size() <= 1) {
                log.warn("[DataInit] CSV 文件为空或只有表头！");
                return;
            }

            // 1) 按表头名建立 列名 -> 下标 映射（不依赖列顺序）
            String[] header = rows.get(0);
            Map<String, Integer> col = new HashMap<>();
            for (int i = 0; i < header.length; i++) {
                col.put(header[i].trim(), i);
            }
            log.info("[DataInit] CSV 列: {}", String.join(" | ", header));

            // 2) 先收集全部类型名，建立 genres 字典
            Set<String> genreNames = new HashSet<>();
            for (int i = 1; i < rows.size(); i++) {
                for (String g : splitGenres(get(rows.get(i), col, "genres"))) {
                    genreNames.add(g);
                }
            }

            Map<String, Genre> genreMap = new HashMap<>();
            for (String name : genreNames) {
                Genre g = new Genre();
                g.setName(name);
                genreMap.put(name, genreRepository.save(g));
            }
            log.info("[DataInit] 已保存 {} 种类型", genreMap.size());

            // 3) 逐行保存 Movie（主键 = 豆瓣真实 subject id）
            int batch = 0, total = 0, skipped = 0;
            for (int i = 1; i < rows.size(); i++) {
                String[] r = rows.get(i);
                try {
                    Movie m = parseMovie(r, col);
                    Set<Genre> gs = new HashSet<>();
                    for (String g : splitGenres(get(r, col, "genres"))) {
                        gs.add(genreMap.get(g));
                    }
                    m.setGenres(gs);
                    movieRepository.save(m);
                    total++;
                    if (++batch >= BATCH_SIZE) {
                        movieRepository.flush();
                        batch = 0;
                    }
                } catch (Exception ex) {
                    skipped++;
                    log.warn("[DataInit] 跳过第 {} 行（{}）: {}", i + 1,
                            get(r, col, "title"), ex.getMessage());
                }
            }
            movieRepository.flush();

            long dt = System.currentTimeMillis() - t0;
            log.info("================================================");
            log.info("[DataInit] 真实数据加载完成！");
            log.info("  电影总数: {}  类型: {}  跳过: {}", total, genreMap.size(), skipped);
            log.info("  耗时: {} ms", dt);
            log.info("================================================");

        } catch (Exception e) {
            log.error("[DataInit] CSV 加载失败: {}", e.getMessage(), e);
            throw e;
        }
    }

    /** 按表头解析一行 Movie；主键直接使用豆瓣 subject id，保证数据可溯源 */
    private Movie parseMovie(String[] r, Map<String, Integer> col) {
        Movie m = new Movie();
        String id = get(r, col, "id");
        if (id == null) throw new IllegalArgumentException("缺少豆瓣 subject id");
        m.setId(Long.parseLong(id));

        m.setTitle(required(get(r, col, "title"), "title"));
        m.setDirector(get(r, col, "director"));
        m.setLeadActor(get(r, col, "lead_actor"));
        m.setCountry(get(r, col, "country"));

        String year = get(r, col, "year");
        if (year != null) m.setYear(Integer.parseInt(year));

        String duration = get(r, col, "duration");
        if (duration != null && !duration.isBlank()) m.setDuration(Integer.parseInt(duration));

        String rating = get(r, col, "rating");
        if (rating != null) m.setRating(new BigDecimal(rating));

        String votes = get(r, col, "vote_count");
        if (votes != null) m.setVoteCount(Integer.parseInt(votes));

        m.setIntro(get(r, col, "intro"));
        m.setPosterUrl(get(r, col, "poster_url"));
        m.setLink(get(r, col, "link"));

        String releaseDate = get(r, col, "release_date");
        if (releaseDate != null) m.setReleaseDate(LocalDate.parse(releaseDate));

        m.setSeasonTag(get(r, col, "season_tag"));
        return m;
    }

    /** 类型列形如 "剧情 ; 犯罪"，拆分为去重列表 */
    private List<String> splitGenres(String genres) {
        if (genres == null || genres.isBlank()) return List.of();
        return java.util.Arrays.stream(genres.split(";"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
    }

    private String get(String[] arr, Map<String, Integer> col, String name) {
        Integer idx = col.get(name);
        if (idx == null || idx < 0 || idx >= arr.length) return null;
        String v = arr[idx];
        if (v == null) return null;
        v = v.trim();
        return v.isEmpty() ? null : v;
    }

    private String required(String v, String field) {
        if (v == null || v.isBlank()) throw new IllegalArgumentException("缺少字段 " + field);
        return v;
    }
}
