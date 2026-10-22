/**
 * yearTrend.js —— F6 年度趋势折线图
 * 数据格式期望：{ years: ['1990','1991',...], counts: [..], avgRatings: [..] }
 *
 * 课程要求 F6：「年度趋势折线图，展示各类型或总体平均评分随年份变化」，
 * 因此折线（平均评分）为主视觉、柱状（电影数量）为辅助背景，
 * 点击柱子可按该年份联动筛选。
 */
(function (global) {
  'use strict';

  var containerId = 'chartYearTrend';
  var chart = null;

  function getTheme() {
    // 统一走设计令牌：主题名与配色集中由 js/theme.js 管理（app-light / app-dark）
    return global.UI_THEME ? global.UI_THEME.current()
      : (document.body.classList.contains('dark') ? 'dark' : null);
  }

  /**
   * 渲染 / 重绘年代趋势图
   * @param {Object} data {years:[], counts:[], avgRatings:[]}
   */
  function render(data) {
    var dom = document.getElementById(containerId);
    if (!dom || !global.echarts) return;

    // 空数据占位
    if (!data || !data.years || data.years.length === 0) {
      if (chart) { chart.dispose(); chart = null; }
      global.UI_UTILS.markEmpty(containerId);
      return;
    }
    global.UI_UTILS.clearEmpty(containerId);

    if (chart) chart.dispose();
    chart = echarts.init(dom, getTheme());

    var option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['平均评分', '电影数量'], top: 4 },
      grid: { left: 50, right: 50, top: 40, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.years,
        axisLabel: { rotate: 45, fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value',
          name: '评分',
          min: 0, max: 10,
          position: 'right',
          axisLabel: { formatter: '{value}' },
        },
        {
          type: 'value',
          name: '数量',
          position: 'left',
        },
      ],
      series: [
        {
          name: '平均评分',
          type: 'line',
          yAxisIndex: 0,
          data: data.avgRatings,
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          itemStyle: { color: '#f0a020' },
          lineStyle: { width: 3 },
          areaStyle: { opacity: 0.10 },
          // 评分是主线：置顶绘制，避免被柱状遮住
          z: 3,
        },
        {
          name: '电影数量',
          type: 'bar',
          yAxisIndex: 1,
          data: data.counts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(66,172,78,0.85)' },
              { offset: 1, color: 'rgba(66,172,78,0.15)' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 18,
          z: 1,
        },
      ],
    };

    chart.setOption(option, true);

    // 点击柱子 → 触发联动筛选（派发自定义事件）
    chart.off('click');
    chart.on('click', function (params) {
      if (params.componentType === 'series' && params.seriesName === '电影数量') {
        global.dispatchEvent(new CustomEvent('filter:yearClick', {
          detail: { year: params.name },
        }));
      }
    });
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.yearTrend = { render: render, resize: resize, dispose: dispose };

})(window);
