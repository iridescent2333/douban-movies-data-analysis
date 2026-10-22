package com.movie.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 看板聚合数据（一次请求返回全部图表数据 + KPI）。
 * <p>
 * 背景：前端原先需要并发调用 7 个接口（6 个统计 + 1 个列表概览），
 * 后端每个统计接口都会各自全量查一次 movies / movie_financials，
 * 造成重复查询与多次网络往返。
 * <p>
 * 现在由 {@code StatsService#overview} 在一次数据加载中算出全部结果，
 * 前端只需 1 次请求即可完成整屏渲染，同时天然成为新增统计维度的扩展点。
 */
public class StatsOverviewDTO {

    /** KPI 汇总（供页面顶部 4 张卡片使用） */
    private KpiDTO kpi;

    private List<YearTrendDTO> yearTrend;

    private List<GenreCompareDTO> genreCompare;

    private List<ScatterPointDTO> scatterCostBox;

    private List<HeatmapDTO> heatmap;

    private List<SeasonAnalysisDTO> seasonAnalysis;

    private List<DirectorTopDTO> topDirectors;

    public StatsOverviewDTO() {
    }

    public StatsOverviewDTO(KpiDTO kpi,
                             List<YearTrendDTO> yearTrend,
                             List<GenreCompareDTO> genreCompare,
                             List<ScatterPointDTO> scatterCostBox,
                             List<HeatmapDTO> heatmap,
                             List<SeasonAnalysisDTO> seasonAnalysis,
                             List<DirectorTopDTO> topDirectors) {
        this.kpi = kpi;
        this.yearTrend = yearTrend;
        this.genreCompare = genreCompare;
        this.scatterCostBox = scatterCostBox;
        this.heatmap = heatmap;
        this.seasonAnalysis = seasonAnalysis;
        this.topDirectors = topDirectors;
    }

    /**
     * KPI 指标。
     */
    public static class KpiDTO {
        /** 筛选后的电影总数 */
        private long movieCount;
        /** 加权平均评分（按年份聚合后的电影数加权） */
        private BigDecimal avgRating;
        /** 最早年份 */
        private Integer yearMin;
        /** 最晚年份 */
        private Integer yearMax;
        /** 覆盖国家/地区数 */
        private long countryCount;

        public KpiDTO() {
        }

        public KpiDTO(long movieCount, BigDecimal avgRating, Integer yearMin, Integer yearMax, long countryCount) {
            this.movieCount = movieCount;
            this.avgRating = avgRating;
            this.yearMin = yearMin;
            this.yearMax = yearMax;
            this.countryCount = countryCount;
        }

        public long getMovieCount() {
            return movieCount;
        }

        public void setMovieCount(long movieCount) {
            this.movieCount = movieCount;
        }

        public BigDecimal getAvgRating() {
            return avgRating;
        }

        public void setAvgRating(BigDecimal avgRating) {
            this.avgRating = avgRating;
        }

        public Integer getYearMin() {
            return yearMin;
        }

        public void setYearMin(Integer yearMin) {
            this.yearMin = yearMin;
        }

        public Integer getYearMax() {
            return yearMax;
        }

        public void setYearMax(Integer yearMax) {
            this.yearMax = yearMax;
        }

        public long getCountryCount() {
            return countryCount;
        }

        public void setCountryCount(long countryCount) {
            this.countryCount = countryCount;
        }
    }

    public KpiDTO getKpi() {
        return kpi;
    }

    public void setKpi(KpiDTO kpi) {
        this.kpi = kpi;
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

    public List<ScatterPointDTO> getScatterCostBox() {
        return scatterCostBox;
    }

    public void setScatterCostBox(List<ScatterPointDTO> scatterCostBox) {
        this.scatterCostBox = scatterCostBox;
    }

    public List<HeatmapDTO> getHeatmap() {
        return heatmap;
    }

    public void setHeatmap(List<HeatmapDTO> heatmap) {
        this.heatmap = heatmap;
    }

    public List<SeasonAnalysisDTO> getSeasonAnalysis() {
        return seasonAnalysis;
    }

    public void setSeasonAnalysis(List<SeasonAnalysisDTO> seasonAnalysis) {
        this.seasonAnalysis = seasonAnalysis;
    }

    public List<DirectorTopDTO> getTopDirectors() {
        return topDirectors;
    }

    public void setTopDirectors(List<DirectorTopDTO> topDirectors) {
        this.topDirectors = topDirectors;
    }
}
