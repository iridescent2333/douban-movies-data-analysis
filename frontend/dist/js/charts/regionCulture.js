/**
 * regionCulture.js —— Tab4 地域文化（桑基图：国家 → 类型 → 评分段）
 * 数据格式期望：
 *   [ { country: '美国', genre: '动作', avgRating: 7.8, count: 30 }, ... ]
 */
(function (global) {
  'use strict';

  var containerId = 'chartRegionCulture';
  var chart = null;

  function getTheme() {
    // 统一走设计令牌：主题名与配色集中由 js/theme.js 管理（app-light / app-dark）
    return global.UI_THEME ? global.UI_THEME.current()
      : (document.body.classList.contains('dark') ? 'dark' : null);
  }

  /**
   * 将评分映射到评分段
   */
  function ratingToSegment(r) {
    if (r == null) return '未知评分';
    if (r < 6) return '6分以下';
    if (r < 7) return '6-7分';
    if (r < 8) return '7-8分';
    return '8分以上';
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

    // 构造 nodes 与 links
    var nodeSet = {};
    var nodes = [];
    function addNode(name) {
      if (!nodeSet[name]) {
        nodeSet[name] = true;
        nodes.push({ name: name });
      }
    }

    // 合并同 country→genre→segment 的 count
    var linkMap = {};
    data.forEach(function (d) {
      var seg = ratingToSegment(d.avgRating);
      var country = d.country || '未知';
      var genre = d.genre || '未知';
      addNode(country);
      addNode(genre);
      addNode(seg);

      var k1 = country + '||' + genre;
      var k2 = genre + '||' + seg;
      linkMap[k1] = (linkMap[k1] || 0) + (d.count || 1);
      linkMap[k2] = (linkMap[k2] || 0) + (d.count || 1);
    });

    var links = Object.keys(linkMap).map(function (k) {
      var parts = k.split('||');
      return { source: parts[0], target: parts[1], value: linkMap[k] };
    });

    var option = {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: function (p) {
          if (p.dataType === 'edge') {
            return p.data.source + ' → ' + p.data.target + '<br/>电影数：' + p.data.value;
          }
          return p.name;
        },
      },
      series: [{
        type: 'sankey',
        layout: 'none',
        emphasis: { focus: 'adjacency' },
        nodeAlign: 'left',
        nodeGap: 8,
        data: nodes,
        links: links,
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.5,
        },
        label: { fontSize: 11 },
      }],
    };

    chart.setOption(option, true);
  }

  function resize() { if (chart) chart.resize(); }
  function dispose() { if (chart) { chart.dispose(); chart = null; } }

  global.Charts = global.Charts || {};
  global.Charts.regionCulture = { render: render, resize: resize, dispose: dispose };

})(window);
