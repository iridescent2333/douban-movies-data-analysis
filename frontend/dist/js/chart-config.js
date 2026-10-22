/**
 * chart-config.js —— 图表声明式配置表
 *
 * 扩展方式（新增一张图表只需两步）：
 *   1. 在 js/charts/ 下新建一个 IIFE 模块，挂到 window.Charts.<key> = { render, resize, dispose }
 *   2. 在下面数组里加一行声明
 *
 * 字段说明：
 *   key         图表唯一标识（同时是 window.Charts 下的模块名）
 *   containerId 图表容器 DOM id
 *   module      window.Charts 下的模块名（默认与 key 相同）
 *   source      从 payload 里取数据的字段名（payload 来自 /api/stats/overview）
 *   transform   数据转换函数名（在 main.js 注册到 ChartRegistry.transformers）
 *   tab         所属 Tab id；填了则默认懒渲染（切到该 Tab 才画）
 *   lazy        是否懒渲染，默认按是否有 tab 字段自动推断
 */
(function (global) {
  'use strict';

  global.CHART_DEFS = [
    {
      key: 'yearTrend',
      containerId: 'chartYearTrend',
      source: 'yearTrend',
      transform: 'transformYearTrend',
    },
    {
      key: 'genreCompare',
      containerId: 'chartGenreCompare',
      source: 'genreCompare',
    },
    {
      key: 'scatterCostBox',
      containerId: 'chartScatterCostBox',
      source: 'scatterCostBox',
      transform: 'transformScatter',
    },
    {
      key: 'heatmap',
      containerId: 'chartHeatmap',
      source: 'heatmap',
      transform: 'transformHeatmap',
    },
    // ---- 以下 4 个在 Tab 面板内，懒渲染：切到对应 Tab 才绘制，首屏少画 4 张图 ----
    {
      key: 'seasonAnalysis',
      containerId: 'chartSeasonAnalysis',
      source: 'seasonAnalysis',
      transform: 'transformSeason',
      tab: 'seasonAnalysis',
    },
    {
      key: 'topDirectors',
      containerId: 'chartTopDirectors',
      source: 'topDirectors',
      tab: 'topDirectors',
    },
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
