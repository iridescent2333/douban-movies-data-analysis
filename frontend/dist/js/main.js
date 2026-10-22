/**
 * main.js —— 豆瓣电影数据洞察看板 主入口
 *
 * 职责：
 *   1. 初始化筛选器列表（GET /api/movies/filters）
 *   2. 绑定筛选 / 明暗主题 / Tab / 分页事件
 *   3. 拉取聚合数据（GET /api/stats/overview）→ 交给图表注册中心渲染
 *   4. 电影列表 & 详情弹窗
 *   5. 全局异常处理
 *
 * 性能要点（本次改造）：
 *   - 1 次聚合接口拿全部 6 类图表数据 + KPI，取代原来 7 个并行接口
 *   - Tab 内 4 张图懒渲染：切到哪个 Tab 才画哪个
 *   - 连续筛选时取消上一轮未返回的请求，避免旧数据覆盖新数据
 *   - 主题切换只重绘图表，不再重新请求接口
 */
(function (global) {
  'use strict';

  var CONFIG = global.APP_CONFIG;
  var UI = global.UI_UTILS;
  var API = global.API;
  var Registry = global.ChartRegistry;

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

  /** 最近一次拿到的聚合数据（主题切换时复用，避免重新请求） */
  var lastOverview = null;
  /** 是否使用兼容模式（后端还没有 /api/stats/overview 时走旧的 6 接口） */
  var legacyMode = false;

  /* ============================================================
   * 1. 启动入口
   * ============================================================ */
  function bootstrap() {
    bindGlobalError();
    bindThemeToggle();
    bindTabSwitch();
    bindResize();
    bindEChartsReady();

    // 注册 ECharts 主题（app-light / app-dark），必须在任何图表 init 之前
    if (global.UI_THEME) global.UI_THEME.registerEChartsThemes();

    // 注册图表清单 + 数据转换函数（新增图表只需改 chart-config.js）
    Registry.configure({
      defs: global.CHART_DEFS,
      transformers: {
        transformYearTrend: transformYearTrend,
        transformScatter: transformScatter,
        transformHeatmap: transformHeatmap,
        transformSeason: transformSeason,
        transformRegionCulture: transformRegionCulture,
      },
    });

    initFilters().then(function () {
      bindFilterEvents();
      bindPagerEvents();
      bindModalClose();
      reloadAll();
    }).catch(function (err) {
      UI.showToast('初始化筛选器失败：' + (err.message || err), 'error');
    });
  }

  /**
   * 等待 ECharts 就绪（本地 vendor 文件优先，失败时由 loader 回退 CDN）
   */
  function bindEChartsReady() {
    global.addEventListener('echarts:ready', function () {
      if (global.UI_THEME) global.UI_THEME.registerEChartsThemes();
      Registry.renderAll(lastOverview);   // 数据已到但图表库晚到 → 补渲染
    });
    global.addEventListener('echarts:error', function () {
      UI.showToast('图表库（ECharts）加载失败：请确认 vendor/echarts.min.js 存在或网络可达 CDN', 'error');
      global.CHART_DEFS.forEach(function (def) {
        Registry.setState(def, 'error');
      });
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
   * 5. 分页
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
   * 6. 主流程：一次聚合请求 → 全部图表
   * ============================================================ */
  function reloadAll() {
    // 取消上一轮未完成的请求，避免旧数据后到覆盖新数据
    API.cancelInFlight();

    // 标记 loading
    (global.CHART_DEFS || []).forEach(function (def) {
      UI.showLoading(def.containerId);
    });

    var params = filterParams();
    var query = Object.assign({ n: CONFIG.TOP_N }, params);

    if (legacyMode) {
      loadLegacy(query).catch(onLoadError);
      return;
    }

    API.get('/api/stats/overview', query, { silent: true }).then(function (data) {
      lastOverview = data;
      renderKPIsFromOverview(data);
      Registry.renderAll(data);
      loadMovieList();
    }).catch(function (err) {
      // 兼容处理：后端未升级（没有 /api/stats/overview）时自动降级到旧的 6 个接口
      var msg = err && err.message ? err.message : '';
      var missingEndpoint = /HTTP (404|405|500)/.test(msg);
      if (missingEndpoint) legacyMode = true;   // 记住降级，后续不再重试聚合接口
      if (global.console) console.warn('[overview] 聚合接口不可用，降级为多接口模式：', msg);
      loadLegacy(query).catch(onLoadError);
    });
  }

  /**
   * 兼容模式：后端未提供聚合接口时，退回 7 个并行接口
   */
  function loadLegacy(query) {
    return Promise.all([
      API.get('/api/movies', Object.assign({ page: 0, size: 1 }, query), { dedupe: false }),
      API.get('/api/stats/year-trend', query, { dedupe: false }),
      API.get('/api/stats/genre-compare', query, { dedupe: false }),
      API.get('/api/stats/scatter-cost-box', query, { dedupe: false }),
      API.get('/api/stats/heatmap', query, { dedupe: false }),
      API.get('/api/stats/season-analysis', query, { dedupe: false }),
      API.get('/api/stats/top-directors', { n: CONFIG.TOP_N }, { dedupe: false }),
    ]).then(function (results) {
      var payload = {
        kpi: computeKpiLocally(results[0], results[1], results[4]),
        yearTrend: results[1],
        genreCompare: results[2],
        scatterCostBox: results[3],
        heatmap: results[4],
        seasonAnalysis: results[5],
        topDirectors: results[6],
      };
      lastOverview = payload;
      renderKPIsFromOverview(payload);
      Registry.renderAll(payload);
      loadMovieList();
    });
  }

  function onLoadError(err) {
    if (err && err.name === 'AbortError') return;   // 被新请求取代，忽略
    UI.showToast('数据加载失败：' + (err.message || err), 'warning');
  }

  /**
   * KPI 卡片渲染：后端已算好直接用；兼容模式下前端兜底计算
   * @param payload 聚合数据（含 kpi 字段）
   */
  function renderKPIsFromOverview(payload) {
    var kpi = (payload && payload.kpi) || {};
    var total = kpi.movieCount != null ? kpi.movieCount : 0;
    var avgRating = kpi.avgRating != null ? (+kpi.avgRating).toFixed(2) : '-';
    var yearSpan = (kpi.yearMin && kpi.yearMax)
      ? (kpi.yearMin + ' ~ ' + kpi.yearMax)
      : '-';
    var countries = kpi.countryCount != null ? kpi.countryCount : '-';

    document.getElementById('kpiTotal').textContent = (+total).toLocaleString();
    document.getElementById('kpiAvgRating').textContent = avgRating;
    document.getElementById('kpiYearSpan').textContent = yearSpan;
    document.getElementById('kpiCountries').textContent = countries;
  }

  /**
   * 兼容模式下的 KPI 前端计算
   */
  function computeKpiLocally(moviesPage, yearTrendRaw, heatmapRaw) {
    var total = 0, avgRating = 0, yearMin = null, yearMax = null, countryCount = 0;
    if (moviesPage) total = moviesPage.totalElements || moviesPage.total || 0;
    if (yearTrendRaw && yearTrendRaw.length) {
      var sumRating = 0, sumCount = 0, years = [];
      yearTrendRaw.forEach(function (d) {
        var c = +d.count || 0;
        sumCount += c;
        sumRating += c * (+d.avgRating || 0);
        var y = +d.year;
        if (!isNaN(y)) years.push(y);
      });
      if (sumCount > 0) avgRating = sumRating / sumCount;
      if (years.length) {
        yearMin = Math.min.apply(null, years);
        yearMax = Math.max.apply(null, years);
      }
    }
    if (heatmapRaw && heatmapRaw.length) {
      var countrySet = {};
      heatmapRaw.forEach(function (d) { if (d.country) countrySet[d.country] = 1; });
      countryCount = Object.keys(countrySet).length;
    }
    return {
      movieCount: total,
      avgRating: +avgRating.toFixed(2),
      yearMin: yearMin,
      yearMax: yearMax,
      countryCount: countryCount,
    };
  }

  /* ============================================================
   * 数据转换层：后端扁平 DTO → 前端图表期望结构
   * （新增图表时在这里加一个 transform*，并在 chart-config.js 里声明）
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

  /**
   * regionCulture: heatmap 转换结果 → 桑基图所需的扁平数组
   */
  function transformRegionCulture(heatmapData) {
    if (!heatmapData || !heatmapData.data) return [];
    var countries = heatmapData.countries || [];
    var genres = heatmapData.genres || [];
    return heatmapData.data.map(function (d) {
      return {
        country: countries[d[1]],
        genre: genres[d[0]],
        avgRating: d[2],
        count: 1,
      };
    });
  }

  /* ============================================================
   * 7. 电影列表（DocumentFragment + 事件委托，减少重排与监听器开销）
   * ============================================================ */
  function loadMovieList() {
    var grid = document.getElementById('movieGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="list-placeholder">加载中...</div>';

    var params = Object.assign(
      // 注意：前端 pageState.page 是 1-based（UI 显示用），
      // 后端 MovieQueryDTO.page 是 0-based（Spring Data PageRequest 约定），
      // 所以这里要减 1，否则首屏会跳到第 2 页数据
      { page: pageState.page - 1, size: pageState.size },
      filterParams()
    );

    API.get('/api/movies', params, { dedupe: false }).then(function (data) {
      // Spring Data Page 结构：content 数组 + totalElements
      var list = (data && data.content) || [];
      pageState.total = data && data.totalElements ? data.totalElements : list.length;
      renderMovieCards(list);
      updatePageInfo();
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      grid.innerHTML = '<div class="list-placeholder error">加载失败，请检查后端</div>';
    });
  }

  function renderMovieCards(list) {
    var grid = document.getElementById('movieGrid');
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<div class="list-placeholder">没有匹配的电影</div>';
      return;
    }
    // 用 fragment 一次性插入，避免逐个 appendChild 造成多次重排
    var frag = document.createDocumentFragment();
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
          '<div class="movie-title">' + escapeHtml(m.title || '未命名') + '</div>' +
          '<div class="movie-meta">' +
            (m.year ? (m.year + ' · ') : '') + escapeHtml(genresHtml) + '<br/>' +
            '导演：' + escapeHtml(directorHtml) +
          '</div>' +
          ratingHtml +
        '</div>';

      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  /** HTML 转义，防止标题里的特殊字符破坏结构 */
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ============================================================
   * 8. 电影详情弹窗
   * ============================================================ */
  function bindMovieGridClick() {
    var grid = document.getElementById('movieGrid');
    if (!grid) return;
    // 事件委托：只给容器绑一个监听器，卡片再多也不增加监听器数量
    grid.addEventListener('click', function (e) {
      var card = e.target.closest('.movie-card');
      if (card && card.dataset.id) openMovieDetail(card.dataset.id);
    });
  }

  function openMovieDetail(id) {
    if (!id) { UI.showToast('该电影缺少 ID', 'warning'); return; }
    API.get('/api/movies/' + encodeURIComponent(id)).then(function (m) {
      if (!m) { UI.showToast('未找到该电影', 'warning'); return; }
      UI.showModal(buildDetailHTML(m));
      // 模态框内同档期对比迷你图
      setTimeout(function () { renderDetailMiniChart(m); }, 50);
    });
  }

  function buildDetailHTML(m) {
    var genres = (m.genres || []).join(' / ') || '-';
    var cast = (m.leadActor || m.cast || m.actors || '-');
    if (Array.isArray(cast)) cast = cast.join(' / ');
    return '' +
      '<div class="modal-detail">' +
        '<div class="detail-poster">🎬</div>' +
        '<div class="detail-info">' +
          '<h3>' + escapeHtml(m.title || '未命名') + '</h3>' +
          '<p><strong>年份：</strong>' + (m.year || '-') + '</p>' +
          '<p><strong>导演：</strong>' + escapeHtml(m.director || '-') + '</p>' +
          '<p><strong>类型：</strong>' + escapeHtml(genres) + '</p>' +
          '<p><strong>国家：</strong>' + escapeHtml(m.country || '-') + '</p>' +
          '<p><strong>评分：</strong>' + (m.rating != null ? (+m.rating).toFixed(1) : '-') + '</p>' +
          '<p><strong>主演：</strong>' + escapeHtml(cast) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="detail-mini-chart" id="detailMiniChart"></div>';
  }

  /**
   * 详情页迷你图：同档期（前后 3 年）电影数量柱状
   */
  function renderDetailMiniChart(m) {
    var dom = document.getElementById('detailMiniChart');
    if (!dom || !global.echarts || !m) return;
    var year = m.year;
    if (!year) {
      dom.innerHTML = '<div class="list-placeholder">无年份信息，无法对比</div>';
      return;
    }

    var params = { yearStart: year - 3, yearEnd: year + 3 };
    API.get('/api/stats/year-trend', params).then(function (data) {
      if (!data || !data.years || !data.years.length) {
        dom.innerHTML = '<div class="list-placeholder">同档期对比数据暂无</div>';
        return;
      }
      var theme = global.UI_THEME ? global.UI_THEME.current() : null;
      var mini = echarts.init(dom, theme);
      var colorIdx = data.years.indexOf(String(year));
      var itemColors = data.years.map(function (y) {
        return (+y) === +year ? '#42AC4E' : '#bbb';
      });
      var base = global.UI_THEME ? global.UI_THEME.baseOption() : {};
      mini.setOption(Object.assign({}, base, {
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
      }));

      // 监听模态框关闭，销毁迷你实例
      global.addEventListener('modal:close', function handler() {
        mini.dispose();
        global.removeEventListener('modal:close', handler);
      }, { once: true });
    });
  }

  /* ============================================================
   * 9. 主题切换（只重绘，不重新请求数据）
   * ============================================================ */
  function bindThemeToggle() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      document.body.classList.toggle('dark');
      // 重新注册主题（颜色取自当前 CSS 变量）→ 销毁旧实例 → 用缓存数据重绘
      Registry.applyTheme();
    });
  }

  /* ============================================================
   * 10. Tab 切换（懒渲染：切到哪个 Tab 才画哪张图）
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

      // 懒渲染：切换后由注册中心绘制该 Tab 的图表并修正尺寸
      Registry.activateTab(tabId);
    });
  }

  /* ============================================================
   * 11. Window resize → 图表 resize（节流）
   * ============================================================ */
  function bindResize() {
    var resize = UI.throttle(function () {
      Registry.resizeAll();
    }, 200);
    global.addEventListener('resize', resize);
  }

  /* ============================================================
   * 12. 模态框关闭事件（关闭逻辑在 ui.js）
   * ============================================================ */
  function bindModalClose() {
    bindMovieGridClick();
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
