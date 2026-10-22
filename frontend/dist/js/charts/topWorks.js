/**
 * topWorks.js —— F7 热门作品 TOP 10
 * 数据格式期望：[{ id, title, director, rating, voteCount, year, genres: [...] }, ...]
 * 模式：rating=按评分降序（默认）/ votes=按评价人数降序，由页面切换按钮驱动
 */
(function (global) {
  'use strict';

  var containerId = 'chartTopWorks';
  var chart = null;
  var mode = 'rating';   // 'rating' | 'votes'

  function getTheme() {
    return global.UI_THEME ? global.UI_THEME.current()
      : (document.body.classList.contains('dark') ? 'dark' : null);
  }

  /** 页面切换"按评分/按评价人数"时调用 */
  function setMode(next) {
    mode = next === 'votes' ? 'votes' : 'rating';
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

    // 横向柱状图：ECharts 的 y 轴是类目轴，数据按"从小到大"排列，最大值才显示在顶部
    var list = data.slice().reverse();
    var titles = list.map(function (d) {
      var t = d.title || '未命名';
      return t.length > 14 ? t.slice(0, 13) + '…' : t;
    });
    var isVotes = mode === 'votes';
    var values = list.map(function (d) { return isVotes ? (d.voteCount || 0) : (d.rating || 0); });
    var base = global.UI_THEME ? global.UI_THEME.baseOption() : {};

    chart.setOption(Object.assign({}, base, {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var d = list[params[0].dataIndex];
          return '<b>' + (d.title || '未命名') + '</b><br/>'
            + '评分：' + (d.rating != null ? d.rating : '-') + '<br/>'
            + '评价人数：' + (d.voteCount != null ? (+d.voteCount).toLocaleString() : '-') + '<br/>'
            + '导演：' + (d.director || '-') + '<br/>'
            + '年份：' + (d.year || '-') + '<br/>'
            + '类型：' + ((d.genres || []).join(' / ') || '-');
        },
      },
      grid: { left: 8, right: 56, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        name: isVotes ? '评价人数' : '评分',
        axisLabel: {
          formatter: function (v) { return isVotes ? (v >= 10000 ? (v / 10000) + '万' : v) : v; },
        },
      },
      yAxis: {
        type: 'category',
        data: titles,
        axisLabel: { fontSize: 11 },
      },
      series: [{
        name: isVotes ? '评价人数' : '评分',
        type: 'bar',
        data: values,
        barMaxWidth: 16,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          fontSize: 11,
          formatter: function (p) {
            return isVotes ? (p.value >= 10000 ? (p.value / 10000).toFixed(1) + '万' : p.value) : p.value;
          },
        },
      }],
    }));

    chart.off('click');
    chart.on('click', function (params) {
      var d = list[params.dataIndex];
      if (d && d.id) {
        global.dispatchEvent(new CustomEvent('movie:open', { detail: { id: d.id } }));
      }
    });
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.topWorks = {
    render: render, resize: resize, dispose: dispose, setMode: setMode,
  };

})(window);
