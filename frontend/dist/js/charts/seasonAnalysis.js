/**
 * seasonAnalysis.js —— 档期 × 类型 气泡图
 * X=档期, Y=类型, 气泡大小=影片数量, 颜色=平均评分
 * 数据格式期望：
 *   [ { season: '暑期档', genre: '动画', avgRating: 7.4, count: 20 }, ... ]
 *
 * 说明：公开豆瓣数据集没有真实票房字段，气泡维度从"平均票房"改为"影片数量"，
 *       档期由真实上映日期的月份映射（春季档/暑期档/秋季档/贺岁档），全部为真实数据。
 */
(function (global) {
  'use strict';

  var containerId = 'chartSeasonAnalysis';
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

    var seasons = [];
    var genres = [];
    data.forEach(function (d) {
      if (seasons.indexOf(d.season) === -1) seasons.push(d.season);
      if (genres.indexOf(d.genre) === -1) genres.push(d.genre);
    });

    // 气泡大小：按影片数量归一化
    var maxCount = Math.max.apply(null, data.map(function (d) { return d.count || 0; }));
    function countToSize(c) {
      if (!c) return 6;
      return 6 + (c / Math.max(maxCount, 1)) * 38;
    }

    var scatterData = data.map(function (d) {
      return {
        name: d.season + ' · ' + d.genre,
        value: [
          seasons.indexOf(d.season),
          genres.indexOf(d.genre),
          d.avgRating,
          d.count,
        ],
      };
    });

    var option = {
      tooltip: {
        formatter: function (p) {
          var v = p.data.value;
          return '<b>' + p.data.name + '</b><br/>'
            + '影片数量：' + (v[3] != null ? v[3] : '-') + ' 部<br/>'
            + '平均评分：' + (v[2] != null ? v[2].toFixed(2) : '-');
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
        text: ['高分', '低分'],
        inRange: {
          color: ['#ffd6c2', '#ffb027', '#fb7299'],
        },
        textStyle: { fontSize: 11 },
      },
      series: [{
        name: '档期×类型',
        type: 'scatter',
        data: scatterData,
        symbolSize: function (val) { return countToSize(val[3]); },
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
