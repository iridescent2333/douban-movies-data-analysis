/**
 * heatmap.js —— 图-4 地区 × 类型 热力矩阵
 * 数据格式期望（由 main.js 的 transformHeatmap 产出）：
 *   {
 *     countries: ['中国大陆',...,'俄罗斯'],   // 10 个核心地区 → y 轴
 *     genres:   ['剧情',...,'科幻'],          // 12 个核心类型 → x 轴
 *     data:     [[genreIdx, regionIdx, avgRating, count], ...]
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
    // transformHeatmap 给出的每项是 [genreIndex, regionIndex, avgRating, count]，
    // 直接按 [x=genreIdx, y=regionIdx] 摆放即可（曾误写成 [d[1],d[0],...] 把两轴对调，
    // 导致 genreIndex(0~11) 当成 y 去撞只有 10 项的 country 轴，奇幻/科幻两列越界丢失、
    // 且整张矩阵转置错位）。
    // 第 4 维是该格的影片数量，用于 tooltip 展示
    var heatData = (data.data || []).map(function (d) {
      return [d[0], d[1], d[2], d[3]];
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
        min: 5.5,
        max: 9,
        calculable: true,
        orient: 'vertical',
        right: 10,
        top: 'center',
        inRange: {
          // 低分冷蓝 → 青 → 金 → 橙 → 高分暖红，全程高饱和、无接近白色的中段。
          // 曾经用 6~9.5 + 含米白中段的色带，而 70% 的格子落在 6.9~8.6（中段），
          // 渲染成接近白色的浅色、融进白色背景，导致整张矩阵"看着像空白"。
          color: ['#4c8ef7', '#22b8a6', '#e8c33c', '#f5822b', '#e5493a'],
        },
        textStyle: { fontSize: 11 },
        text: ['高分', '低分'],
      },
      series: [{
        name: '平均评分',
        type: 'heatmap',
        data: heatData,
        // 格子描边：即使某格颜色偏浅，也能看清网格结构，不会糊成一片白
        itemStyle: { borderColor: 'rgba(255, 255, 255, 0.85)', borderWidth: 1 },
        label: {
          show: true,
          fontSize: 11,
          color: '#333',
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
