package com.movie.dashboard.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Objects;

/**
 * 电影财务数据（预算 / 票房 / 上映日期 / 档期标签）。
 * <p>
 * 主键直接用 movie_id，与 Movie 一对一。
 * </p>
 */
@Entity
@Table(name = "movie_financials")
public class MovieFinancial {

    /** 主键：直接复用 movie_id */
    @Id
    @Column(name = "movie_id")
    private Long movieId;

    /** 关联的电影 */
    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "movie_id")
    private Movie movie;

    /** 制作预算（万元） */
    @Column(name = "budget_wan", precision = 12, scale = 2)
    private BigDecimal budgetWan;

    /** 全球/内地票房（万元） */
    @Column(name = "box_office_wan", precision = 12, scale = 2)
    private BigDecimal boxOfficeWan;

    /** 上映日期 */
    @Column(name = "release_date")
    private LocalDate releaseDate;

    /** 档期标签（如 "春节档"、"暑期档"） */
    @Column(name = "season_tag", length = 30)
    private String seasonTag;

    public MovieFinancial() {
    }

    public MovieFinancial(Long movieId, Movie movie, BigDecimal budgetWan, BigDecimal boxOfficeWan,
                          LocalDate releaseDate, String seasonTag) {
        this.movieId = movieId;
        this.movie = movie;
        this.budgetWan = budgetWan;
        this.boxOfficeWan = boxOfficeWan;
        this.releaseDate = releaseDate;
        this.seasonTag = seasonTag;
    }

    public Long getMovieId() {
        return movieId;
    }

    public void setMovieId(Long movieId) {
        this.movieId = movieId;
    }

    public Movie getMovie() {
        return movie;
    }

    public void setMovie(Movie movie) {
        this.movie = movie;
    }

    public BigDecimal getBudgetWan() {
        return budgetWan;
    }

    public void setBudgetWan(BigDecimal budgetWan) {
        this.budgetWan = budgetWan;
    }

    public BigDecimal getBoxOfficeWan() {
        return boxOfficeWan;
    }

    public void setBoxOfficeWan(BigDecimal boxOfficeWan) {
        this.boxOfficeWan = boxOfficeWan;
    }

    public LocalDate getReleaseDate() {
        return releaseDate;
    }

    public void setReleaseDate(LocalDate releaseDate) {
        this.releaseDate = releaseDate;
    }

    public String getSeasonTag() {
        return seasonTag;
    }

    public void setSeasonTag(String seasonTag) {
        this.seasonTag = seasonTag;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        MovieFinancial that = (MovieFinancial) o;
        return Objects.equals(movieId, that.movieId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(movieId);
    }

    @Override
    public String toString() {
        return "MovieFinancial{movieId=" + movieId
                + ", budgetWan=" + budgetWan
                + ", boxOfficeWan=" + boxOfficeWan
                + ", releaseDate=" + releaseDate
                + ", seasonTag='" + seasonTag + "'}";
    }
}
