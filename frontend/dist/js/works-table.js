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
        tr.innerHTML =
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
      var frag2 = document.createDocumentFragment();
      list.forEach(function (m) {
        var card = document.createElement('div');
        card.className = 'movie-card';
        card.dataset.id = m.id;
        var ratingHtml = m.rating != null
          ? '<span class="movie-rating' + ratingClass(m.rating).trim() + '">★ ' + (+m.rating).toFixed(1) + '</span>'
          : '';
        card.innerHTML =
          '<div class="movie-poster">🎬</div>' +
          '<div class="movie-info">' +
            '<div class="movie-title">' + escapeHtml(m.title || '未命名') + '</div>' +
            '<div class="movie-meta">' +
              (m.year ? (m.year + ' · ') : '') + escapeHtml((m.genres || []).slice(0, 3).join(' / ') || '未知类型') + '<br/>' +
              '导演：' + escapeHtml(m.director || '未知导演') +
            '</div>' +
            ratingHtml +
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
