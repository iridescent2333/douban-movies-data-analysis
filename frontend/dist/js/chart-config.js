/**
 * chart-config.js —— 图表声明表
 *
 * 扩展方式（新增一张图表只需两步）：
 *   1. 在 js/charts/ 下新建一个 IIFE 模块，挂到 window.Charts.<key> = { render, resize, dispose }
 *   2. 在下面数组里加一行声明
 *
 * 字段说明：
 *   key         图表唯一标识（同时是 window.Charts 下的模块名）
 *   containerId 图表容器 DOM id
 *   source      从 payload 里取数据的字段名（payload 来自 /api/stats/overview）
 *   transform   数据转换函数名（在 main.js 注册到 ChartRegistry.transformers）
 *   tab         所属 Tab id；填了则默认懒渲染（切到该 Tab 才画）
 *   lazy        'visibility' = 进入视口才画（IntersectionObserver，深度分析区用）
 *
 * 与课程要求（项目需求文档三）的对应关系：
 *   F5 → ratingDistribution   F6 → yearTrend   F7 → topWorks   F8 → genreCompare
 */
(function (global) {
  'use strict';

  global.CHART_DEFS = [
    // ---- 核心图表（F5-F8，首屏渲染） ----
    {
      key: 'ratingDistribution',
      containerId: 'chartRatingDistribution',
      source: 'ratingDistribution',
    },
    {
      key: 'yearTrend',
      containerId: 'chartYearTrend',
      source: 'yearTrend',
      transform: 'transformYearTrend',
    },
    {
      key: 'topWorks',
      containerId: 'chartTopWorks',
      source: 'topWorks',
    },
    {
      key: 'genreCompare',
      containerId: 'chartGenreCompare',
      source: 'genreCompare',
    },
    // ---- 深度分析（滚动到可视区才渲染，减少首屏开销） ----
    {
      key: 'scatterCostBox',
      containerId: 'chartScatterCostBox',
      source: 'scatterCostBox',
      transform: 'transformScatter',
      lazy: 'visibility',
    },
    {
      key: 'heatmap',
      containerId: 'chartHeatmap',
      source: 'heatmap',
      transform: 'transformHeatmap',
      lazy: 'visibility',
    },
    {
      key: 'seasonAnalysis',
      containerId: 'chartSeasonAnalysis',
      source: 'seasonAnalysis',
      transform: 'transformSeason',
      lazy: 'visibility',
    },
    {
      key: 'topDirectors',
      containerId: 'chartTopDirectors',
      source: 'topDirectors',
      lazy: 'visibility',
    },
    // ---- Tab 面板内图表（切到对应 Tab 才画） ----
    {
      key: 'costBenefit',
      containerId: 'chartCostBenefit',
      source: 'scatterCostBox',
      transform: 'transformScatter',
      tab: 'costBenefit',
    },
    {
      key: 'regionCulture',
      containerId: 'chartRegionCulture',
      source: 'heatmap',
      transform: 'transformRegionCulture',
      tab: 'regionCulture',
    },
  ];

})(window);
