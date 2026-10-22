/**
 * main.js —— 豆瓣电影数据洞察看板 主入口
 *
 * 项目定位（课程要求）：帮助用户发现优质作品、了解评分分布与类型趋势。
 *
 * 职责：
 *   1. 初始化筛选器：A1 GET /api/types 类型下拉 + F4 评分快捷区间
 *   2. 绑定筛选 / 主题 / Tab / 分页 / 图表联动事件
 *   3. 拉取聚合数据（GET /api/stats/overview）→ 交给图表注册中心渲染 F5-F8 图表
 *   4. F9 作品列表表格（A2 GET /api/works，每页 10 条）+ 详情弹窗（A3）
 *   5. 全局异常处理
 *
 * 性能要点：
 *   - 1 次聚合接口拿全部图表数据 + KPI，取代原来多个接口并行
 *   - 深度分析区图表滚动进入视口才渲染（IntersectionObserver）
 *   - 连续筛选时取消上一轮未返回的请求，避免旧数据覆盖新数据
 *   - 主题切换只重绘图表，不再重新请求接口
 *
 * 兼容处理：后端未提供 /api/stats/overview 时，自动降级为 A4/A5 + 旧 stats 接口的多请求模式。
 */
(function (global) {
  'use strict';

  var CONFIG = global.APP_CONFIG;
  var UI = global.UI_UTILS;
  var API = global.API;
  var Registry = global.ChartRegistry;
  var WorksTable = global.WorksTable;

  /** 每页条数（课程要求 F9：每页 10 条） */
  var PAGE_SIZE = 10;

  /** 当前筛选条件 */
  var filterState = {
    type: '',           // F2 类型（单选下拉框）
    yearStart: null,
    yearEnd: null,
    ratingMin: null,
    ratingMax: null,
    title: '',
  };

  /** 电影列表分页状态（1-based，与 UI 一致） */
  var pageState = {
    page: 1,
    size: PAGE_SIZE,
    total: 0,
  };

  /** 最近一次拿到的聚合数据（主题切换 / TOP10 切换时复用，避免重新请求） */
  var lastOverview = null;
  /** 是否使用兼容模式（后端还没有 /api/stats/overview 时走 A4/A5 + 旧接口） */
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
    bindFilterControls();
    bindChartToggles();
    bindWorksListEvents();

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

    WorksTable.setView('table');
    loadTypes().then(function () {
      reloadAll();
    }).catch(function (err) {
      UI.showToast('初始化类型列表失败：' + (err.message || err), 'error');
      reloadAll();
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
      (global.CHART_DEFS || []).forEach(function (def) {
        Registry.setState(def, 'error');
      });
    });
  }

  /* ============================================================
   * 2. F2 类型筛选：A1 GET /api/types → 下拉框
   * ============================================================ */
  function loadTypes() {
    return API.getWithCache('/api/types', null).then(function (types) {
      var sel = document.getElementById('typeSelect');
      if (!sel) return;
      sel.innerHTML = '<option value="">全部类型</option>';
      (types || []).forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        sel.appendChild(opt);
      });
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

    filterState = {
      type: document.getElementById('typeSelect').value,
      yearStart: ys ? +ys : null,
      yearEnd: ye ? +ye : null,
      ratingMin: rm ? +rm : null,
      ratingMax: rM ? +rM : null,
      title: document.getElementById('titleSearch').value.trim(),
    };
  }

  /** 把 filterState 转成后端 query 参数（type 单值 → genres 列表，后端支持两种形态） */
  function filterParams() {
    var p = {};
    if (filterState.type) p.type = filterState.type;
    if (filterState.yearStart) p.yearStart = filterState.yearStart;
    if (filterState.yearEnd) p.yearEnd = filterState.yearEnd;
    if (filterState.ratingMin) p.ratingMin = filterState.ratingMin;
    if (filterState.ratingMax) p.ratingMax = filterState.ratingMax;
    if (filterState.title) p.title = filterState.title;
    return p;
  }

  /* ============================================================
   * 4. 绑定筛选控件（F3 年份 / F4 评分快捷区间 / 关键词 / 重置）
   * ============================================================ */
  function bindFilterControls() {
    var trigger = UI.debounce(function () {
      collectFilterState();
      pageState.page = 1;
      reloadAll();
    }, CONFIG.DEBOUNCE_MS);

    // F3 年份 + 关键词：输入即触发（防抖 300ms）
    ['yearStart', 'yearEnd', 'ratingMin', 'ratingMax', 'titleSearch'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function () {
        clearActiveChip();      // 手动改区间时取消快捷选项高亮
        trigger();
      });
    });

    // F2 类型下拉框
    document.getElementById('typeSelect').addEventListener('change', trigger);

    // F4 评分快捷区间
    var chips = document.getElementById('ratingChips');
    if (chips) {
      chips.addEventListener('click', function (e) {
        var btn = e.target.closest('.chip');
        if (!btn) return;
        chips.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById('ratingMin').value = btn.dataset.min || '';
        document.getElementById('ratingMax').value = btn.dataset.max || '';
        trigger();
      });
    }

    // 重置
    document.getElementById('resetBtn').addEventListener('click', function () {
      document.getElementById('yearStart').value = '';
      document.getElementById('yearEnd').value = '';
      document.getElementById('ratingMin').value = '';
      document.getElementById('ratingMax').value = '';
      document.getElementById('titleSearch').value = '';
      document.getElementById('typeSelect').value = '';
      clearActiveChip();
      document.querySelector('#ratingChips .chip[data-min=""][data-max=""]').classList.add('active');
      pageState.page = 1;
      reloadAll();
    });

    // 图表联动：点击直方图评分段 → 写入评分筛选
    global.addEventListener('filter:ratingClick', function (e) {
      var d = e.detail || {};
      if (d.min == null && d.max == null) return;
      document.getElementById('ratingMin').value = d.min != null ? d.min : '';
      document.getElementById('ratingMax').value = d.max != null ? d.max : '';
      clearActiveChip();
      collectFilterState();
      pageState.page = 1;
      reloadAll();
      UI.showToast('已筛选评分段 ' + (d.range || ''), 'success');
    });

    // 图表联动：点击类型对比图的类型 → 写入类型下拉框
    global.addEventListener('filter:genreClick', function (e) {
      var genre = e.detail && e.detail.genre;
      if (!genre) return;
      var sel = document.getElementById('typeSelect');
      sel.value = genre;
      collectFilterState();
      pageState.page = 1;
      reloadAll();
      UI.showToast('已筛选类型「' + genre + '」', 'success');
    });

    // 图表联动：点击年代趋势柱子 → 按该年份筛选
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

    // 图表联动：点击 TOP10 / 卡片 → 打开详情
    global.addEventListener('movie:open', function (e) {
      var id = e.detail && e.detail.id;
      if (id) openMovieDetail(id);
    });
  }

  function clearActiveChip() {
    var chips = document.getElementById('ratingChips');
    if (chips) chips.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
  }

  /* ============================================================
   * 5. 图表视图切换（F7 按评分/按评价人数，F8 柱状/雷达）
   * ============================================================ */
  function bindChartToggles() {
    var topToggle = document.getElementById('topWorksToggle');
    if (topToggle) {
      topToggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        topToggle.querySelectorAll('.toggle-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var mod = global.Charts && global.Charts.topWorks;
        if (mod && mod.setMode) {
          mod.setMode(btn.dataset.by);
          mod.render(lastOverview ? lastOverview.topWorks : null);   // 本地重排，不重新请求
        }
      });
    }

    var genreToggle = document.getElementById('genreCompareToggle');
    if (genreToggle) {
      genreToggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        genreToggle.querySelectorAll('.toggle-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var mod = global.Charts && global.Charts.genreCompare;
        if (mod && mod.setMode) {
          mod.setMode(btn.dataset.mode);
          mod.render(lastOverview ? lastOverview.genreCompare : null);
        }
      });
    }

    var viewToggle = document.getElementById('viewToggle');
    if (viewToggle) {
      viewToggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        viewToggle.querySelectorAll('.toggle-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        WorksTable.setView(btn.dataset.view);
        loadWorksPage();   // 用当前页数据重绘成对应视图
      });
    }
  }

  /* ============================================================
   * 6. F9 作品列表（A2）+ 分页
   * ============================================================ */
  function bindWorksListEvents() {
    // 事件委托：表格行 / 卡片点击都能打开详情
    ['worksTableBody', 'movieGrid'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', function (e) {
        var row = e.target.closest('[data-id]');
        if (row && row.dataset.id) openMovieDetail(row.dataset.id);
      });
    });

    document.getElementById('prevPage').addEventListener('click', function () {
      if (pageState.page > 1) {
        pageState.page--;
        loadWorksPage();
      }
    });
    document.getElementById('nextPage').addEventListener('click', function () {
      var totalPage = Math.max(1, Math.ceil(pageState.total / pageState.size));
      if (pageState.page < totalPage) {
        pageState.page++;
        loadWorksPage();
      }
    });
  }

  function updatePageInfo() {
    var totalPage = Math.max(1, Math.ceil(pageState.total / pageState.size));
    document.getElementById('pageInfo').textContent = pageState.page + ' / ' + totalPage;
    document.getElementById('prevPage').disabled = pageState.page <= 1;
    document.getElementById('nextPage').disabled = pageState.page >= totalPage;
  }

  /**
   * A2：拉取当前页作品列表并渲染表格/卡片
   */
  function loadWorksPage() {
    WorksTable.setState('loading');
    var params = Object.assign(
      // 前端 pageState.page 是 1-based，后端 page 是 0-based（Spring Data 约定）
      { page: pageState.page - 1, size: pageState.size },
      filterParams()
    );

    API.get('/api/works', params, { dedupe: false }).then(function (data) {
      var list = (data && data.content) || [];
      pageState.total = data && data.totalElements ? data.totalElements : list.length;
      WorksTable.render(list, {
        page: pageState.page,
        totalPages: Math.max(1, Math.ceil(pageState.total / pageState.size)),
        totalElements: pageState.total,
      });
      updatePageInfo();
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      WorksTable.setState('error', '加载失败，请检查后端');
    });
  }

  /* ============================================================
   * 7. 主流程：聚合接口 → 图表 + KPI + 列表
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
      loadWorksPage();
    }).catch(function (err) {
      // 兼容处理：后端未升级（没有 /api/stats/overview）时自动降级
      var msg = err && err.message ? err.message : '';
      var missingEndpoint = /HTTP (404|405|500)/.test(msg);
      if (missingEndpoint) legacyMode = true;
      if (global.console) console.warn('[overview] 聚合接口不可用，降级为多接口模式：', msg);
      loadLegacy(query).catch(onLoadError);
    });
  }

  /**
   * 兼容模式：用课程要求的 A4 / A5 接口 + 旧 stats 接口拼出同样的 payload
   */
  function loadLegacy(query) {
    return Promise.all([
      API.get('/api/works/stats', query, { dedupe: false }),
      API.get('/api/works/top', Object.assign({ n: CONFIG.TOP_N, by: 'rating' }, query), { dedupe: false }),
      API.get('/api/stats/scatter-cost-box', query, { dedupe: false }).catch(function () { return []; }),
      API.get('/api/stats/heatmap', query, { dedupe: false }).catch(function () { return []; }),
      API.get('/api/stats/season-analysis', query, { dedupe: false }).catch(function () { return []; }),
      API.get('/api/stats/top-directors', { n: CONFIG.TOP_N }, { dedupe: false }).catch(function () { return []; }),
      API.get('/api/movies', Object.assign({ page: 0, size: 1 }, query), { dedupe: false }).catch(function () { return null; }),
    ]).then(function (r) {
      var stats = r[0] || {};
      var payload = {
        kpi: computeKpiLocally(r[6], stats.yearTrend, r[3]),
        ratingDistribution: stats.ratingDistribution || [],
        yearTrend: stats.yearTrend || [],
        genreCompare: stats.genreCompare || [],
        topWorks: r[1] || [],
        scatterCostBox: r[2] || [],
        heatmap: r[3] || [],
        seasonAnalysis: r[4] || [],
        topDirectors: r[5] || [],
      };
      lastOverview = payload;
      renderKPIsFromOverview(payload);
      Registry.renderAll(payload);
      loadWorksPage();
    });
  }

  function onLoadError(err) {
    if (err && err.name === 'AbortError') return;   // 被新请求取代，忽略
    UI.showToast('数据加载失败：' + (err.message || err), 'warning');
  }

  /**
   * KPI 卡片渲染：后端已算好直接用；兼容模式下前端兜底计算
   */
  function renderKPIsFromOverview(payload) {
    var kpi = (payload && payload.kpi) || {};
    var total = kpi.movieCount != null ? kpi.movieCount : 0;
    var avgRating = kpi.avgRating != null ? (+kpi.avgRating).toFixed(2) : '-';
    var yearSpan = (kpi.yearMin && kpi.yearMax) ? (kpi.yearMin + ' ~ ' + kpi.yearMax) : '-';
    var countries = kpi.countryCount != null ? kpi.countryCount : '-';

    document.getElementById('kpiTotal').textContent = (+total).toLocaleString();
    document.getElementById('kpiAvgRating').textContent = avgRating;
    document.getElementById('kpiYearSpan').textContent = yearSpan;
    document.getElementById('kpiCountries').textContent = countries;
  }

  /** 兼容模式下的 KPI 前端计算 */
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
    return { movieCount: total, avgRating: +avgRating.toFixed(2), yearMin: yearMin, yearMax: yearMax, countryCount: countryCount };
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
        genre: d.country,
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
      return [countrySet.indexOf(d.country), genreSet.indexOf(d.genre), d.avgRating != null ? +d.avgRating : 0];
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

  /** regionCulture: heatmap 转换结果 → 桑基图所需的扁平数组 */
  function transformRegionCulture(heatmapData) {
    if (!heatmapData || !heatmapData.data) return [];
    var countries = heatmapData.countries || [];
    var genres = heatmapData.genres || [];
    return heatmapData.data.map(function (d) {
      return { country: countries[d[1]], genre: genres[d[0]], avgRating: d[2], count: 1 };
    });
  }

  /* ============================================================
   * 8. A3 作品详情弹窗
   * ============================================================ */
  function openMovieDetail(id) {
    if (!id) { UI.showToast('该作品缺少 ID', 'warning'); return; }
    API.get('/api/works/' + encodeURIComponent(id)).then(function (m) {
      if (!m) { UI.showToast('未找到该作品', 'warning'); return; }
      UI.showModal(buildDetailHTML(m));
      setTimeout(function () { renderDetailMiniChart(m); }, 50);
    });
  }

  function buildDetailHTML(m) {
    var genres = (m.genres || []).join(' / ') || '-';
    var cast = m.leadActor || m.cast || m.actors || '-';
    if (Array.isArray(cast)) cast = cast.join(' / ');
    var fin = m.financial || {};
    return '' +
      '<div class="modal-detail">' +
        '<div class="detail-poster">🎬</div>' +
        '<div class="detail-info">' +
          '<h3>' + WorksTable.escapeHtml(m.title || '未命名') + '</h3>' +
          '<p><strong>年份：</strong>' + (m.year || '-') + '</p>' +
          '<p><strong>导演：</strong>' + WorksTable.escapeHtml(m.director || '-') + '</p>' +
          '<p><strong>类型：</strong>' + WorksTable.escapeHtml(genres) + '</p>' +
          '<p><strong>国家/地区：</strong>' + WorksTable.escapeHtml(m.country || '-') + '</p>' +
          '<p><strong>评分：</strong>' + (m.rating != null ? (+m.rating).toFixed(1) : '-') +
            '　<strong>评价人数：</strong>' + (m.voteCount != null ? (+m.voteCount).toLocaleString() : '-') + '</p>' +
          (fin.budgetWan != null ? '<p><strong>成本：</strong>' + fin.budgetWan + ' 万</p>' : '') +
          (fin.boxOfficeWan != null ? '<p><strong>票房：</strong>' + fin.boxOfficeWan + ' 万</p>' : '') +
          (fin.seasonTag ? '<p><strong>档期：</strong>' + WorksTable.escapeHtml(fin.seasonTag) + '</p>' : '') +
          '<p><strong>主演：</strong>' + WorksTable.escapeHtml(cast) + '</p>' +
          (m.intro ? '<p class="detail-intro">' + WorksTable.escapeHtml(m.intro) + '</p>' : '') +
        '</div>' +
      '</div>' +
      '<div class="detail-mini-chart" id="detailMiniChart"></div>';
  }

  /** 详情页迷你图：同档期（前后 3 年）电影数量柱状 */
  function renderDetailMiniChart(m) {
    var dom = document.getElementById('detailMiniChart');
    if (!dom || !global.echarts || !m) return;
    var year = m.year;
    if (!year) {
      dom.innerHTML = '<div class="table-placeholder">无年份信息，无法对比</div>';
      return;
    }

    API.get('/api/works/stats', { yearStart: year - 3, yearEnd: year + 3 }).then(function (stats) {
      var data = stats && stats.yearTrend;
      if (!data || !data.length) {
        dom.innerHTML = '<div class="table-placeholder">同档期对比数据暂无</div>';
        return;
      }
      var years = data.map(function (d) { return String(d.year); });
      var counts = data.map(function (d) { return d.count || 0; });
      var theme = global.UI_THEME ? global.UI_THEME.current() : null;
      var mini = echarts.init(dom, theme);
      var itemColors = years.map(function (y) { return (+y) === +year ? '#42AC4E' : '#bbb'; });
      var base = global.UI_THEME ? global.UI_THEME.baseOption() : {};
      mini.setOption(Object.assign({}, base, {
        title: { text: '同档期（±3年）电影数量对比', left: 'center', textStyle: { fontSize: 12 } },
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 20, top: 30, bottom: 30 },
        xAxis: { type: 'category', data: years, axisLabel: { fontSize: 10 } },
        yAxis: { type: 'value', name: '数量', nameTextStyle: { fontSize: 10 } },
        series: [{
          type: 'bar',
          data: counts.map(function (v, i) {
            return { value: v, itemStyle: { color: itemColors[i], borderRadius: [3, 3, 0, 0] } };
          }),
        }],
      }));

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
      Registry.applyTheme();   // 重新注册主题 → 销毁实例 → 用缓存数据重绘
    });
  }

  /* ============================================================
   * 10. Tab 切换（懒渲染：切到哪个 Tab 才画哪张图）
   * ============================================================ */
  function bindTabSwitch() {
    var bar = document.querySelector('.tab-section .tab-bar');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (!btn) return;
      var tabId = btn.dataset.tab;

      bar.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      var panel = document.getElementById('tab-' + tabId);
      if (panel) panel.classList.add('active');

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
   * 12. 全局异常兜底
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
