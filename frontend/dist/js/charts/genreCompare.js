/**
 * genreCompare.js —— F8 类型对比（柱状图 / 雷达图切换）
 * 数据格式期望：
 *   [ { genre: '动作', avgRating: 7.2, avgVotes: 5200, count: 120 }, ... ]
 *
 * 课程要求 F8：「类型对比雷达图/柱状图，对比不同类型在评分、数量上的差异」。
 * 三维度：平均评分、电影数量、平均热度（=平均评价人数，公开数据集无真实票房，禁止编造）。
 *
 * 修复点（相对旧版）：
 *   1. 柱状图改为「双 Y 轴」——左轴评分(0-10)、右轴热度(万人评价)，两维度量纲不同、同轴会失衡；
 *   2. 雷达图三个维度数值与后端严格一致，支持悬浮查看、图例点击切换显隐；
 *   3. 柱状/雷达配色统一（评分=橙、热度=粉），视觉协调；切换无白屏。
 */
(function (global) {
  'use strict';

  var containerId = 'chartGenreCompare';
  var chart = null;
  var mode = 'bar';   // 'bar' | 'radar'

  // 统一配色（与豆瓣/B站品牌色一致）
  var COLOR_RATING = '#f0a020';   // 平均评分：橙
  var COLOR_VOTES = '#fb7299';    // 平均热度：粉

  function getTheme() {
    return global.UI_THEME ? global.UI_THEME.current()
      : (document.body.classList.contains('dark') ? 'dark' : null);
  }

  function setMode(next) {
    mode = next === 'radar' ? 'radar' : 'bar';
  }

  /**
   * 把后端 GenreCompareDTO 列表整理成图表所需的平行数组。
   * 全部转成数值，避免 null 进入 ECharts 造成断点。
   */
  function prepare(data) {
    var sorted = (data || []).slice().sort(function (a, b) { return (b.count || 0) - (a.count || 0); });
    return {
      genres: sorted.map(function (d) { return d.genre; }),
      ratings: sorted.map(function (d) { return d.avgRating != null ? +d.avgRating : 0; }),
      counts: sorted.map(function (d) { return d.count || 0; }),
      // 平均热度换算成「万人评价」，便于阅读
      votesW: sorted.map(function (d) { return d.avgVotes != null ? +(d.avgVotes / 10000).toFixed(2) : 0; }),
      raw: sorted,
    };
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

    var p = prepare(data);
    var base = global.UI_THEME ? global.UI_THEME.baseOption() : {};

    var option;
    if (mode === 'radar') {
      // ---- 雷达图：三维度（评分 / 数量 / 热度），每个类型一个数据项 ----
      var maxCount = Math.max.apply(null, p.counts.concat([1]));
      var maxVotes = Math.max.apply(null, p.votesW.concat([1]));
      var palette = global.UI_THEME ? global.UI_THEME.palette() : [];
      var seriesData = p.genres.map(function (g, i) {
        return {
          name: g,
          value: [p.ratings[i], p.counts[i], p.votesW[i]],
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.08 },
          itemStyle: { color: palette.length ? palette[i % palette.length] : COLOR_RATING },
        };
      });

      option = {
        tooltip: {
          trigger: 'item',
          formatter: function (tp) {
            var i = tp.dataIndex;
            return '<b>' + p.genres[i] + '</b><br/>'
              + '电影数量：' + p.counts[i] + ' 部<br/>'
              + '平均评分：' + (p.ratings[i] ? p.ratings[i].toFixed(2) : '-') + '<br/>'
              + '平均热度：' + p.votesW[i] + ' 万人评价';
          },
        },
        legend: {
          type: 'scroll',
          top: 4,
          itemGap: 18,
          textStyle: { fontSize: 12 },
          data: p.genres,
        },
        radar: {
          indicator: [
            { name: '平均评分', max: 10 },
            { name: '电影数量', max: maxCount },
            { name: '平均热度(万人)', max: maxVotes },
          ],
          center: ['50%', '56%'],
          radius: '68%',
          axisName: { fontSize: 13, fontWeight: 600 },
          splitArea: { areaStyle: { opacity: 0.06 } },
          splitLine: { lineStyle: { width: 1 } },
        },
        series: [{
          type: 'radar',
          data: seriesData,
          symbolSize: 5,
          emphasis: { lineStyle: { width: 3 } },
        }],
      };
    } else {
      // ---- 柱状图：双 Y 轴（左=评分 0-10，右=热度 万人） ----
      option = {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: function (ps) {
            var i = ps[0].dataIndex;
            return '<b>' + p.genres[i] + '</b><br/>'
              + '电影数量：' + p.counts[i] + ' 部<br/>'
              + '平均评分：' + (p.ratings[i] ? p.ratings[i].toFixed(2) : '-') + '<br/>'
              + '平均热度：' + p.votesW[i] + ' 万人评价';
          },
        },
        legend: {
          data: ['平均评分', '平均热度(万人评价)'],
          top: 4,
        },
        grid: { left: 70, right: 70, top: 44, bottom: 24 },
        xAxis: {
          type: 'category',
          data: p.genres,
          axisLabel: { fontSize: 12, interval: 0, rotate: p.genres.length > 8 ? 28 : 0 },
        },
        yAxis: [
          {
            type: 'value', name: '平均评分', min: 0, max: 10,
            position: 'left',
            axisLabel: { formatter: '{value}' },
            splitLine: { lineStyle: { type: 'dashed', opacity: 0.5 } },
          },
          {
            type: 'value', name: '万人评价', min: 0,
            position: 'right',
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: '平均评分',
            type: 'bar',
            yAxisIndex: 0,
            data: p.ratings,
            itemStyle: { color: COLOR_RATING, borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 26,
          },
          {
            name: '平均热度(万人评价)',
            type: 'bar',
            yAxisIndex: 1,
            data: p.votesW,
            itemStyle: { color: COLOR_VOTES, borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 26,
          },
        ],
      };
    }

    chart.setOption(Object.assign({}, base, option), true);

    chart.off('click');
    chart.on('click', function (params) {
      var name = params.name || (params.data && params.data.name);
      if (name) {
        global.dispatchEvent(new CustomEvent('filter:genreClick', { detail: { genre: name } }));
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
