/**
 * seasonAnalysis.js —— Tab1 档期分析（气泡图）
 * X=档期, Y=类型, 气泡大小=平均票房, 颜色=平均评分
 * 数据格式期望：
 *   [ { season: '春节档', genre: '喜剧', avgBoxOffice: 3200, avgRating: 7.4, count: 20 }, ... ]
 */
(function (global) {
  'use strict';

  var containerId = 'chartSeasonAnalysis';
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

    var seasons = [];
    var genres = [];
    data.forEach(function (d) {
      if (seasons.indexOf(d.season) === -1) seasons.push(d.season);
      if (genres.indexOf(d.genre) === -1) genres.push(d.genre);
    });

    // 气泡大小：按票房做归一化
    var maxBO = Math.max.apply(null, data.map(function (d) { return d.avgBoxOffice || 0; }));
    function boToSize(bo) {
      if (!bo) return 8;
      return 8 + (bo / Math.max(maxBO, 1)) * 40;
    }

    var scatterData = data.map(function (d) {
      return {
        name: d.season + ' · ' + d.genre,
        value: [
          seasons.indexOf(d.season),
          genres.indexOf(d.genre),
          d.avgRating,
          d.avgBoxOffice,
        ],
        count: d.count,
      };
    });

    var option = {
      tooltip: {
        formatter: function (p) {
          var v = p.data.value;
          return '<b>' + p.data.name + '</b><br/>'
            + '电影数：' + (p.data.count || '-') + '<br/>'
            + '平均评分：' + (v[2] != null ? v[2].toFixed(2) : '-') + '<br/>'
            + '平均票房：' + (v[3] != null ? v[3] + ' 万' : '-');
        },
      },
      grid: { left: 70, right: 60, top: 30, bottom: 70 },
      xAxis: {
        type: 'category',
        data: seasons,
        splitArea: { show: true },
        axisLabel: { rotate: 30 },
      },
      yAxis: {
        type: 'category',
        data: genres,
        splitArea: { show: true },
      },
      visualMap: {
        min: 5,
        max: 10,
        calculable: true,
        orient: 'vertical',
        right: 10,
        top: 'center',
        inRange: {
          color: ['#e04040', '#f0a020', '#42AC4E'],
        },
        textStyle: { fontSize: 11 },
      },
      series: [{
        name: '档期×类型',
        type: 'scatter',
        data: scatterData,
        symbolSize: function (val) { return boToSize(val[3]); },
        itemStyle: {
          opacity: 0.75,
          borderColor: '#fff',
          borderWidth: 1,
        },
      }],
    };

    chart.setOption(option, true);
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.seasonAnalysis = { render: render, resize: resize, dispose: dispose };

})(window);
