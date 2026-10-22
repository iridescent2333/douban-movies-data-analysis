/**
 * scatterCostBox.js —— 评分 × 热度散点图
 * 数据格式期望：[{ movie, title, id, rating, votes, genre(国家/地区) }, ...]
 *
 * 说明：公开豆瓣数据集没有真实的制作预算/票房，为遵守"禁止编造数据"的要求，
 *       本散点图从"成本-票房"改为"评分 × 评价人数"——两个维度均为豆瓣真实数据。
 *       Y 轴（评价人数）跨度大（几千到三百多万），使用对数刻度。
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

    // 按国家/地区分组，一组一个系列（图例可勾选）
    var groups = {};
    data.forEach(function (d) {
      var key = d.genre || '其他';
      (groups[key] = groups[key] || []).push(d);
    });

    var palette = global.UI_THEME ? global.UI_THEME.palette() : [];
    var series = Object.keys(groups).slice(0, 10).map(function (key, i) {
      return {
        name: key,
        type: 'scatter',
        data: groups[key].map(function (d) {
          return {
            value: [d.rating, d.votes],
            name: d.title,
            id: d.id,
            // 气泡大小随评价人数增长（开方压缩，避免大热门把其它点压扁）
            symbolSize: Math.max(6, Math.min(26, Math.sqrt(d.votes) / 14)),
            itemStyle: { color: palette[i % palette.length], opacity: 0.65 },
          };
        }),
      };
    });

    var base = global.UI_THEME ? global.UI_THEME.baseOption() : {};
    chart.setOption(Object.assign({}, base, {
      tooltip: {
        trigger: 'item',
        formatter: function (p) {
          return '<b>' + p.data.name + '</b><br/>'
            + '豆瓣评分：' + p.value[0] + '<br/>'
            + '评价人数：' + p.value[1].toLocaleString() + '<br/>'
            + '地区：' + p.seriesName;
        },
      },
      legend: { top: 2, type: 'scroll', textStyle: { fontSize: 11 } },
      grid: { left: 56, right: 24, top: 34, bottom: 34 },
      xAxis: {
        type: 'value',
        name: '豆瓣评分',
        nameLocation: 'middle', nameGap: 24,
        min: 2, max: 10,
      },
      yAxis: {
        type: 'log',                       // 评价人数跨度大，对数轴才能铺开
        name: '评价人数',
        axisLabel: {
          formatter: function (v) {
            return v >= 10000 ? (v / 10000) + '万' : v;
          },
        },
      },
      series: series,
    }));
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.scatterCostBox = { render: render, resize: resize, dispose: dispose };

})(window);
