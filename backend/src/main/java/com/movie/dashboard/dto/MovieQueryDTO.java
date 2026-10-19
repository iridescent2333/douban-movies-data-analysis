package com.movie.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 电影列表查询参数（请求体可选，GET 用 query 参数）。
 * <p>
 * 所有字段可为 null，表示不启用对应筛选条件。
 * </p>
 */
public class MovieQueryDTO {

    private Integer yearStart;

    private Integer yearEnd;

    private List<String> genres;

    private String country;

    private BigDecimal ratingMin;

    private BigDecimal ratingMax;

    private String title;

    private Integer page = 0;

    private Integer size = 20;

    public MovieQueryDTO() {
    }

    public Integer getYearStart() {
        return yearStart;
    }

    public void setYearStart(Integer yearStart) {
        this.yearStart = yearStart;
    }

    public Integer getYearEnd() {
        return yearEnd;
    }

    public void setYearEnd(Integer yearEnd) {
        this.yearEnd = yearEnd;
    }

    public List<String> getGenres() {
        return genres;
    }

    public void setGenres(List<String> genres) {
        this.genres = genres;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public BigDecimal getRatingMin() {
        return ratingMin;
    }

    public void setRatingMin(BigDecimal ratingMin) {
        this.ratingMin = ratingMin;
    }

    public BigDecimal getRatingMax() {
        return ratingMax;
    }

    public void setRatingMax(BigDecimal ratingMax) {
        this.ratingMax = ratingMax;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Integer getPage() {
        return page;
    }

    public void setPage(Integer page) {
        this.page = page;
    }

    public Integer getSize() {
        return size;
    }

    public void setSize(Integer size) {
        this.size = size;
    }
}
