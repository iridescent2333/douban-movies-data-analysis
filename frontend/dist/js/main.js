/**
 * main.js —— 豆瓣电影数据洞察看板 主入口
 * 职责：
 *   1. 初始化筛选器列表（GET /api/movies/filters）
 *   2. 绑定筛选 / 明暗主题 / Tab / 分页事件
 *   3. 并发请求所有 API → 渲染对应 ECharts
 *   4. 电影列表 & 详情模态框
 *   5. 全局异常处理
 */
(function (global) {
  'use strict';

  var CONFIG = global.APP_CONFIG;
  var UI = global.UI_UTILS;
  var API = global.API;
  var Charts = global.Charts;

  /** 当前筛选条件 */
  var filterState = {
    yearStart: null,
    yearEnd: null,
    genres: [],        // 多选数组
    country: '',
    ratingMin: null,
    ratingMax: null,
    title: '',
  };

  /** 电影列表分页状态 */
  var pageState = {
    page: 1,
    size: CONFIG.DEFAULT_PAGE_SIZE,
    total: 0,
  };

  /* ============================================================
   * 1. 启动入口
   * ============================================================ */
  function bootstrap() {
    bindGlobalError();
    bindThemeToggle();
    bindTabSwitch();
    bindResize();

    // ECharts 走 CDN 引入，网络不可达时给出明确提示，避免图表无声失败
    if (!window.echarts) {
      UI.showToast('ECharts 资源加载失败，请检查网络后刷新页面', 'error');
    }

    initFilters().then(function () {
      bindFilterEvents();
      bindPagerEvents();
      bindModalClose();
      reloadAll();
    }).catch(function (err) {
      UI.showToast('初始化筛选器失败：' + (err.message || err), 'error');
    });
  }

  /* ============================================================
   * 2. 从后端拉取筛选器可选项 → 渲染 checkbox / select
   * ============================================================ */
  function initFilters() {
    return API.getWithCache('/api/movies/filters', null).then(function (data) {
      // 期望 data: { genres: [...], countries: [...], years: [...] }
      renderGenreCheckboxes(data.genres || []);
      renderCountrySelect(data.countries || []);

      // 如果后端返回了年份范围，填入占位
      if (data.years && data.years.length >= 2) {
        document.getElementById('yearStart').placeholder = data.years[0];
        document.getElementById('yearEnd').placeholder = data.years[data.years.length - 1];
      }
    });
  }

  function renderGenreCheckboxes(genres) {
    var box = document.getElementById('genreCheckboxes');
    if (!box) return;
    box.innerHTML = '';
    genres.forEach(function (g) {
      var label = document.createElement('label');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.value = g;
      input.className = 'genre-cb';
      label.appendChild(input);
      label.appendChild(document.createTextNode(g));
      box.appendChild(label);
    });
  }

  function renderCountrySelect(countries) {
    var sel = document.getElementById('countrySelect');
    if (!sel) return;
    countries.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
  }

  /* ============================================================
   * 3. 收集当前筛选条件
   * ============================================================ */
  function collectFilterState() {
    var ys = document.getElementById('yearStart').value;
    var ye = document.getElementById('yearEnd').value;
    var rm = document.getElementById('ratingMin').value;
    var rM = document.getElementById('ratingMax').value;
    var title = document.getElementById('titleSearch').value.trim();
    var country = document.getElementById('countrySelect').value;

    var genreCbs = document.querySelectorAll('.genre-cb:checked');
    var genres = [];
    genreCbs.forEach(function (cb) { genres.push(cb.value); });

    filterState = {
      yearStart: ys ? +ys : null,
      yearEnd:   ye ? +ye : null,
      genres:    genres,
      country:   country,
      ratingMin: rm ? +rm : null,
      ratingMax: rM ? +rM : null,
      title:     title,
    };
  }

  /** 把 filterState 转成后端 query 参数 */
  function filterParams() {
    var p = {};
    if (filterState.yearStart) p.yearStart = filterState.yearStart;
    if (filterState.yearEnd)   p.yearEnd   = filterState.yearEnd;
    if (filterState.genres.length) p.genres = filterState.genres.join(',');
    if (filterState.country)   p.country   = filterState.country;
    if (filterState.ratingMin) p.ratingMin = filterState.ratingMin;
    if (filterState.ratingMax) p.ratingMax = filterState.ratingMax;
    if (filterState.title)     p.title     = filterState.title;
    return p;
  }

  /* ============================================================
   * 4. 绑定筛选事件（debounce 300ms）
   * ============================================================ */
  function bindFilterEvents() {
    var trigger = UI.debounce(function () {
      collectFilterState();
      pageState.page = 1;  // 筛选后回到第 1 页
      reloadAll();
    }, CONFIG.DEBOUNCE_MS);

    // 输入类：keyup / input
    ['yearStart', 'yearEnd', 'ratingMin', 'ratingMax', 'titleSearch'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', trigger);
    });
    // checkbox / select：change
    document.getElementById('genreCheckboxes').addEventListener('change', trigger);
    document.getElementById('countrySelect').addEventListener('change', trigger);

    // 重置按钮
    document.getElementById('resetBtn').addEventListener('click', function () {
      document.getElementById('yearStart').value = '';
      document.getElementById('yearEnd').value = '';
      document.getElementById('ratingMin').value = '';
      document.getElementById('ratingMax').value = '';
      document.getElementById('titleSearch').value = '';
      document.getElementById('countrySelect').value = '';
      var cbs = document.querySelectorAll('.genre-cb');
      cbs.forEach(function (cb) { cb.checked = false; });
      collectFilterState();
      pageState.page = 1;
      reloadAll();
    });

    // 图表联动：点击年代趋势柱子 → 把该年填入筛选
    global.addEventListener('filter:yearClick', function (e) {
      var year = e.detail && e.detail.year;
      if (!year) return;
      document.getElementById('yearStart').value = year;
      document.getElementById('yearEnd').value = year;
      collectFilterState();
      pageState.page = 1;
      reloadAll();
      UI.showToast('已按 ' + year + ' 年筛选', 'success');
    });
  }

  /* ============================================================
   * 5. 绑定分页
   * ============================================================ */
  function bindPagerEvents() {
    document.getElementById('prevPage').addEventListener('click', function () {
      if (pageState.page > 1) {
        pageState.page--;
        loadMovieList();
      }
    });
    document.getElementById('nextPage').addEventListener('click', function () {
      var totalPage = Math.max(1, Math.ceil(pageState.total / pageState.size));
      if (pageState.page < totalPage) {
        pageState.page++;
        loadMovieList();
      }
    });
  }

  function updatePageInfo() {
    var totalPage = Math.max(1, Math.ceil(pageState.total / pageState.size));
    document.getElementById('pageInfo').textContent =
      pageState.page + ' / ' + totalPage;
    document.getElementById('prevPage').disabled = pageState.page <= 1;
    document.getElementById('nextPage').disabled = pageState.page >= totalPage;
  }

  /* ============================================================
   * 6. 主流程：并行请求所有 API → 渲染
   * ============================================================ */
  function reloadAll() {
    // 标记 loading
    [
      'chartYearTrend', 'chartGenreCompare', 'chartScatterCostBox', 'chartHeatmap',
      'chartSeasonAnalysis', 'chartTopDirectors', 'chartCostBenefit', 'chartRegionCulture',
    ].forEach(function (id) { UI.showLoading(id); });

    var params = filterParams();

    // 并发请求
    Promise.all([
      // KPI + 电影列表（只取 totalElements 做总数，content 用 size=1 减轻负担）
      API.get('/api/movies', Object.assign({ page: 0, size: 1 }, params)).catch(function () { return null; }),
      // 各 stats
      API.get('/api/stats/year-trend', params).catch(function () { return null; }),
      API.get('/api/stats/genre-compare', params).catch(function () { return null; }),
      API.get('/api/stats/scatter-cost-box', params).catch(function () { return null; }),
      API.get('/api/stats/heatmap', params).catch(function () { return null; }),
      API.get('/api/stats/season-analysis', params).catch(function () { return null; }),
      API.get('/api/stats/top-directors', { n: CONFIG.TOP_N }).catch(function () { return null; }),
    ]).then(function (results) {
      // 注意：顺序与 Promise.all 数组对应
      // results[0]  = movies分页数据 (拿 total + 算 KPI)
      // results[1]  = yearTrend   —— 后端返回 [{year, count, avgRating, avgBoxOffice}]
      // results[2]  = genreCompare —— 后端返回 [{genre, avgRating, avgBoxOffice, count}] ✅匹配
      // results[3]  = scatterCostBox —— 后端返回 [{budgetWan, boxOfficeWan, rating, title, country}]
      // results[4]  = heatmap   —— 后端返回 [{country, genre, avgRating, count}]
      // results[5]  = seasonAnalysis —— 后端返回 [{season, genre, avgBox, avgRating, count}]
      // results[6]  = topDirectors —— 后端返回 [{director, count, avgRating}] ✅匹配

      // ===== 数据转换层：后端扁平 DTO → 前端图表期望结构 =====
      var yearTrendData = transformYearTrend(results[1]);
      var scatterData = transformScatter(results[3]);
      var heatmapData = transformHeatmap(results[4]);
      var seasonData = transformSeason(results[5]);

      // KPI 需要三份数据：movies 总数 + yearTrend 算均分/年代跨度 + heatmap 算地区数
      renderKPIs(results[0], results[1], results[4]);
      Charts.yearTrend.render(yearTrendData);
      Charts.genreCompare.render(results[2]);
      Charts.scatterCostBox.render(scatterData);
      Charts.heatmap.render(heatmapData);
      Charts.seasonAnalysis.render(seasonData);
      Charts.topDirectors.render(results[6]);
      // costBenefit 复用散点图数据
      Charts.costBenefit.render(scatterData);
      // regionCulture 从转换后的 heatmapData 构造（直接用 countries/genres 列表）
      Charts.regionCulture.render(buildRegionCultureData(heatmapData));

      // 最后刷新电影列表到当前页码
      loadMovieList();
    }).catch(function (err) {
      UI.showToast('部分数据加载失败：' + (err.message || err), 'warning');
    });
  }

  /**
   * 从分页结果 + 统计数据推断 4 个 KPI 卡片
   * @param moviesPage  /api/movies 分页结果（Spring Data Page：{content, totalElements, ...}）
   * @param yearTrendRaw /api/stats/year-trend 原始数组 [{year, count, avgRating, avgBoxOffice}]
   * @param heatmapRaw   /api/stats/heatmap 原始数组 [{country, genre, avgRating, count}]
   */
  function renderKPIs(moviesPage, yearTrendRaw, heatmapRaw) {
    var total = 0, avgRating = '-', yearSpan = '-', countries = '-';
    if (moviesPage) {
      // Spring Data Page 用 totalElements 而不是 total
      total = moviesPage.totalElements || moviesPage.total || 0;
    }
    // 平均评分 + 年代跨度：从 year-trend 聚合（按电影数量加权，比抽样准确）
    if (yearTrendRaw && yearTrendRaw.length) {
      var sumRating = 0, sumCount = 0;
      yearTrendRaw.forEach(function (d) {
        var c = +d.count || 0;
        sumCount += c;
        sumRating += c * (+d.avgRating || 0);
      });
      if (sumCount > 0) avgRating = (sumRating / sumCount).toFixed(2);
      var years = yearTrendRaw.map(function (d) { return +d.year; }).filter(function (y) { return !isNaN(y); });
      if (years.length) {
        yearSpan = Math.min.apply(null, years) + ' ~ ' + Math.max.apply(null, years);
      }
    }
    // 覆盖国家/地区数：从 heatmap 原始数据去重
    if (heatmapRaw && heatmapRaw.length) {
      var countrySet = {};
      heatmapRaw.forEach(function (d) { if (d.country) countrySet[d.country] = 1; });
      countries = Object.keys(countrySet).length;
    }
    document.getElementById('kpiTotal').textContent = total.toLocaleString();
    document.getElementById('kpiAvgRating').textContent = avgRating;
    document.getElementById('kpiYearSpan').textContent = yearSpan;
    document.getElementById('kpiCountries').textContent = countries;
  }

  /**
   * 从 heatmap 数据构造 regionCulture 桑基图所需的扁平数组
   */
  function buildRegionCultureData(heatmapData) {
    if (!heatmapData || !heatmapData.data) return null;
    var countries = heatmapData.countries || [];
    var genres = heatmapData.genres || [];
    return heatmapData.data.map(function (d) {
      var genreIdx = d[0], countryIdx = d[1], rating = d[2];
      return {
        country: countries[countryIdx],
        genre: genres[genreIdx],
        avgRating: rating,
        count: 1,
      };
    });
  }

  /* ============================================================
   * 数据转换层：后端扁平 DTO → 前端图表期望结构
   * 后端统一返回 [{field, field, ...}]，前端期望不同形状
   * ============================================================ */

  /** yearTrend: [{year, count, avgRating}] → {years:[], counts:[], avgRatings:[]} */
  function transformYearTrend(list) {
    if (!list || !list.length) return { years: [], counts: [], avgRatings: [] };
    var years = [], counts = [], avgRatings = [];
    list.forEach(function (d) {
      years.push(String(d.year));
      counts.push(d.count);
      avgRatings.push(d.avgRating != null ? +d.avgRating : 0);
    });
    return { years: years, counts: counts, avgRatings: avgRatings };
  }

  /** scatter: [{budgetWan, boxOfficeWan, rating, title, country}] → [{movie, cost, boxOffice, rating, genre}] */
  function transformScatter(list) {
    if (!list || !list.length) return [];
    return list.map(function (d) {
      return {
        movie: d.title,
        title: d.title,
        cost: d.budgetWan != null ? +d.budgetWan : 0,
        boxOffice: d.boxOfficeWan != null ? +d.boxOfficeWan : 0,
        rating: d.rating != null ? +d.rating : null,
        genre: d.country, // 后端无 genre 字段，用 country 兜底
      };
    });
  }

  /** heatmap: [{country, genre, avgRating, count}] → {countries:[], genres:[], data:[[countryIdx,genreIdx,rating]]} */
  function transformHeatmap(list) {
    if (!list || !list.length) return { countries: [], genres: [], data: [] };
    var countrySet = [], genreSet = [];
    list.forEach(function (d) {
      if (countrySet.indexOf(d.country) === -1) countrySet.push(d.country);
      if (genreSet.indexOf(d.genre) === -1) genreSet.push(d.genre);
    });
    var data = list.map(function (d) {
      return [
        countrySet.indexOf(d.country),
        genreSet.indexOf(d.genre),
        d.avgRating != null ? +d.avgRating : 0,
      ];
    });
    return { countries: countrySet, genres: genreSet, data: data };
  }

  /** seasonAnalysis: seasonTag → season (字段名统一) */
  function transformSeason(list) {
    if (!list || !list.length) return [];
    return list.map(function (d) {
      return {
        season: d.seasonTag || d.season,
        genre: d.genre,
        avgBoxOffice: d.avgBoxOffice != null ? +d.avgBoxOffice : 0,
        avgRating: d.avgRating != null ? +d.avgRating : null,
        count: d.count,
      };
    });
  }

  /* ============================================================
   * 7. 电影列表
   * ============================================================ */
  function loadMovieList() {
    var grid = document.getElementById('movieGrid');
    if (!grid) return;
    grid.innerHTML = '<div style="padding:20px;color:#999;">加载中...</div>';

    var params = Object.assign(
      // 注意：前端 pageState.page 是 1-based（UI 显示用），
      // 后端 MovieQueryDTO.page 是 0-based（Spring Data PageRequest 约定），
      // 所以这里要减 1，否则首屏会跳到第 2 页数据
      { page: pageState.page - 1, size: pageState.size },
      filterParams()
    );

    API.get('/api/movies', params).then(function (data) {
      // Spring Data Page 结构：content 数组 + totalElements
      var list = data && data.content || [];
      pageState.total = data && data.totalElements ? data.totalElements : list.length;
      renderMovieCards(list);
      updatePageInfo();
    }).catch(function () {
      grid.innerHTML = '<div style="padding:20px;color:#e04040;">加载失败，请检查后端</div>';
    });
  }

  function renderMovieCards(list) {
    var grid = document.getElementById('movieGrid');
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:#888;">没有匹配的电影</div>';
      return;
    }
    list.forEach(function (m) {
      var card = document.createElement('div');
      card.className = 'movie-card';
      card.dataset.id = m.id;

      var genresHtml = (m.genres || []).slice(0, 3).join(' / ') || '未知类型';
      var directorHtml = m.director || '未知导演';
      var ratingHtml = m.rating != null
        ? '<span class="movie-rating">★ ' + (+m.rating).toFixed(1) + '</span>'
        : '';

      card.innerHTML =
        '<div class="movie-poster">🎬</div>' +
        '<div class="movie-info">' +
          '<div class="movie-title">' + (m.title || '未命名') + '</div>' +
          '<div class="movie-meta">' +
            (m.year ? (m.year + ' · ') : '') + genresHtml + '<br/>' +
            '导演：' + directorHtml +
          '</div>' +
          ratingHtml +
        '</div>';

      card.addEventListener('click', function () { openMovieDetail(m.id || m._id); });
      grid.appendChild(card);
    });
  }

  /* ============================================================
   * 8. 电影详情模态框
   * ============================================================ */
  function openMovieDetail(id) {
    if (!id) { UI.showToast('该电影缺少 ID', 'warning'); return; }
    API.get('/api/movies/' + encodeURIComponent(id)).then(function (m) {
      if (!m) { UI.showToast('未找到该电影', 'warning'); return; }
      var html = buildDetailHTML(m);
      UI.showModal(html);
      // 模态框内同档期对比迷你图（复用 yearTrend 风格的小 bar）
      setTimeout(function () { renderDetailMiniChart(m); }, 50);
    });
  }

  function buildDetailHTML(m) {
    var genres = (m.genres || []).join(' / ') || '-';
    var cast = (m.cast || m.actors || []).slice(0, 6).join(' / ') || '-';
    return '' +
      '<div class="modal-detail">' +
        '<div class="detail-poster">🎬</div>' +
        '<div class="detail-info">' +
          '<h3>' + (m.title || '未命名') + '</h3>' +
          '<p><strong>年份：</strong>' + (m.year || '-') + '</p>' +
          '<p><strong>导演：</strong>' + (m.director || '-') + '</p>' +
          '<p><strong>类型：</strong>' + genres + '</p>' +
          '<p><strong>国家：</strong>' + (m.country || '-') + '</p>' +
          '<p><strong>评分：</strong>' + (m.rating != null ? (+'m.rating').toFixed(1) : '-') + '</p>' +
          '<p><strong>成本：</strong>' + (m.cost != null ? m.cost + ' 万' : '-') + '</p>' +
          '<p><strong>票房：</strong>' + (m.boxOffice != null ? m.boxOffice + ' 万' : '-') + '</p>' +
          '<p><strong>主演：</strong>' + cast + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="detail-mini-chart" id="detailMiniChart"></div>';
  }

  /**
   * 详情页迷你图：同档期（前后 3 年）电影评分柱状
   */
  function renderDetailMiniChart(m) {
    var dom = document.getElementById('detailMiniChart');
    if (!dom || !global.echarts || !m) return;
    var year = m.year;
    if (!year) {
      dom.innerHTML = '<div style="padding:40px;text-align:center;color:#888;">无年份信息，无法对比</div>';
      return;
    }

    var params = { yearStart: year - 3, yearEnd: year + 3 };
    API.get('/api/stats/year-trend', params).then(function (data) {
      if (!data || !data.years || !data.years.length) {
        dom.innerHTML = '<div style="padding:40px;text-align:center;color:#888;">同档期对比数据暂无</div>';
        return;
      }
      var mini = echarts.init(dom);
      var colorIdx = data.years.indexOf(String(year));
      var itemColors = data.years.map(function (y) {
        return (+y) === +year ? '#42AC4E' : '#bbb';
      });
      mini.setOption({
        title: { text: '同档期（±3年）电影数量对比', left: 'center', textStyle: { fontSize: 12 } },
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 20, top: 30, bottom: 30 },
        xAxis: { type: 'category', data: data.years, axisLabel: { fontSize: 10 } },
        yAxis: { type: 'value', name: '数量', nameTextStyle: { fontSize: 10 } },
        series: [{
          type: 'bar',
          data: data.counts.map(function (v, i) {
            return {
              value: v,
              itemStyle: { color: itemColors[i], borderRadius: [3, 3, 0, 0] },
            };
          }),
        }],
      });

      // 监听模态框关闭，销毁迷你实例
      global.addEventListener('modal:close', function handler() {
        mini.dispose();
        global.removeEventListener('modal:close', handler);
      }, { once: true });
    });
  }

  /* ============================================================
   * 9. 主题切换
   * ============================================================ */
  function bindThemeToggle() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      document.body.classList.toggle('dark');
      // 销毁所有 ECharts 并以新主题重新 init
      var theme = document.body.classList.contains('dark') ? 'dark' : null;
      var chartIds = [
        'chartYearTrend', 'chartGenreCompare', 'chartScatterCostBox', 'chartHeatmap',
        'chartSeasonAnalysis', 'chartTopDirectors', 'chartCostBenefit', 'chartRegionCulture',
      ];
      var themeInstance = global.echarts;
      // ECharts 5.x：dispose 后 init 会自动读已存在的主题
      // 但我们必须重新 init，因为主题是在 init 时指定的
      // 这里简单做法：直接 dispose 所有 Charts 模块
      Charts.yearTrend.dispose();
      Charts.genreCompare.dispose();
      Charts.scatterCostBox.dispose();
      Charts.heatmap.dispose();
      Charts.seasonAnalysis.dispose();
      Charts.topDirectors.dispose();
      Charts.costBenefit.dispose();
      Charts.regionCulture.dispose();

      // 重新执行 reloadAll → 内部 render 函数会用 getTheme()
      reloadAll();
    });
  }

  /* ============================================================
   * 10. Tab 切换
   * ============================================================ */
  function bindTabSwitch() {
    var bar = document.querySelector('.tab-bar');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (!btn) return;
      var tabId = btn.dataset.tab;

      // 更新按钮状态
      bar.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      // 更新面板状态
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      var panel = document.getElementById('tab-' + tabId);
      if (panel) panel.classList.add('active');

      // 切到 Tab 后手动 resize 对应的图表（因为隐藏时宽度为 0）
      setTimeout(function () {
        if (Charts[tabId] && Charts[tabId].resize) Charts[tabId].resize();
      }, 50);
    });
  }

  /* ============================================================
   * 11. Window resize → 所有图表 resize
   * ============================================================ */
  function bindResize() {
    var resize = UI.throttle(function () {
      Object.keys(Charts).forEach(function (k) {
        if (Charts[k].resize) Charts[k].resize();
      });
    }, 200);
    global.addEventListener('resize', resize);
  }

  /* ============================================================
   * 12. 模态框关闭事件（main.js 里只做全局绑定，实际关闭逻辑在 ui.js）
   * ============================================================ */
  function bindModalClose() {
    // ui.js 已经绑定了关闭按钮和 ESC / overlay 点击，这里无需再做
  }

  /* ============================================================
   * 13. 全局异常兜底
   * ============================================================ */
  function bindGlobalError() {
    global.addEventListener('error', function (e) {
      UI.showToast('脚本异常：' + (e.message || e.error), 'error');
    });
    global.addEventListener('unhandledrejection', function (e) {
      UI.showToast('未处理的异步错误：' + (e.reason && e.reason.message || e.reason), 'error');
    });
  }

  /* ============================================================
   * 启动
   * ============================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})(window);
