package com.movie.dashboard.dto;

import java.math.BigDecimal;

/**
 * 评分 × 热度散点（一个点 = 一部电影，全部来自豆瓣真实数据）。
 */
public class ScatterPointDTO {

    /** 豆瓣 subject id */
    private Long id;

    /** 片名 */
    private String title;

    /** 豆瓣评分（X 轴） */
    private BigDecimal rating;

    /** 评价人数（Y 轴） */
    private Integer voteCount;

    /** 制片国家/地区 */
    private String country;

    /** 第一个类型（供图例分组着色） */
    private String genre;

    public ScatterPointDTO() {
    }

    public ScatterPointDTO(Long id, String title, BigDecimal rating, Integer voteCount,
                           String country, String genre) {
        this.id = id;
        this.title = title;
        this.rating = rating;
        this.voteCount = voteCount;
        this.country = country;
        this.genre = genre;
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
}
