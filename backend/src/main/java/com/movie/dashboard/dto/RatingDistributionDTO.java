package com.movie.dashboard.dto;

import java.math.BigDecimal;

/**
 * 评分分布直方图数据（一个评分段一条）。
 * <p>
 * 对应课程要求 F5「评分分布直方图：展示不同评分段的电影数量」。
 * 评分段按 0.5 分粒度切分，覆盖 2.0 – 10.0 共 16 个桶。
 * </p>
 */
public class RatingDistributionDTO {

    /** 评分段标签，例如 "7.5-8.0" */
    private String range;

    /** 该评分段的电影数量 */
    private Long count;

    /** 该评分段的平均评分（供 tooltip 展示，冗余但直观） */
    private BigDecimal avgRating;

    public RatingDistributionDTO() {
    }

    public RatingDistributionDTO(String range, Long count, BigDecimal avgRating) {
        this.range = range;
        this.count = count;
        this.avgRating = avgRating;
    }

    public String getRange() {
        return range;
    }

    public void setRange(String range) {
        this.range = range;
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
}
