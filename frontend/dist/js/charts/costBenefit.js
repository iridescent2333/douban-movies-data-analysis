/**
 * costBenefit.js —— Tab3 成本效益（散点图：X=成本区间, Y=ROI倍率, 颜色=评分）
 * 注：ECharts scatter3D 需要额外插件，这里用普通散点 + 成本离散化实现
 * 数据格式期望：
 *   [ { movie: 'xxx', cost: 1200, boxOffice: 5600, rating: 7.8 }, ... ]
 */
(function (global) {
  'use strict';

  var containerId = 'chartCostBenefit';
  var chart = null;

  function getTheme() {
    // 统一走设计令牌：主题名与配色集中由 js/theme.js 管理（app-light / app-dark）
    return global.UI_THEME ? global.UI_THEME.current()
      : (document.body.classList.contains('dark') ? 'dark' : null);
  }

  /**
   * 将成本离散到区间
   */
  function costToBucket(cost) {
    if (cost == null) return '未知';
    if (cost < 500)   return '0-500万';
    if (cost < 1500)  return '500-1500万';
    if (cost < 3000)  return '1500-3000万';
    if (cost < 8000)  return '3000-8000万';
    return '8000万以上';
  }

  var BUCKET_ORDER = ['0-500万', '500-1500万', '1500-3000万', '3000-8000万', '8000万以上'];

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

    var valid = data.filter(function (d) {
      return d.cost != null && d.boxOffice != null && d.cost > 0;
    });

    var points = valid.map(function (d) {
      var roi = d.boxOffice / d.cost;
      return {
        name: d.movie || d.title || '未知',
        value: [BUCKET_ORDER.indexOf(costToBucket(d.cost)), +roi.toFixed(2)],
        rating: d.rating,
        cost: d.cost,
        boxOffice: d.boxOffice,
      };
    });

    var option = {
      tooltip: {
        formatter: function (p) {
          var d = p.data;
          return '<b>' + d.name + '</b><br/>'
            + '成本：' + d.cost + ' 万<br/>'
            + '票房：' + d.boxOffice + ' 万<br/>'
            + 'ROI：' + p.value[1] + '×<br/>'
            + '评分：' + (d.rating != null ? d.rating : '-');
        },
      },
      grid: { left: 60, right: 40, top: 30, bottom: 50 },
      xAxis: {
        type: 'category',
        name: '成本区间',
        nameLocation: 'middle',
        nameGap: 30,
        data: BUCKET_ORDER,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: 'ROI（票房/成本）',
        nameLocation: 'middle',
        nameGap: 45,
        axisLabel: { formatter: '{value}×' },
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
        name: '成本效益',
        type: 'scatter',
        data: points,
        symbolSize: 14,
        itemStyle: { opacity: 0.75, borderColor: '#fff', borderWidth: 1 },
      }],
    };

    chart.setOption(option, true);
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.costBenefit = { render: render, resize: resize, dispose: dispose };

})(window);
