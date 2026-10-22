package com.movie.dashboard.dto;

import java.math.BigDecimal;

/**
 * 档期 × 类型 交叉分析（一个桶 = 某档期下的某类型）。
 * <p>
 * 档期由真实上映日期的月份映射而来（春季档/暑期档/秋季档/贺岁档），
 * 不再包含票房字段（公开数据集无真实票房，禁止编造）。
 * </p>
 */
public class SeasonAnalysisDTO {

    /** 档期标签（由上映月份映射） */
    private String seasonTag;

    /** 电影类型 */
    private String genre;

    /** 该档期该类型的平均评分 */
    private BigDecimal avgRating;

    /** 该档期该类型的影片数量 */
    private Long count;

    public SeasonAnalysisDTO() {
    }

    public SeasonAnalysisDTO(String seasonTag, String genre, BigDecimal avgRating, Long count) {
        this.seasonTag = seasonTag;
        this.genre = genre;
        this.avgRating = avgRating;
        this.count = count;
    }

    public String getSeasonTag() {
        return seasonTag;
    }

    public void setSeasonTag(String seasonTag) {
        this.seasonTag = seasonTag;
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
