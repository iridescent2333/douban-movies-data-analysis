/**
 * topDirectors.js —— Tab2 人才图谱（导演 TOP N 柱状 + 平均评分折线叠加）
 * 数据格式期望：
 *   [ { director: '张艺谋', count: 15, avgRating: 7.6 }, ... ]
 */
(function (global) {
  'use strict';

  var containerId = 'chartTopDirectors';
  var chart = null;

  function getTheme() {
    // 统一走设计令牌：主题名与配色集中由 js/theme.js 管理（app-light / app-dark）
    return global.UI_THEME ? global.UI_THEME.current()
      : (document.body.classList.contains('dark') ? 'dark' : null);
  }

  function render(data) {
    var dom = document.getElementById(containerId);
    if (!dom || !global.echarts) return;

    if (!data || data.length === 0) {
      if (chart) { chart.dispose(); chart = null; }
      global.UI_UTILS.markEmpty(containerId);
      return;
    }
    global.UI_UTILS.clearEmpty(containerId);

    if (chart) chart.dispose();
    chart = echarts.init(dom, getTheme());

    // 按数量倒序
    var sorted = data.slice().sort(function (a, b) { return b.count - a.count; });
    var names = sorted.map(function (d) { return d.director; });
    var counts = sorted.map(function (d) { return d.count; });
    var ratings = sorted.map(function (d) { return +(d.avgRating || 0).toFixed(2); });

    var option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['作品数', '平均评分'], top: 4 },
      grid: { left: 50, right: 50, top: 40, bottom: 80 },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: { rotate: 50, fontSize: 11 },
      },
      yAxis: [
        { type: 'value', name: '作品数', position: 'left' },
        { type: 'value', name: '评分', min: 0, max: 10, position: 'right' },
      ],
      series: [
        {
          name: '作品数',
          type: 'bar',
          data: counts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#fb7299' },
              { offset: 1, color: '#ffb3cd' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: '平均评分',
          type: 'line',
          yAxisIndex: 1,
          data: ratings,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#f0a020' },
          lineStyle: { width: 2 },
        },
      ],
    };

    chart.setOption(option, true);
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.topDirectors = { render: render, resize: resize, dispose: dispose };

})(window);
