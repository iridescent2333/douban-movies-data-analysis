package com.movie.dashboard.service;

import com.movie.dashboard.dto.*;
import com.movie.dashboard.entity.Genre;
import com.movie.dashboard.entity.Movie;
import com.movie.dashboard.repository.GenreRepository;
import com.movie.dashboard.repository.MovieRepository;
import jakarta.persistence.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 电影业务 Service。
 * <p>
 * 负责分页查询 / 详情查询 / 筛选器选项聚合，
 * 以及 Entity → DTO 的组装转换。
 * </p>
 */
@Service
public class MovieService {

    private static final Logger log = LoggerFactory.getLogger(MovieService.class);

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private GenreRepository genreRepository;

    /**
     * 多条件筛选 + 分页（返回课程要求的 {page, size, total, records} 结构）。
     * <p>
     * 当 genres 传了多个时，语义为"同时包含所有选中类型"（AND）。
     * 注意：多类型必须在分页之前完成过滤——
     * 若先分页再在内存里做 AND 补齐，命中数量少的组合
     * 会因为第一页恰好都不满足而被过滤成空列表。
     * </p>
     */
    @Transactional(readOnly = true)
    public PageResult<MovieDTO> getMovies(MovieQueryDTO q) {
        List<String> requiredGenres = q.getGenres();
        boolean multiGenre = requiredGenres != null && requiredGenres.size() > 1;

        // 把多个 genres 拍扁为一个 primaryGenre 先过 SQL，避免 INNER JOIN 笛卡儿积
        String primaryGenre = (requiredGenres != null && !requiredGenres.isEmpty())
                ? requiredGenres.get(0) : null;

        int pageNo = q.getPage() == null ? 0 : Math.max(0, q.getPage());
        int size = q.getSize() == null ? 20 : Math.max(1, q.getSize());
        Pageable pageable = PageRequest.of(pageNo, size);

        // 多类型：先取全量（数据量仅数千条，开销可忽略），过滤后再手动分页
        Page<Movie> page = movieRepository.findByMultiCriteria(
                q.getYearStart(), q.getYearEnd(), q.getCountry(),
                q.getRatingMin(), q.getRatingMax(), q.getTitle(),
                primaryGenre, multiGenre ? Pageable.unpaged() : pageable);

        List<MovieDTO> content = page.getContent().stream()
                .filter(m -> requiredGenres == null || requiredGenres.isEmpty()
                        || containsAllGenres(m, requiredGenres))
                .map(this::toDTO)
                .collect(Collectors.toList());

        if (multiGenre) {
            int total = content.size();
            int from = Math.min(pageNo * size, total);
            int to = Math.min(from + size, total);
            return PageResult.of(content.subList(from, to), pageNo, size, total);
        }
        return PageResult.of(content, pageNo, size, page.getTotalElements());
    }

    /**
     * 查询单个电影详情。
     */
    @Transactional(readOnly = true)
    public MovieDetailDTO getById(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("电影不存在: id=" + id));
        return toDetailDTO(movie);
    }

    /**
     * 聚合所有筛选器下拉：年份 / 国家 / 类型。
     * <p>
     * 国家与类型只返回"热门且有代表性"的选项（见 {@link #hotRegions} / {@link #hotGenres}），
     * 长尾小地区/冷门口碑标签不进入筛选器，保证每个选项背后都有足够数据可展示。
     * </p>
     */
    @Transactional(readOnly = true)
    public FilterOptionsDTO getFilterOptions() {
        List<Integer> years = movieRepository.findDistinctYears();
        return new FilterOptionsDTO(years, hotRegions(), hotGenres());
    }

    /** 热门地区入选门槛：该地区（含合拍）影片数 ≥ 20，保证能组成完整热榜 */
    private static final int HOT_REGION_MIN_COUNT = 20;
    /** 热门类型入选门槛：该类型影片数 ≥ 60，对应剧情/动作/喜剧/科幻/悬疑等约 17 个主流标签 */
    private static final int HOT_GENRE_MIN_COUNT = 60;

    /**
     * 热门制片地区（参考豆瓣/B站电影分区口径）：
     * 中国大陆、中国香港、中国台湾、美国、日本、韩国、英国、法国、德国、加拿大、意大利、西班牙 等。
     * <p>统计口径为"包含"：合拍片同时计入每个地区；按影片数降序返回。</p>
     */
    @Transactional(readOnly = true)
    public List<String> hotRegions() {
        Map<String, Long> counts = new HashMap<>();
        for (Movie m : movieRepository.findAll()) {
            if (m.getCountry() == null || m.getCountry().isBlank()) continue;
            for (String c : m.getCountry().split("/")) {
                String name = c.trim();
                if (!name.isEmpty()) counts.merge(name, 1L, Long::sum);
            }
        }
        return counts.entrySet().stream()
                .filter(e -> e.getValue() >= HOT_REGION_MIN_COUNT)
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    /**
     * 热门电影类型（参考豆瓣/B站分类口径）：
     * 剧情、喜剧、动作、爱情、科幻、动画、悬疑、惊悚、犯罪、奇幻、冒险、战争、历史、恐怖、家庭、传记 等。
     * <p>按影片数降序返回，只保留数量足够、有代表性的标签。</p>
     */
    @Transactional(readOnly = true)
    public List<String> hotGenres() {
        Map<String, Long> counts = new HashMap<>();
        for (Movie m : movieRepository.findAll()) {
            if (m.getGenres() == null) continue;
            for (Genre g : m.getGenres()) {
                if (g.getName() != null && !g.getName().isBlank()) counts.merge(g.getName(), 1L, Long::sum);
            }
        }
        return counts.entrySet().stream()
                .filter(e -> e.getValue() >= HOT_GENRE_MIN_COUNT)
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    // ---------- 转换 ----------

    private boolean containsAllGenres(Movie m, List<String> required) {
        if (m.getGenres() == null) return false;
        Set<String> names = m.getGenres().stream().map(Genre::getName).collect(Collectors.toSet());
        return names.containsAll(required);
    }

    /** Entity → DTO 的统一出口（StatsService 的热门作品榜也复用它） */
    public MovieDTO toDTO(Movie m) {
        MovieDTO d = new MovieDTO();
        d.setId(m.getId());
        d.setTitle(m.getTitle());
        d.setDirector(m.getDirector());
        d.setLeadActor(m.getLeadActor());
        d.setCountry(m.getCountry());
        d.setYear(m.getYear());
        d.setDuration(m.getDuration());
        d.setRating(m.getRating());
        d.setVoteCount(m.getVoteCount());
        d.setPosterUrl(m.getPosterUrl());
        d.setIntro(m.getIntro());
        d.setLink(m.getLink());
        d.setReleaseDate(m.getReleaseDate() == null ? null : m.getReleaseDate().toString());
        d.setSeasonTag(m.getSeasonTag());
        d.setGenres(m.getGenres() == null ? Collections.emptyList()
                : m.getGenres().stream().map(Genre::getName).collect(Collectors.toList()));
        return d;
    }

    private MovieDetailDTO toDetailDTO(Movie m) {
        MovieDetailDTO d = new MovieDetailDTO();
        d.setId(m.getId());
        d.setTitle(m.getTitle());
        d.setDirector(m.getDirector());
        d.setLeadActor(m.getLeadActor());
        d.setCountry(m.getCountry());
        d.setYear(m.getYear());
        d.setDuration(m.getDuration());
        d.setRating(m.getRating());
        d.setVoteCount(m.getVoteCount());
        d.setIntro(m.getIntro());
        d.setPosterUrl(m.getPosterUrl());
        d.setLink(m.getLink());
        d.setReleaseDate(m.getReleaseDate() == null ? null : m.getReleaseDate().toString());
        d.setSeasonTag(m.getSeasonTag());
        d.setGenres(m.getGenres() == null ? Collections.emptyList()
                : m.getGenres().stream().map(Genre::getName).collect(Collectors.toList()));
        return d;
    }
}
