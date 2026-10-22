package com.movie.dashboard.dto;

import java.util.List;

/**
 * 作品统计数据（对应课程要求 A4：评分分布、年度趋势、类型对比）。
 */
public class WorksStatsDTO {

    /** 评分分布直方图（F5）：各评分段电影数量 */
    private List<RatingDistributionDTO> ratingDistribution;

    /** 年度趋势（F6）：每年电影数 / 平均评分 / 平均票房 */
    private List<YearTrendDTO> yearTrend;

    /** 类型对比（F8）：各类型电影数 / 平均评分 / 平均票房 */
    private List<GenreCompareDTO> genreCompare;

    public WorksStatsDTO() {
    }

    public WorksStatsDTO(List<RatingDistributionDTO> ratingDistribution,
                         List<YearTrendDTO> yearTrend,
                         List<GenreCompareDTO> genreCompare) {
        this.ratingDistribution = ratingDistribution;
        this.yearTrend = yearTrend;
        this.genreCompare = genreCompare;
    }

    public List<RatingDistributionDTO> getRatingDistribution() {
        return ratingDistribution;
    }

    public void setRatingDistribution(List<RatingDistributionDTO> ratingDistribution) {
        this.ratingDistribution = ratingDistribution;
    }

    public List<YearTrendDTO> getYearTrend() {
        return yearTrend;
    }

    public void setYearTrend(List<YearTrendDTO> yearTrend) {
        this.yearTrend = yearTrend;
    }

    public List<GenreCompareDTO> getGenreCompare() {
        return genreCompare;
    }

    public void setGenreCompare(List<GenreCompareDTO> genreCompare) {
        this.genreCompare = genreCompare;
    }
}
