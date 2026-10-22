package com.movie.dashboard.service;

import com.movie.dashboard.dto.*;
import com.movie.dashboard.entity.Genre;
import com.movie.dashboard.entity.Movie;
import com.movie.dashboard.exception.GlobalExceptionHandler;
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
import java.util.List;
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
     * 多条件筛选 + 分页。
     * <p>
     * 当 genres 传了多个时，语义为"同时包含所有选中类型"（AND）。
     * 注意：多类型必须在分页之前完成过滤——
     * 若先分页再在内存里做 AND 补齐，命中数量少的组合（如"科幻+动作"仅 9 部）
     * 会因为第一页恰好都不满足而被过滤成空列表。
     * </p>
     */
    @Transactional(readOnly = true)
    public Page<MovieDTO> getMovies(MovieQueryDTO q) {
        List<String> requiredGenres = q.getGenres();
        boolean multiGenre = requiredGenres != null && requiredGenres.size() > 1;

        // 把多个 genres 拍扁为一个 primaryGenre 先过 SQL，避免 INNER JOIN 笛卡儿积
        String primaryGenre = (requiredGenres != null && !requiredGenres.isEmpty())
                ? requiredGenres.get(0) : null;

        int pageNo = q.getPage() == null ? 0 : Math.max(0, q.getPage());
        int size = q.getSize() == null ? 20 : Math.max(1, q.getSize());
        Pageable pageable = PageRequest.of(pageNo, size);

        // 多类型：先取全量（数据量仅数百条，开销可忽略），过滤后再手动分页
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
            return new PageImpl<>(content.subList(from, to), pageable, total);
        }
        return new PageImpl<>(content, pageable, page.getTotalElements());
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
     */
    @Transactional(readOnly = true)
    public FilterOptionsDTO getFilterOptions() {
        List<Integer> years = movieRepository.findDistinctYears();
        List<String> countries = movieRepository.findDistinctCountries();
        List<String> genres = genreRepository.findAll().stream()
                .map(Genre::getName).sorted().collect(Collectors.toList());
        return new FilterOptionsDTO(years, countries, genres);
    }

    // ---------- 私有转换 ----------

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
        d.setGenres(m.getGenres() == null ? Collections.emptyList()
                : m.getGenres().stream().map(Genre::getName).collect(Collectors.toList()));
        if (m.getFinancial() != null) {
            MovieDetailDTO.FinancialInfo fi = new MovieDetailDTO.FinancialInfo();
            fi.setBudgetWan(m.getFinancial().getBudgetWan());
            fi.setBoxOfficeWan(m.getFinancial().getBoxOfficeWan());
            fi.setReleaseDate(m.getFinancial().getReleaseDate());
            fi.setSeasonTag(m.getFinancial().getSeasonTag());
            d.setFinancial(fi);
        }
        return d;
    }
}
