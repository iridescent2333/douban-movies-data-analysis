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
     * 当 genres 传了多个时，Service 层对 Repository 的结果再做一次内存过滤，
     * 保证返回的电影"同时包含所有指定类型"（AND 语义）。
     * </p>
     */
    @Transactional(readOnly = true)
    public Page<MovieDTO> getMovies(MovieQueryDTO q) {
        // 把多个 genres 拍扁为一个 primaryGenre 先过 SQL，避免 INNER JOIN 笛卡儿积
        String primaryGenre = (q.getGenres() != null && !q.getGenres().isEmpty())
                ? q.getGenres().get(0) : null;

        Pageable pageable = PageRequest.of(
                q.getPage() == null ? 0 : q.getPage(),
                q.getSize() == null ? 20 : q.getSize());

        Page<Movie> page = movieRepository.findByMultiCriteria(
                q.getYearStart(), q.getYearEnd(), q.getCountry(),
                q.getRatingMin(), q.getRatingMax(), q.getTitle(),
                primaryGenre, pageable);

        List<String> requiredGenres = q.getGenres();
        List<MovieDTO> content = page.getContent().stream()
                .filter(m -> requiredGenres == null || requiredGenres.isEmpty()
                        || containsAllGenres(m, requiredGenres))
                .map(this::toDTO)
                .collect(Collectors.toList());

        // 如果做了二次内存过滤，count 也要重新算，保持分页一致性
        return new PageImpl<>(content, pageable,
                requiredGenres == null || requiredGenres.size() <= 1
                        ? page.getTotalElements()
                        : content.size());
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

    private MovieDTO toDTO(Movie m) {
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
