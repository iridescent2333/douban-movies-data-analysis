package com.movie.dashboard.dto;

import java.math.BigDecimal;

/**
 * 年份趋势统计（折线图）。
 * <p>
 * 对应图表：每年电影数量 / 平均评分 / 平均票房。
 * </p>
 */
public class YearTrendDTO {

    private Integer year;

    private Long count;

    private BigDecimal avgRating;

    private BigDecimal avgBoxOffice;

    public YearTrendDTO() {
    }

    public YearTrendDTO(Integer year, Long count, BigDecimal avgRating, BigDecimal avgBoxOffice) {
        this.year = year;
        this.count = count;
        this.avgRating = avgRating;
        this.avgBoxOffice = avgBoxOffice;
    }

    public Integer getYear() {
        return year;
    }

    public void setYear(Integer year) {
        this.year = year;
    }

    public Long getCount() {
        return count;
    }

    public void setCount(Long count) {
        this.count = count;
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
}
