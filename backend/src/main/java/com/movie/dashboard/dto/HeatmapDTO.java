package com.movie.dashboard.dto;

import java.math.BigDecimal;

/**
 * 国家 × 类型 二维热力图数据点。
 */
public class HeatmapDTO {

    private String country;

    private String genre;

    private BigDecimal avgRating;

    private Long count;

    public HeatmapDTO() {
    }

    public HeatmapDTO(String country, String genre, BigDecimal avgRating, Long count) {
        this.country = country;
        this.genre = genre;
        this.avgRating = avgRating;
        this.count = count;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getGenre() {
        return genre;
    }

    public void setGenre(String genre) {
        this.genre = genre;
    }

    public BigDecimal getAvgRating() {
        return avgRating;
    }

    public void setAvgRating(BigDecimal avgRating) {
        this.avgRating = avgRating;
    }

    public Long getCount() {
        return count;
    }

    public void setCount(Long count) {
        this.count = count;
    }
}
