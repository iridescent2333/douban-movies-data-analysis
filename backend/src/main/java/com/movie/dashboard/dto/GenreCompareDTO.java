package com.movie.dashboard.dto;

import java.math.BigDecimal;

/**
 * 类型对比统计（柱状图 / 雷达图）。
 */
public class GenreCompareDTO {

    private String genre;

    private BigDecimal avgRating;

    private BigDecimal avgBoxOffice;

    private Long count;

    public GenreCompareDTO() {
    }

    public GenreCompareDTO(String genre, BigDecimal avgRating, BigDecimal avgBoxOffice, Long count) {
        this.genre = genre;
        this.avgRating = avgRating;
        this.avgBoxOffice = avgBoxOffice;
        this.count = count;
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

    public BigDecimal getAvgBoxOffice() {
        return avgBoxOffice;
    }

    public void setAvgBoxOffice(BigDecimal avgBoxOffice) {
        this.avgBoxOffice = avgBoxOffice;
    }

    public Long getCount() {
        return count;
    }

    public void setCount(Long count) {
        this.count = count;
    }
}
