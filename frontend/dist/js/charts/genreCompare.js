/**
 * genreCompare.js —— 图-2 类型评分 vs 票房对比（横向柱状图，每类型两条柱）
 * 数据格式期望：
 *   [ { genre: '动作', avgRating: 7.2, avgBoxOffice: 5200, count: 120 }, ... ]
 */
(function (global) {
  'use strict';

  var containerId = 'chartGenreCompare';
  var chart = null;

  function getTheme() {
    return document.body.classList.contains('dark') ? 'dark' : null;
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

    // 按类型数量倒序排列
    var sorted = data.slice().sort(function (a, b) { return b.count - a.count; });
    var genres = sorted.map(function (d) { return d.genre; });
    // 评分放大系数，让视觉上可比（评分×1000）
    var ratingScale = 1000;
    var ratingsScaled = sorted.map(function (d) {
      return d.avgRating != null ? +(d.avgRating * ratingScale).toFixed(1) : 0;
    });
    var boxOffices = sorted.map(function (d) {
      return d.avgBoxOffice != null ? +d.avgBoxOffice.toFixed(1) : 0;
    });

    var option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var idx = params[0].dataIndex;
          var raw = sorted[idx];
          return '<b>' + raw.genre + '</b><br/>'
            + '电影数量：' + raw.count + '<br/>'
            + '平均评分：' + (raw.avgRating || '-') + '<br/>'
            + '平均票房：' + (raw.avgBoxOffice != null ? raw.avgBoxOffice + ' 万' : '-');
        },
      },
      legend: {
        data: ['平均评分(×1000)', '平均票房(万)'],
        top: 4,
      },
      grid: { left: 70, right: 30, top: 40, bottom: 20 },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: genres,
        axisLabel: { fontSize: 12 },
      },
      series: [
        {
          name: '平均评分(×1000)',
          type: 'bar',
          data: ratingsScaled,
          itemStyle: { color: '#f0a020', borderRadius: [0, 4, 4, 0] },
        },
        {
          name: '平均票房(万)',
          type: 'bar',
          data: boxOffices,
          itemStyle: { color: '#42AC4E', borderRadius: [0, 4, 4, 0] },
        },
      ],
    };

    chart.setOption(option, true);
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.genreCompare = { render: render, resize: resize, dispose: dispose };

})(window);
