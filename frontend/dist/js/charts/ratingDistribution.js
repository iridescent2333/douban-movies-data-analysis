/**
 * ratingDistribution.js —— F5 评分分布直方图
 * 数据格式期望：[{ range: '7.5-8.0', count: 120, avgRating: 7.8 }, ...]
 * 交互：点击某个评分段 → 把该段作为评分筛选条件（filter:ratingClick 事件）
 */
(function (global) {
  'use strict';

  var containerId = 'chartRatingDistribution';
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

    var ranges = data.map(function (d) { return d.range; });
    var counts = data.map(function (d) { return d.count || 0; });
    var maxCount = Math.max.apply(null, counts.concat([0]));
    var base = global.UI_THEME ? global.UI_THEME.baseOption() : {};

    chart.setOption(Object.assign({}, base, {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var d = data[params[0].dataIndex];
          return '<b>' + d.range + ' 分</b><br/>'
            + '电影数量：' + (d.count || 0) + ' 部<br/>'
            + (d.avgRating != null ? ('段内平均：' + d.avgRating) : '');
        },
      },
      grid: { left: 48, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: ranges,
        axisLabel: { interval: 0, rotate: 45, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: '数量',
        minInterval: 1,
      },
      series: [{
        name: '电影数量',
        type: 'bar',
        data: counts.map(function (v, i) {
          return {
            value: v,
            itemStyle: {
              // 峰值评分段用主色高亮，其余用浅色，一眼看出"评分集中区"
              color: v === maxCount && v > 0 ? '#42AC4E' : undefined,
              borderRadius: [3, 3, 0, 0],
            },
          };
        }),
        barMaxWidth: 28,
        // 点击评分段 → 通知 main.js 写入评分筛选
        emphasis: { itemStyle: { color: '#37963f' } },
      }],
    }));

    chart.off('click');
    chart.on('click', function (params) {
      var d = data[params.dataIndex];
      if (!d) return;
      var m = /^([\d.]+)-([\d.]+)$/.exec(d.range || '');
      global.dispatchEvent(new CustomEvent('filter:ratingClick', {
        detail: { min: m ? +m[1] : null, max: m ? +m[2] : null, range: d.range },
      }));
    });
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.ratingDistribution = { render: render, resize: resize, dispose: dispose };

})(window);
