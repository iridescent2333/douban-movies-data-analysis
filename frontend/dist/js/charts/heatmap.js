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
    // 第 4 维是该格的影片数量，用于 tooltip 展示
    var heatData = (data.data || []).map(function (d) {
      return [d[1], d[0], d[2], d[3]];
    });

    var option = {
      tooltip: {
        position: 'top',
        formatter: function (p) {
          var c = data.countries[p.value[1]];
          var g = data.genres[p.value[0]];
          var v = p.value[2];
          return '<b>' + c + ' · ' + g + '</b><br/>平均评分：' + (v != null ? v.toFixed(2) : '-')
            + (p.value[3] != null ? '<br/>影片数：' + p.value[3] + ' 部' : '');
        },
      },
      grid: { left: 110, right: 70, top: 24, bottom: 72 },
      xAxis: {
        type: 'category',
        data: data.genres,
        splitArea: { show: true },
        axisLabel: { rotate: 35, fontSize: 12 },
      },
      yAxis: {
        type: 'category',
        data: data.countries,
        splitArea: { show: true },
        axisLabel: { fontSize: 12 },
      },
      visualMap: {
        min: 6,
        max: 9.5,
        calculable: true,
        orient: 'vertical',
        right: 10,
        top: 'center',
        inRange: {
          // 低分青蓝 → 中分米白 → 高分橙红，比杂色带更易读
          color: ['#5b8ff9', '#9ec2ff', '#f6f0c8', '#f6bd6a', '#e8684a', '#d7263d'],
        },
        textStyle: { fontSize: 11 },
        text: ['高分', '低分'],
      },
      series: [{
        name: '平均评分',
        type: 'heatmap',
        data: heatData,
        label: {
          show: true,
          fontSize: 11,
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
