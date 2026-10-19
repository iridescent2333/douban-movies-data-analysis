package com.movie.dashboard.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

/**
 * 电影主实体。
 * <p>
 * 与 Genre 为多对多，由中间表 movie_genres 维护；
 * 与 MovieFinancial 为一对一，以 movie_id 作为外键。
 * </p>
 */
@Entity
@Table(name = "movies")
public class Movie {

    /** 主键，自增 */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 电影标题 */
    @Column(name = "title", nullable = false, length = 200)
    private String title;

    /** 导演 */
    @Column(name = "director", length = 100)
    private String director;

    /** 主演（可能多位，直接字符串拼接） */
    @Column(name = "lead_actor", length = 300)
    private String leadActor;

    /** 制片国家/地区 */
    @Column(name = "country", length = 50)
    private String country;

    /** 上映年份 —— 列名不用 year（H2/SQL 保留字），改用 release_year */
    @Column(name = "release_year")
    private Integer year;

    /** 片长（分钟） */
    @Column(name = "duration")
    private Integer duration;

    /** 豆瓣评分（0-10，保留 1 位小数） */
    @Column(name = "rating", precision = 3, scale = 1)
    private BigDecimal rating;

    /** 评分人数 */
    @Column(name = "vote_count")
    private Integer voteCount;

    /** 剧情简介 */
    @Column(name = "intro", columnDefinition = "TEXT")
    private String intro;

    /** 海报图片 URL */
    @Column(name = "poster_url", length = 500)
    private String posterUrl;

    /**
     * 多对多：一部电影有多个类型。
     * 中间表 movie_genres，在 SQL 中显式定义（schema.sql 已建）。
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "movie_genres",
            joinColumns = @JoinColumn(name = "movie_id"),
            inverseJoinColumns = @JoinColumn(name = "genre_id")
    )
    private Set<Genre> genres = new HashSet<>();

    /**
     * 一对一的财务数据（可选）。
     * 不做级联，财务数据由独立流程维护。
     */
    @OneToOne(mappedBy = "movie", cascade = CascadeType.REFRESH, fetch = FetchType.LAZY)
    private MovieFinancial financial;

    public Movie() {
    }

    public Movie(Long id, String title, String director, String leadActor, String country,
                 Integer year, Integer duration, BigDecimal rating, Integer voteCount,
                 String intro, String posterUrl, Set<Genre> genres, MovieFinancial financial) {
        this.id = id;
        this.title = title;
        this.director = director;
        this.leadActor = leadActor;
        this.country = country;
        this.year = year;
        this.duration = duration;
        this.rating = rating;
        this.voteCount = voteCount;
        this.intro = intro;
        this.posterUrl = posterUrl;
        this.genres = genres;
        this.financial = financial;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDirector() {
        return director;
    }

    public void setDirector(String director) {
        this.director = director;
    }

    public String getLeadActor() {
        return leadActor;
    }

    public void setLeadActor(String leadActor) {
        this.leadActor = leadActor;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public Integer getYear() {
        return year;
    }

    public void setYear(Integer year) {
        this.year = year;
    }

    public Integer getDuration() {
        return duration;
    }

    public void setDuration(Integer duration) {
        this.duration = duration;
    }

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    public Integer getVoteCount() {
        return voteCount;
    }

    public void setVoteCount(Integer voteCount) {
        this.voteCount = voteCount;
    }

    public String getIntro() {
        return intro;
    }

    public void setIntro(String intro) {
        this.intro = intro;
    }

    public String getPosterUrl() {
        return posterUrl;
    }

    public void setPosterUrl(String posterUrl) {
        this.posterUrl = posterUrl;
    }

    public Set<Genre> getGenres() {
        return genres;
    }

    public void setGenres(Set<Genre> genres) {
        this.genres = genres;
    }

    public MovieFinancial getFinancial() {
        return financial;
    }

    public void setFinancial(MovieFinancial financial) {
        this.financial = financial;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Movie movie = (Movie) o;
        return Objects.equals(id, movie.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Movie{id=" + id + ", title='" + title + "', year=" + year
                + ", rating=" + rating + ", country='" + country + "'}";
    }
}
