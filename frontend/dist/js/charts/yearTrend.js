/**
 * yearTrend.js —— 图-1 年代趋势（双 Y 轴：柱=数量，折线=平均分）
 * 数据格式期望：{ years: ['1990','1991',...], counts: [..], avgRatings: [..] }
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
      legend: { data: ['电影数量', '平均评分'], top: 4 },
      grid: { left: 50, right: 50, top: 40, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.years,
        axisLabel: { rotate: 45, fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value',
          name: '数量',
          nameTextStyle: { padding: [0, 0, 0, -20] },
          position: 'left',
        },
        {
          type: 'value',
          name: '评分',
          min: 0, max: 10,
          position: 'right',
          axisLabel: { formatter: '{value}' },
        },
      ],
      series: [
        {
          name: '电影数量',
          type: 'bar',
          data: data.counts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#42AC4E' },
              { offset: 1, color: '#7dd888' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: '平均评分',
          type: 'line',
          yAxisIndex: 1,
          data: data.avgRatings,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#f0a020' },
          lineStyle: { width: 2 },
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
