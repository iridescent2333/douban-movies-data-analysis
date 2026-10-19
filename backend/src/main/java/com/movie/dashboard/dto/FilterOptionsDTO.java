package com.movie.dashboard.dto;

import java.util.List;

/**
 * 供前端筛选器使用的聚合下拉数据。
 * <p>
 * 一次请求拿到所有可选的年份 / 国家 / 类型。
 * </p>
 */
public class FilterOptionsDTO {

    private List<Integer> years;

    private List<String> countries;

    private List<String> genres;

    public FilterOptionsDTO() {
    }

    public FilterOptionsDTO(List<Integer> years, List<String> countries, List<String> genres) {
        this.years = years;
        this.countries = countries;
        this.genres = genres;
    }

    public List<Integer> getYears() {
        return years;
    }

    public void setYears(List<Integer> years) {
        this.years = years;
    }

    public List<String> getCountries() {
        return countries;
    }

    public void setCountries(List<String> countries) {
        this.countries = countries;
    }

    public List<String> getGenres() {
        return genres;
    }

    public void setGenres(List<String> genres) {
        this.genres = genres;
    }
}
