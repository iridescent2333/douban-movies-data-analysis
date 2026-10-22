/**
 * scatterCostBox.js —— 图-3 成本-票房散点图（气泡大小=评分 + 线性拟合线）
 * 数据格式期望：
 *   [ { movie: 'xxx', cost: 1200, boxOffice: 5600, rating: 7.8, genre: '动作' }, ... ]
 */
(function (global) {
  'use strict';

  var containerId = 'chartScatterCostBox';
  var chart = null;

  function getTheme() {
    // 统一走设计令牌：主题名与配色集中由 js/theme.js 管理（app-light / app-dark）
    return global.UI_THEME ? global.UI_THEME.current()
      : (document.body.classList.contains('dark') ? 'dark' : null);
  }

  /**
   * 最小二乘法线性回归 y = a*x + b
   * @param {number[]} xs
   * @param {number[]} ys
   * @returns {{a:number, b:number}}
   */
  function linearRegression(xs, ys) {
    var n = xs.length;
    if (n < 2) return { a: 0, b: 0 };
    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (var i = 0; i < n; i++) {
      sumX += xs[i];
      sumY += ys[i];
      sumXY += xs[i] * ys[i];
      sumX2 += xs[i] * xs[i];
    }
    var den = n * sumX2 - sumX * sumX;
    if (den === 0) return { a: 0, b: sumY / n };
    var a = (n * sumXY - sumX * sumY) / den;
    var b = (sumY - a * sumX) / n;
    return { a: a, b: b };
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

    // 过滤有 cost 与 boxOffice 的数据
    var valid = data.filter(function (d) {
      return d.cost != null && d.boxOffice != null;
    });

    // 气泡大小映射
    var minRating = 6, maxRating = 10;
    var minSize = 6, maxSize = 30;
    function ratingToSize(r) {
      if (r == null) return 10;
      var ratio = Math.max(0, Math.min(1, (r - minRating) / (maxRating - minRating)));
      return minSize + ratio * (maxSize - minSize);
    }

    var scatterData = valid.map(function (d) {
      return {
        name: d.movie || d.title || '未知',
        value: [d.cost, d.boxOffice, d.rating != null ? ratingToSize(d.rating) : 10],
        rating: d.rating,
        genre: d.genre,
      };
    });

    // 拟合线
    var xs = valid.map(function (d) { return d.cost; });
    var ys = valid.map(function (d) { return d.boxOffice; });
    var reg = linearRegression(xs, ys);
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs);
    var linePoints = [
      [minX, reg.a * minX + reg.b],
      [maxX, reg.a * maxX + reg.b],
    ];

    var option = {
      tooltip: {
        trigger: 'item',
        formatter: function (p) {
          var d = p.data;
          return '<b>' + d.name + '</b><br/>'
            + '成本：' + p.value[0] + ' 万<br/>'
            + '票房：' + p.value[1] + ' 万<br/>'
            + '评分：' + (d.rating != null ? d.rating : '-') + '<br/>'
            + (d.genre ? '类型：' + d.genre : '');
        },
      },
      grid: { left: 60, right: 30, top: 30, bottom: 50 },
      xAxis: {
        type: 'value',
        name: '成本（万）',
        nameLocation: 'middle',
        nameGap: 30,
      },
      yAxis: {
        type: 'value',
        name: '票房（万）',
        nameLocation: 'middle',
        nameGap: 40,
      },
      series: [
        {
          name: '电影',
          type: 'scatter',
          data: scatterData,
          symbolSize: function (val) { return val[2] || 10; },
          itemStyle: {
            color: function (p) {
              // 评分越高颜色越接近豆瓣绿
              var r = p.data.rating || 7;
              if (r >= 8.5) return '#fb7299';
              if (r >= 7.5) return '#ffb3cd';
              if (r >= 6.5) return '#f0a020';
              return '#e04040';
            },
            opacity: 0.75,
          },
        },
        {
          name: '拟合线',
          type: 'line',
          data: linePoints,
          smooth: false,
          showSymbol: false,
          lineStyle: { color: '#888', width: 1.5, type: 'dashed' },
          tooltip: { show: false },
        },
      ],
    };

    chart.setOption(option, true);
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.scatterCostBox = { render: render, resize: resize, dispose: dispose };

})(window);
