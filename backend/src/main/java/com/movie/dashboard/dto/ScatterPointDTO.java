package com.movie.dashboard.dto;

import java.math.BigDecimal;

/**
 * 成本-票房散点图数据点。
 */
public class ScatterPointDTO {

    private BigDecimal budgetWan;

    private BigDecimal boxOfficeWan;

    private BigDecimal rating;

    private String title;

    private String country;

    public ScatterPointDTO() {
    }

    public ScatterPointDTO(BigDecimal budgetWan, BigDecimal boxOfficeWan, BigDecimal rating,
                           String title, String country) {
        this.budgetWan = budgetWan;
        this.boxOfficeWan = boxOfficeWan;
        this.rating = rating;
        this.title = title;
        this.country = country;
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

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }
}
