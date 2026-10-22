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
 *   page        所属页面 id（与 index.html 的 section id 后缀一致）；
 *               只有用户切到该页面时才会渲染，避免一次性绘制全部图表
 *   source      从 payload 里取数据的字段名（payload 来自 /api/stats/overview）
 *   transform   数据转换函数名（在 main.js 注册到 ChartRegistry.transformers）
 *   lazy        'visibility' = 进入视口才画（IntersectionObserver）
 *
 * 与课程要求（项目需求文档三）的对应关系：
 *   F5 → ratingDistribution   F6 → yearTrend   F8 → genreCompare
 */
(function (global) {
  'use strict';

  global.CHART_DEFS = [
    // ---- 首页 ----
    {
      key: 'ratingDistribution',
      containerId: 'chartRatingDistribution',
      source: 'ratingDistribution',
      page: 'home',
    },
    {
      key: 'yearTrend',
      containerId: 'chartYearTrend',
      source: 'yearTrend',
      transform: 'transformYearTrend',
      page: 'home',
    },
    // ---- 热度排行 / 综合热榜（F7 横向柱状图，与海报榜单同数据源） ----
    {
      key: 'topWorksBar',
      containerId: 'chartTopWorksBar',
      source: '__ranking__',        // 特殊来源：数据由 main.js 的 loadRanking 直接喂入
      page: 'rank-overall',
      noOverview: true,             // 不从 overview 取数
    },
    // ---- 数据洞察 / 类型对比（F8） ----
    {
      key: 'genreCompare',
      containerId: 'chartGenreCompare',
      source: 'genreCompare',
      page: 'insight-genre',
    },
    // ---- 数据洞察 / 深度分析（滚动到可视区才渲染） ----
    {
      key: 'scatterCostBox',
      containerId: 'chartScatterCostBox',
      source: 'scatterCostBox',
      transform: 'transformScatter',
      page: 'insight-deep',
    },
    {
      key: 'heatmap',
      containerId: 'chartHeatmap',
      source: 'heatmap',
      transform: 'transformHeatmap',
      page: 'insight-deep',
    },
    {
      key: 'seasonAnalysis',
      containerId: 'chartSeasonAnalysis',
      source: 'seasonAnalysis',
      transform: 'transformSeason',
      page: 'insight-deep',
      lazy: 'visibility',
    },
    {
      key: 'topDirectors',
      containerId: 'chartTopDirectors',
      source: 'topDirectors',
      page: 'insight-deep',
      lazy: 'visibility',
    },
  ];

})(window);
