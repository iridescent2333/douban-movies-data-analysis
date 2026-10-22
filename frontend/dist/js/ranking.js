/**
 * ranking.js —— 豆瓣/B 站风格影片排行榜
 *
 * 设计目标（用户要求）：不要"全是表格数据的专业分析"，要像豆瓣/B 站影视榜单那样
 * 普通观众也能轻松读——封面、排名、标题、年份、导演、主要演员、故事梗概一目了然。
 *
 * 数据格式期望：[{ id, title, year, rating, voteCount, director, leadActor, genres, country, intro }, ...]
 *
 * 说明：数据集没有真实海报图，封面用「标题哈希 → 确定性渐变 + 标题文字」生成，
 *       同一部影片每次打开颜色一致，风格统一且完全离线可用。
 */
(function (global) {
  'use strict';

  /** 标题 → 色相哈希，保证同一影片封面颜色稳定 */
  function hueOf(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  /** 生成封面背景（双色渐变，同一影片恒定） */
  function coverBackground(title) {
    var h = hueOf(title || 'movie');
    var h2 = (h + 38) % 360;
    return 'linear-gradient(150deg, hsl(' + h + ', 62%, 56%) 0%, hsl(' + h2 + ', 58%, 42%) 100%)';
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function castOf(m) {
    var cast = m.leadActor || m.cast || m.actors || '';
    if (Array.isArray(cast)) cast = cast.join(' / ');
    cast = String(cast).replace(/;\s*/g, ' / ').trim();
    return cast || '暂无主演信息';
  }

  function ratingClass(rating) {
    if (rating == null) return '';
    if (rating >= 9) return ' rating-top';
    if (rating >= 8) return ' rating-high';
    if (rating >= 6) return ' rating-mid';
    return ' rating-low';
  }

  /**
   * 渲染排行榜
   * @param {Array}  list      影片数组
   * @param {Object} options   { containerId, startRank: 起始排名(默认1), compact: 是否紧凑模式 }
   */
  function render(list, options) {
    options = options || {};
    var containerId = options.containerId || 'rankList-overall';
    var startRank = options.startRank || 1;
    var compact = !!options.compact;

    var box = document.getElementById(containerId);
    if (!box) return;

    if (!list || !list.length) {
      box.innerHTML = '<div class="rank-empty">暂无符合条件的影片，换个筛选条件试试</div>';
      return;
    }

    var frag = document.createDocumentFragment();
    list.forEach(function (m, i) {
      var rank = startRank + i;
      var rankCls = rank <= 3 ? ' top' + rank : '';
      var title = m.title || '未命名';

      var item = document.createElement('div');
      item.className = 'rank-item';
      item.dataset.id = m.id;

      var genres = (m.genres || []);
      var tagsHtml = genres.slice(0, 4).map(function (g) {
        return '<span class="rank-tag">' + escapeHtml(g) + '</span>';
      }).join('');
      if (m.country) {
        tagsHtml += '<span class="rank-tag blue">' + escapeHtml(m.country) + '</span>';
      }

      item.innerHTML =
        '<div class="rank-no' + rankCls + '">' + rank + '</div>' +
        '<div class="rank-cover" style="background:' + coverBackground(title) + '">' +
          '<span class="cover-rating">' + (m.rating != null ? (+m.rating).toFixed(1) : '-') + '</span>' +
          '<span class="cover-title">' + escapeHtml(title) + '</span>' +
        '</div>' +
        '<div class="rank-info">' +
          '<div class="rank-title">' + escapeHtml(title) +
            '<span class="rank-rating' + ratingClass(m.rating) + '">★ ' + (m.rating != null ? (+m.rating).toFixed(1) : '-') + '</span>' +
            (m.voteCount != null
              ? '<span class="rank-votes">' + (+m.voteCount).toLocaleString() + ' 人评价</span>'
              : '') +
          '</div>' +
          '<div class="rank-meta">' +
            '<b>' + (m.year || '----') + '</b> 年' +
            (genres.length ? ' · ' + escapeHtml(genres.slice(0, 4).join(' / ')) : '') +
            (m.country ? ' · ' + escapeHtml(m.country) : '') +
          '</div>' +
          '<div class="rank-meta">导演：' + escapeHtml(m.director || '未知') +
            '　主演：' + escapeHtml(castOf(m)) + '</div>' +
          (m.intro ? '<div class="rank-intro">' + escapeHtml(m.intro) + '</div>' : '') +
          (tagsHtml ? '<div class="rank-tags">' + tagsHtml + '</div>' : '') +
        '</div>';

      frag.appendChild(item);
    });

    box.innerHTML = '';
    box.appendChild(frag);
  }

  /** 加载态 */
  function setLoading(containerId, text) {
    var box = document.getElementById(containerId);
    if (box) box.innerHTML = '<div class="rank-empty">' + escapeHtml(text || '加载中...') + '</div>';
  }

  global.Ranking = {
    render: render,
    setLoading: setLoading,
    escapeHtml: escapeHtml,
    coverBackground: coverBackground,
  };

})(window);
