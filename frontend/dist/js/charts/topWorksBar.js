/**
 * topWorksBar.js —— F7 热门 TOP10 横向柱状图（课程要求）
 * 数据格式期望：[{ id, title, rating, voteCount, ... }, ...]
 * 模式：rating=按评分（默认）/ votes=按评价人数，与下方海报榜单同数据源、同切换按钮
 */
(function (global) {
  'use strict';

  var containerId = 'chartTopWorksBar';
  var chart = null;
  var mode = 'rating';

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

    // 取 TOP10；横向柱状图的 y 轴是类目轴，数据从小到大排，最大值才显示在顶部
    var list = data.slice(0, 10).slice().reverse();
    var titles = list.map(function (d) {
      var t = d.title || '未命名';
      return t.length > 14 ? t.slice(0, 13) + '…' : t;
    });
    var isVotes = mode === 'votes';
    var values = list.map(function (d) {
      return isVotes ? (d.voteCount || 0) : (d.rating || 0);
    });
    var base = global.UI_THEME ? global.UI_THEME.baseOption() : {};

    chart.setOption(Object.assign({}, base, {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var d = list[params[0].dataIndex];
          return '<b>' + (d.title || '未命名') + '</b><br/>'
            + '豆瓣评分：' + (d.rating != null ? d.rating : '-') + '<br/>'
            + '评价人数：' + (d.voteCount != null ? (+d.voteCount).toLocaleString() : '-') + '<br/>'
            + '导演：' + (d.director || '-') + '<br/>'
            + '年份：' + (d.year || '-');
        },
      },
      grid: { left: 8, right: 56, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        name: isVotes ? '评价人数' : '豆瓣评分',
        min: isVotes ? 0 : null,
        max: isVotes ? null : 10,
        axisLabel: {
          formatter: function (v) { return isVotes && v >= 10000 ? (v / 10000) + '万' : v; },
        },
      },
      yAxis: { type: 'category', data: titles, axisLabel: { fontSize: 11 } },
      series: [{
        name: isVotes ? '评价人数' : '豆瓣评分',
        type: 'bar',
        data: values,
        barMaxWidth: 18,
        itemStyle: {
          // 渐变柱：主色自上而下变浅（B 站粉）
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#fb7299' },
            { offset: 1, color: '#ffb3cd' },
          ]),
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: 'right',
          fontSize: 11,
          color: '#9499a0',
          formatter: function (p) {
            return isVotes && p.value >= 10000 ? (p.value / 10000).toFixed(1) + '万' : p.value;
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
  global.Charts.topWorksBar = {
    render: render, resize: resize, dispose: dispose, setMode: setMode,
  };

})(window);
