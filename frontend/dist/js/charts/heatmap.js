/**
 * heatmap.js —— 图-4 地区 × 类型 热力矩阵
 * 数据格式期望：
 *   {
 *     countries: ['中国','美国',...],
 *     genres:   ['动作','喜剧',...],
 *     data:     [[0,0,7.2],[0,1,6.8],...]  每项=[countryIndex, genreIndex, avgRating]
 *   }
 */
(function (global) {
  'use strict';

  var containerId = 'chartHeatmap';
  var chart = null;

  function getTheme() {
    // 统一走设计令牌：主题名与配色集中由 js/theme.js 管理（app-light / app-dark）
    return global.UI_THEME ? global.UI_THEME.current()
      : (document.body.classList.contains('dark') ? 'dark' : null);
  }

  function render(data) {
    var dom = document.getElementById(containerId);
    if (!dom || !global.echarts) return;

    if (!data || !data.countries || data.countries.length === 0 || !data.genres || data.genres.length === 0) {
      if (chart) { chart.dispose(); chart = null; }
      global.UI_UTILS.markEmpty(containerId);
      return;
    }
    global.UI_UTILS.clearEmpty(containerId);

    if (chart) chart.dispose();
    chart = echarts.init(dom, getTheme());

    // ECharts heatmap 数据格式：[xIndex, yIndex, value]
    // x 轴放 genre，y 轴放 country（符合"地区×类型"的阅读习惯）
    var heatData = (data.data || []).map(function (d) {
      // 原数据假设 [countryIdx, genreIdx, rating]，需交换 x/y
      return [d[1], d[0], d[2]];
    });

    var option = {
      tooltip: {
        position: 'top',
        formatter: function (p) {
          var c = data.countries[p.value[1]];
          var g = data.genres[p.value[0]];
          var v = p.value[2];
          return '<b>' + c + ' · ' + g + '</b><br/>平均评分：' + (v != null ? v.toFixed(2) : '-');
        },
      },
      grid: { left: 90, right: 60, top: 20, bottom: 60 },
      xAxis: {
        type: 'category',
        data: data.genres,
        splitArea: { show: true },
        axisLabel: { rotate: 45, fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: data.countries,
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max: 10,
        calculable: true,
        orient: 'vertical',
        right: 10,
        top: 'center',
        inRange: {
          color: ['#2d6e35', '#fb7299', '#ffb3cd', '#c8e6a0', '#f0e890', '#f0a020', '#e04040'],
        },
        textStyle: { fontSize: 11 },
      },
      series: [{
        name: '平均评分',
        type: 'heatmap',
        data: heatData,
        label: {
          show: true,
          fontSize: 10,
          formatter: function (p) {
            return p.value[2] != null ? p.value[2].toFixed(1) : '';
          },
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' },
        },
      }],
    };

    chart.setOption(option, true);
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.heatmap = { render: render, resize: resize, dispose: dispose };

})(window);
