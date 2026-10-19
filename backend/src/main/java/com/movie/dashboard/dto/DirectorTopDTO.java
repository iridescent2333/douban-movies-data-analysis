package com.movie.dashboard.dto;

import java.math.BigDecimal;

/**
 * 导演 TOP N 榜。
 */
public class DirectorTopDTO {

    private String director;

    private Long count;

    private BigDecimal avgRating;

    public DirectorTopDTO() {
    }

    public DirectorTopDTO(String director, Long count, BigDecimal avgRating) {
        this.director = director;
        this.count = count;
        this.avgRating = avgRating;
    }

    public String getDirector() {
        return director;
    }

    public void setDirector(String director) {
        this.director = director;
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
