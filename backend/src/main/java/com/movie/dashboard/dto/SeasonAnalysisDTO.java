package com.movie.dashboard.dto;

import java.math.BigDecimal;

/**
 * 档期 × 类型 交叉分析。
 */
public class SeasonAnalysisDTO {

    private String seasonTag;

    private String genre;

    private BigDecimal avgBoxOffice;

    private BigDecimal avgRating;

    private Long count;

    public SeasonAnalysisDTO() {
    }

    public SeasonAnalysisDTO(String seasonTag, String genre, BigDecimal avgBoxOffice,
                             BigDecimal avgRating, Long count) {
        this.seasonTag = seasonTag;
        this.genre = genre;
        this.avgBoxOffice = avgBoxOffice;
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

    public BigDecimal getAvgBoxOffice() {
        return avgBoxOffice;
    }

    public void setAvgBoxOffice(BigDecimal avgBoxOffice) {
        this.avgBoxOffice = avgBoxOffice;
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
