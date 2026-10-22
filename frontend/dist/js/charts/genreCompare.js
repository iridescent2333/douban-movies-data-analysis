/**
 * genreCompare.js —— F8 类型对比（柱状图 / 雷达图切换）
 * 数据格式期望：
 *   [ { genre: '动作', avgRating: 7.2, avgVotes: 5200, count: 120 }, ... ]
 *
 * 课程要求 F8：「类型对比雷达图/柱状图，对比不同类型在评分、数量上的差异」，
 * 因此提供两种视图，由页面切换按钮驱动：
 *   bar   —— 横向双柱：平均评分（×1000 便于同轴对比）与平均热度
 *   radar —— 雷达图：平均评分 / 电影数量 / 平均热度 三个维度，一眼看出类型"偏科"
 *   （热度 = 平均评价人数；公开数据集无真实票房，禁止编造）
 */
(function (global) {
  'use strict';

  var containerId = 'chartGenreCompare';
  var chart = null;
  var mode = 'bar';   // 'bar' | 'radar'

  function getTheme() {
    // 统一走设计令牌：主题名与配色集中由 js/theme.js 管理（app-light / app-dark）
    return global.UI_THEME ? global.UI_THEME.current()
      : (document.body.classList.contains('dark') ? 'dark' : null);
  }

  /** 页面切换"柱状图/雷达图"时调用 */
  function setMode(next) {
    mode = next === 'radar' ? 'radar' : 'bar';
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
    var base = global.UI_THEME ? global.UI_THEME.baseOption() : {};
    var tooltipFormatter = function (params) {
      var raw = sorted[params[0].dataIndex];
      return '<b>' + raw.genre + '</b><br/>'
        + '电影数量：' + raw.count + '<br/>'
        + '平均评分：' + (raw.avgRating || '-') + '<br/>'
        + '平均热度：' + (raw.avgVotes != null ? (raw.avgVotes/10000).toFixed(1) + ' 万人评价' : '-');
    };

    var option;
    if (mode === 'radar') {
      // ---- 雷达图：取数量 TOP 6 的类型，避免雷达图过密拥挤 ----
      var top = sorted.slice(0, 6);
      var maxCount = Math.max.apply(null, top.map(function (d) { return d.count || 0; }).concat([1]));
      var maxBox = Math.max.apply(null, top.map(function (d) { return d.avgVotes || 0; }).concat([1])) / 10000;

      option = {
        tooltip: { trigger: 'item' },
        legend: { top: 6, itemGap: 24, textStyle: { fontSize: 13 }, data: top.map(function (d) { return d.genre; }) },
        radar: {
          indicator: [
            { name: '平均评分', max: 10 },
            { name: '电影数量', max: maxCount },
            { name: '平均热度(万人)', max: maxBox },
          ],
          center: ['50%', '56%'],
          radius: '72%',
          axisName: { fontSize: 14, fontWeight: 600 },
          splitArea: { areaStyle: { opacity: 0.06 } },
          splitLine: { lineStyle: { width: 1 } },
        },
        series: [{
          type: 'radar',
          data: top.map(function (d) {
            return {
              name: d.genre,
              value: [d.avgRating || 0, d.count || 0, d.avgVotes != null ? +(d.avgVotes/10000).toFixed(1) : 0],
            };
          }),
          symbolSize: 5,
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.1 },
        }],
      };
    } else {
      // ---- 柱状图：评分放大系数，让评分与票房可同轴对比 ----
      var ratingScale = 1000;
      var ratingsScaled = sorted.map(function (d) {
        return d.avgRating != null ? +(d.avgRating * ratingScale).toFixed(1) : 0;
      });
      var boxOffices = sorted.map(function (d) {
        return d.avgVotes != null ? +(d.avgVotes/1000).toFixed(1) : 0;   // 万人
      });

      option = {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: tooltipFormatter,
        },
        legend: {
          data: ['平均评分(×1000)', '平均热度(千人)'],
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
            name: '平均热度(千人)',
            type: 'bar',
            data: boxOffices,
            itemStyle: { color: '#fb7299', borderRadius: [0, 4, 4, 0] },
          },
        ],
      };
    }

    chart.setOption(Object.assign({}, base, option), true);

    chart.off('click');
    chart.on('click', function (params) {
      var raw = sorted[params.dataIndex];
      if (raw && raw.genre) {
        global.dispatchEvent(new CustomEvent('filter:genreClick', { detail: { genre: raw.genre } }));
      }
    });
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.genreCompare = {
    render: render, resize: resize, dispose: dispose, setMode: setMode,
  };

})(window);
