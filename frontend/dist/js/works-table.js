/**
 * works-table.js —— F9 作品详情表格（表格 / 卡片双视图）
 *
 * 课程要求 F9：「作品详情表格，分页展示作品列表
 * （标题、作者/导演、类型、评分、评价人数、出版/上映年份），每页 10 条」。
 *
 * 数据格式期望：Spring Data Page 结构 { content: [...], totalElements, totalPages }
 * 每行/每卡点击 → 派发 movie:open 事件，由 main.js 打开详情弹窗。
 */
(function (global) {
  'use strict';

  var view = 'table';   // 'table' | 'card'

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 海报加载失败时的默认占位图（内联 SVG data-URI，无额外请求、永可达）。
   * 60×90（2:3 豆瓣海报比例），与 .row-poster 尺寸一致，避免单元格塌陷。
   */
  var POSTER_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='60' height='90'>" +
    "<rect width='60' height='90' rx='4' fill='#eaeef4'/>" +
    "<path d='M24 33h12v24H24zM27 37v16M33 37v16' fill='none' stroke='#9aa4b2' stroke-width='1.4'/>" +
    "</svg>");

  /** 切换表格 / 卡片视图 */
  function setView(next) {
    view = next === 'card' ? 'card' : 'table';
    var tableWrap = document.getElementById('worksTableWrap');
    var grid = document.getElementById('movieGrid');
    if (tableWrap) tableWrap.hidden = view !== 'table';
    if (grid) grid.hidden = view !== 'card';
  }

  function setState(state, message) {
    var tableWrap = document.getElementById('worksTableWrap');
    var grid = document.getElementById('movieGrid');
    var body = document.getElementById('worksTableBody');
    var placeholder = document.getElementById('tablePlaceholder');

    if (state === 'loading') {
      if (body) body.innerHTML = '';
      if (grid) grid.innerHTML = '';
      if (placeholder) {
        placeholder.hidden = false;
        placeholder.textContent = message || '加载中...';
        placeholder.className = 'table-placeholder';
      }
      return;
    }
    if (placeholder) {
      if (state === 'empty' || state === 'error') {
        placeholder.hidden = false;
        placeholder.textContent = message || (state === 'empty' ? '没有匹配的作品' : '加载失败，请检查后端');
        placeholder.className = 'table-placeholder' + (state === 'error' ? ' error' : '');
      } else {
        placeholder.hidden = true;
      }
    }
  }

  function ratingClass(rating) {
    if (rating == null) return '';
    if (rating >= 9) return ' rating-top';
    if (rating >= 8) return ' rating-high';
    if (rating >= 6) return ' rating-mid';
    return ' rating-low';
  }

  /** 标题哈希 → 确定性渐变（海报加载失败时的兜底背景，与 ranking.js 同款） */
  function cardGradient(title) {
    var h = 0;
    var str = title || 'movie';
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return 'linear-gradient(150deg, hsl(' + h + ', 62%, 56%) 0%, hsl(' + ((h + 38) % 360) + ', 58%, 42%) 100%)';
  }

  /** 评价人数格式化：3225431 → 322.5万 */
  function formatVotes(n) {
    n = +n || 0;
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    return String(n);
  }

  /**
   * 渲染作品列表
   * @param {Array} list  MovieDTO 数组
   * @param {Object} page { page: 1-based, totalPages, totalElements }
   */
  function render(list, page) {
    page = page || {};
    var state = list && list.length ? 'normal' : 'empty';
    setState(state);

    var body = document.getElementById('worksTableBody');
    var grid = document.getElementById('movieGrid');

    if (!list || !list.length) return;

    if (view === 'table' && body) {
      // 表格视图：DocumentFragment 一次性插入
      var frag = document.createDocumentFragment();
      list.forEach(function (m) {
        var tr = document.createElement('tr');
        tr.dataset.id = m.id;
        tr.className = 'works-row';
        // 缩略海报：走后端代理；无海报或加载失败时回退到内置占位图，保持列宽与行高不塌陷
        var posterSrc = m.posterUrl
          ? (global.APP_CONFIG.API_BASE + '/api/works/' + m.id + '/poster')
          : POSTER_PLACEHOLDER;
        var thumb = '<img class="row-poster" src="' + posterSrc +
          '" alt="" loading="lazy" referrerpolicy="no-referrer" ' +
          'onerror="this.onerror=null;this.src=\'' + POSTER_PLACEHOLDER + '\'">';
        tr.innerHTML =
          '<td class="col-poster">' + thumb + '</td>' +
          '<td class="col-id">' + m.id + '</td>' +
          '<td class="col-title" title="' + escapeHtml(m.title) + '">' + escapeHtml(m.title || '未命名') + '</td>' +
          '<td class="col-director">' + escapeHtml(m.director || '-') + '</td>' +
          '<td class="col-genres">' + escapeHtml((m.genres || []).slice(0, 3).join(' / ') || '-') + '</td>' +
          '<td class="col-rating' + ratingClass(m.rating) + '">' +
            (m.rating != null ? (+m.rating).toFixed(1) : '-') + '</td>' +
          '<td class="col-votes">' + (m.voteCount != null ? (+m.voteCount).toLocaleString() : '-') + '</td>' +
          '<td class="col-year">' + (m.year || '-') + '</td>';
        frag.appendChild(tr);
      });
      body.innerHTML = '';
      body.appendChild(frag);
    } else if (grid) {
      // 卡片视图：5 列 × 2 行 = 每页 10 条，海报封面风格与综合热榜一致
      var frag2 = document.createDocumentFragment();
      list.forEach(function (m) {
        var card = document.createElement('div');
        card.className = 'movie-card';
        card.dataset.id = m.id;
        var title = m.title || '未命名';
        // 海报走后端代理（豆瓣 CDN 防盗链）；失败时 onerror 移除 img，露出渐变底+片名
        var posterImg = m.posterUrl
          ? '<img class="card-poster-img" src="' + (global.APP_CONFIG.API_BASE + '/api/works/' + m.id + '/poster') +
            '" alt="' + escapeHtml(title) + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">'
          : '';
        card.innerHTML =
          '<div class="movie-poster" style="background:' + cardGradient(title) + '">' +
            posterImg +
            (m.rating != null
              ? '<span class="card-rating' + ratingClass(m.rating) + '">★ ' + (+m.rating).toFixed(1) + '</span>'
              : '') +
            '<span class="card-poster-title">' + escapeHtml(title) + '</span>' +
          '</div>' +
          '<div class="movie-info">' +
            '<div class="movie-title" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</div>' +
            '<div class="movie-meta">' +
              (m.year ? (m.year + ' · ') : '') + escapeHtml((m.genres || []).slice(0, 2).join(' / ') || '未知类型') +
            '</div>' +
            '<div class="movie-meta">' +
              '导演：' + escapeHtml(m.director || '未知') +
              (m.voteCount != null
                ? '<span class="card-votes">' + formatVotes(m.voteCount) + '人评价</span>'
                : '') +
            '</div>' +
          '</div>';
        frag2.appendChild(card);
      });
      grid.innerHTML = '';
      grid.appendChild(frag2);
    }
  }

  global.WorksTable = {
    render: render,
    setView: setView,
    setState: setState,
    escapeHtml: escapeHtml,
  };

})(window);
