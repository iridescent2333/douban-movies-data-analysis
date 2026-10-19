package com.movie.dashboard.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 电影详情 DTO。
 * <p>
 * 包含基础信息 + 类型列表 + 可选的财务数据。
 * </p>
 */
public class MovieDetailDTO {

    private Long id;
    private String title;
    private String director;
    private String leadActor;
    private String country;
    private Integer year;
    private Integer duration;
    private BigDecimal rating;
    private Integer voteCount;
    private String intro;
    private String posterUrl;

    private List<String> genres;

    private FinancialInfo financial;

    public MovieDetailDTO() {
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

    public List<String> getGenres() {
        return genres;
    }

    public void setGenres(List<String> genres) {
        this.genres = genres;
    }

    public FinancialInfo getFinancial() {
        return financial;
    }

    public void setFinancial(FinancialInfo financial) {
        this.financial = financial;
    }

    /** 内嵌财务信息：避免再写一个类 */
    public static class FinancialInfo {

        private BigDecimal budgetWan;

        private BigDecimal boxOfficeWan;

        private LocalDate releaseDate;

        private String seasonTag;

        public FinancialInfo() {
        }

        public BigDecimal getBudgetWan() {
            return budgetWan;
        }

        public void setBudgetWan(BigDecimal budgetWan) {
            this.budgetWan = budgetWan;
        }

        public BigDecimal getBoxOfficeWan() {
            return boxOfficeWan;
        }

        public void setBoxOfficeWan(BigDecimal boxOfficeWan) {
            this.boxOfficeWan = boxOfficeWan;
        }

        public LocalDate getReleaseDate() {
            return releaseDate;
        }

        public void setReleaseDate(LocalDate releaseDate) {
            this.releaseDate = releaseDate;
        }

        public String getSeasonTag() {
            return seasonTag;
        }

        public void setSeasonTag(String seasonTag) {
            this.seasonTag = seasonTag;
        }
    }
}
