/**
 * theme.js —— 设计令牌与 ECharts 主题中枢
 *
 * 为什么要有这个文件：
 *   1. 页面样式（CSS 变量）与图表样式（ECharts 主题）此前是两套独立配置，
 *      改一次配色要动 8 个图表文件 + style.css，很容易漏改导致深浅色不一致。
 *   2. 现在把「颜色 / 字体 / 分类色板 / 坐标轴 / tooltip」全部收敛到这里，
 *      后续优化 UI 观感只改本文件即可，8 个图表模块零改动。
 *
 * 用法：
 *   var t = window.UI_THEME;
 *   t.current();            // 'app-light' | 'app-dark'，传给 echarts.init(dom, theme)
 *   t.palette();            // 分类色板
 *   t.registerEChartsThemes(); // 主题切换后重新注册（颜色来自当前 CSS 变量）
 */
(function (global) {
  'use strict';

  /** 分类色板：主色为 B 站粉，与页面主色一致；相邻色相拉开，保证多系列图表可区分 */
  var PALETTE = [
    '#FB7299', '#00AEEC', '#FFB027', '#7B61FF', '#FF6B6B',
    '#3BC8A5', '#B96BD9', '#8CD44A', '#F2C94C', '#56CCF2',
  ];

  var FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, Arial, sans-serif';

  /** 读取当前生效的 CSS 变量（深色主题定义在 body.dark 上） */
  function cssVar(name, fallback) {
    var host = (document.body && document.body.classList.contains('dark'))
      ? document.body
      : document.documentElement;
    var v = global.getComputedStyle(host).getPropertyValue(name);
    return (v && v.trim()) ? v.trim() : fallback;
  }

  function isDark() {
    return !!(document.body && document.body.classList.contains('dark'));
  }

  /** 当前应使用的 ECharts 主题名 */
  function current() {
    return isDark() ? 'app-dark' : 'app-light';
  }

  /**
   * 构造一套 ECharts 主题对象。
   * 所有颜色都从 CSS 变量取，保证与页面 UI 同源。
   */
  function buildTheme(dark) {
    var text = dark ? cssVar('--text-primary', '#e8e8e8') : cssVar('--text-primary', '#1a1a1a');
    var sub = dark ? cssVar('--text-secondary', '#b0b3b8') : cssVar('--text-secondary', '#555');
    var muted = dark ? cssVar('--text-muted', '#6b7078') : cssVar('--text-muted', '#8c8c8c');
    var border = dark ? cssVar('--border', '#2d3139') : cssVar('--border', '#e5e7eb');
    var split = dark ? cssVar('--border-light', '#23272f') : cssVar('--border-light', '#eee');
    var cardBg = dark ? cssVar('--card-bg', '#1a1d24') : cssVar('--card-bg', '#ffffff');

    return {
      color: PALETTE,
      backgroundColor: 'transparent',
      textStyle: { color: text, fontFamily: FONT_FAMILY },
      title: {
        textStyle: { color: text, fontSize: 14, fontWeight: 600 },
        subtextStyle: { color: muted },
      },
      legend: { textStyle: { color: sub, fontSize: 12 } },
      tooltip: {
        backgroundColor: cardBg,
        borderColor: border,
        borderWidth: 1,
        textStyle: { color: text, fontSize: 12 },
        extraCssText: 'box-shadow:0 4px 12px rgba(0,0,0,.12);border-radius:8px;',
        axisPointer: {
          lineStyle: { color: border },
          crossStyle: { color: border },
          label: { backgroundColor: muted },
        },
      },
      categoryAxis: {
        axisLine: { lineStyle: { color: border } },
        axisTick: { lineStyle: { color: border } },
        axisLabel: { color: sub, fontSize: 11 },
        splitLine: { show: false },
        nameTextStyle: { color: sub },
      },
      valueAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: sub, fontSize: 11 },
        splitLine: { lineStyle: { color: split, type: 'dashed' } },
        nameTextStyle: { color: sub },
      },
      timeAxis: {
        axisLine: { lineStyle: { color: border } },
        axisTick: { lineStyle: { color: border } },
        axisLabel: { color: sub, fontSize: 11 },
        splitLine: { lineStyle: { color: split, type: 'dashed' } },
      },
      logAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: sub, fontSize: 11 },
        splitLine: { lineStyle: { color: split, type: 'dashed' } },
      },
      visualMap: {
        textStyle: { color: sub, fontSize: 11 },
      },
    };
  }

  /**
   * 注册两套 ECharts 主题（app-light / app-dark）。
   * ECharts 允许覆盖同名主题，因此图表模块里 getTheme() 只需返回主题名。
   */
  function registerEChartsThemes() {
    if (!global.echarts || !global.echarts.registerTheme) return false;
    global.echarts.registerTheme('app-light', buildTheme(false));
    global.echarts.registerTheme('app-dark', buildTheme(true));
    return true;
  }

  /**
   * 图表通用 option 片段：新建图表时直接展开使用，保证风格统一。
   * 用法：var option = Object.assign({ ... }, window.UI_THEME.baseOption());
   */
  function baseOption() {
    return {
      textStyle: { fontFamily: FONT_FAMILY },
      grid: { left: 56, right: 28, top: 44, bottom: 36, containLabel: true },
      tooltip: { trigger: 'axis' },
      animationDuration: 420,
      animationEasing: 'cubicOut',
    };
  }

  global.UI_THEME = {
    palette: function () { return PALETTE.slice(); },
    fontFamily: FONT_FAMILY,
    cssVar: cssVar,
    isDark: isDark,
    current: current,
    buildTheme: buildTheme,
    registerEChartsThemes: registerEChartsThemes,
    baseOption: baseOption,
  };

})(window);
