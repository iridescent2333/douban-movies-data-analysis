/**
 * main.js —— 豆瓣电影数据洞察看板 主入口（多页面版）
 *
 * 项目定位（课程要求）：帮助用户发现优质作品、了解评分分布与类型趋势。
 * 界面形态：参考哔哩哔哩网页版 —— 左侧多级菜单 + 右侧内容区按页面切换，不做长页滚动。
 *
 * 页面清单（与左侧菜单一一对应）：
 *   home           首页：KPI + F5 评分分布 + F6 年度趋势 + 综合热榜速览
 *   rank-overall   F7 综合热榜（按评分 / 按评价人数切换）
 *   rank-region    分地区热榜
 *   rank-era       分年代热榜
 *   rank-genre     分类型热榜
 *   insight-genre  F8 类型对比（柱状图 / 雷达图）
 *   insight-deep   深度分析（散点 / 热力 / 档期 / 导演）
 *   library        F9 影片库（筛选 + 表格/卡片 + 分页）
 *
 * 数据流：
 *   - 页面首次显示时才加载该页数据（懒加载），之后切换不再重复请求
 *   - 影片库的筛选条件是全局的：同时作用于 F9 表格与全站图表
 *   - 图表数据优先走聚合接口 /api/stats/overview（1 次请求），
 *     后端未升级时自动降级为 A4 / A5 + 旧 stats 接口
 */
(function (global) {
  'use strict';

  var CONFIG = global.APP_CONFIG;
  var UI = global.UI_UTILS;
  var API = global.API;
  var Registry = global.ChartRegistry;
  var WorksTable = global.WorksTable;
  var Ranking = global.Ranking;

  /** 每页条数（课程要求 F9：每页 10 条） */
  var PAGE_SIZE = 10;
  /** 榜单每页条数 */
  var RANK_SIZE = 20;

  /* ============================================================
   * 全局状态
   * ============================================================ */

  /** 影片库筛选条件（全局，同时驱动表格与图表） */
  var filterState = {
    type: '',
    yearStart: null,
    yearEnd: null,
    ratingMin: null,
    ratingMax: null,
    title: '',
  };

  /** 表格分页状态（1-based） */
  var pageState = { page: 1, size: PAGE_SIZE, total: 0 };

  /** 当前页面 */
  var currentPage = 'home';
  /** 已初始化过的页面 */
  var inited = {};
  /** 聚合数据缓存（图表用） */
  var lastOverview = null;
  /** 是否使用兼容模式（后端没有 /api/stats/overview） */
  var legacyMode = false;
  /** 各榜单页的状态 */
  var rankState = {
    overallBy: 'rating',
    region: '',
    era: '',
    genre: '',
  };

  /* ============================================================
   * 1. 启动
   * ============================================================ */
  function bootstrap() {
    bindGlobalError();
    bindMenu();
    bindThemeToggle();
    bindResize();
    bindEChartsReady();
    bindLibraryFilters();
    bindRankToggles();
    bindWorksListEvents();
    bindGlobalSearch();

    if (global.UI_THEME) global.UI_THEME.registerEChartsThemes();

    Registry.configure({
      defs: global.CHART_DEFS,
      transformers: {
        transformYearTrend: transformYearTrend,
        transformScatter: transformScatter,
        transformHeatmap: transformHeatmap,
        transformSeason: transformSeason,
      },
    });

    WorksTable.setView('table');

    // 进入首页（会触发首页数据加载）
    switchPage('home');
  }

  function bindEChartsReady() {
    global.addEventListener('echarts:ready', function () {
      if (global.UI_THEME) global.UI_THEME.registerEChartsThemes();
      Registry.renderAll(lastOverview, currentPage);
    });
    global.addEventListener('echarts:error', function () {
      UI.showToast('图表库（ECharts）加载失败：请确认 vendor/echarts.min.js 存在或网络可达 CDN', 'error');
      (global.CHART_DEFS || []).forEach(function (def) { Registry.setState(def, 'error'); });
    });
  }

  /* ============================================================
   * 2. 菜单路由（多级菜单 + 页面切换）
   * ============================================================ */
  var PAGE_TITLES = {
    'home': '首页',
    'rank-overall': '综合热榜',
    'rank-region': '分地区热榜',
    'rank-era': '分年代热榜',
    'rank-genre': '分类型热榜',
    'insight-genre': '类型对比',
    'insight-deep': '深度分析',
    'library': '影片库',
  };

  function bindMenu() {
    var menu = document.getElementById('menu');

    // 一级菜单项点击
    menu.addEventListener('click', function (e) {
      var item = e.target.closest('.menu-item');
      if (!item) return;

      // 带子菜单的一级项：展开/收起
      if (item.classList.contains('has-sub')) {
        var group = item.closest('.menu-group');
        group.classList.toggle('open');
        return;
      }
      switchPage(item.dataset.page);
    });

    // 默认展开「热度排行」分组
    var rankGroup = menu.querySelector('.menu-group');
    if (rankGroup) rankGroup.classList.add('open');
  }

  /** 切换页面：更新菜单高亮 + 显示对应 section + 懒加载数据 */
  function switchPage(pageId) {
    if (!PAGE_TITLES[pageId]) pageId = 'home';
    currentPage = pageId;

    // 菜单高亮
    document.querySelectorAll('#menu .menu-item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.page === pageId);
    });
    // 自动展开包含当前页面的分组
    document.querySelectorAll('#menu .menu-group').forEach(function (group) {
      var hasActive = group.querySelector('.menu-item[data-page="' + pageId + '"]');
      if (hasActive) group.classList.add('open');
    });

    // 页面切换
    document.querySelectorAll('.page').forEach(function (el) { el.classList.remove('active'); });
    var page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');

    // 标题栏
    document.getElementById('pageTitle').textContent = PAGE_TITLES[pageId] || '首页';

    // 懒加载 + 图表重绘
    if (!inited[pageId]) {
      inited[pageId] = true;
      initPage(pageId);
    } else {
      // 已初始化过的页面：图表需要按新页面重新渲染（切回首页/洞察页时）
      if (lastOverview) Registry.renderAll(lastOverview, pageId);
    }

    // 内容区回到顶部
    var content = document.getElementById('content');
    if (content) content.scrollTop = 0;
    global.scrollTo(0, 0);
  }

  /** 页面首次初始化 */
  function initPage(pageId) {
    switch (pageId) {
      case 'home': initHome(); break;
      case 'rank-overall': loadRanking('overall'); break;
      case 'rank-region': initRegionPage(); break;
      case 'rank-era': initEraPage(); break;
      case 'rank-genre': initGenrePage(); break;
      case 'insight-genre': ensureOverview().then(function () { Registry.renderAll(lastOverview, 'insight-genre'); }); break;
      case 'insight-deep': ensureOverview().then(function () { Registry.renderAll(lastOverview, 'insight-deep'); }); break;
      case 'library': loadWorksPage(); break;
    }
  }

  /* ============================================================
   * 3. 首页
   * ============================================================ */
  function initHome() {
    ensureOverview().then(function (data) {
      renderKPIs(data);
      Registry.renderAll(lastOverview, 'home');
      // 综合热榜速览：评分最高 5 部
      return API.get('/api/works/top', { n: 5, by: 'rating' }, { dedupe: false });
    }).then(function (list) {
      Ranking.render(list, { containerId: 'homeRanking', compact: true });
    }).catch(onLoadError);
  }

  function renderKPIs(payload) {
    var kpi = (payload && payload.kpi) || {};
    document.getElementById('kpiTotal').textContent =
      kpi.movieCount != null ? (+kpi.movieCount).toLocaleString() : '-';
    document.getElementById('kpiAvgRating').textContent =
      kpi.avgRating != null ? (+kpi.avgRating).toFixed(2) : '-';
    document.getElementById('kpiYearSpan').textContent =
      (kpi.yearMin && kpi.yearMax) ? (kpi.yearMin + ' ~ ' + kpi.yearMax) : '-';
    document.getElementById('kpiCountries').textContent =
      kpi.countryCount != null ? kpi.countryCount : '-';
  }

  /* ============================================================
   * 4. 排行榜页面（F7 + 分地区 / 分年代 / 分类型）
   * ============================================================ */
  function bindRankToggles() {
    // 综合热榜：按评分 / 按评价人数
    var toggle = document.getElementById('rankOverallToggle');
    if (toggle) {
      toggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        toggle.querySelectorAll('.toggle-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        rankState.overallBy = btn.dataset.by;
        // 同步柱状图模块的口径（课程 F7 要求"按评分最高/评价人数最多"切换）
        var barMod = global.Charts && global.Charts.topWorksBar;
        if (barMod && barMod.setMode) barMod.setMode(btn.dataset.by);
        loadRanking('overall');
      });
    }
    // 类型对比：柱状图 / 雷达图
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
    // 影片库：表格 / 卡片
    var viewToggle = document.getElementById('viewToggle');
    if (viewToggle) {
      viewToggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        viewToggle.querySelectorAll('.toggle-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        WorksTable.setView(btn.dataset.view);
        loadWorksPage();
      });
    }
    // 面板内「查看完整榜单」跳转
    document.querySelectorAll('[data-goto]').forEach(function (el) {
      el.addEventListener('click', function () { switchPage(el.dataset.goto); });
    });
  }

  /** 分地区页：地区 chips */
  function initRegionPage() {
    API.getWithCache('/api/movies/filters', null).then(function (data) {
      var countries = (data && data.countries) || [];
      var bar = document.getElementById('regionChips');
      bar.innerHTML = '';
      var all = document.createElement('button');
      all.className = 'chip active';
      all.textContent = '全部地区';
      all.dataset.value = '';
      bar.appendChild(all);
      countries.forEach(function (c) {
        var chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = c;
        chip.dataset.value = c;
        bar.appendChild(chip);
      });
      bar.onclick = function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        bar.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        rankState.region = chip.dataset.value;
        loadRanking('region');
      };
      loadRanking('region');
    }).catch(onLoadError);
  }

  /** 分年代页：年代 chips（5 年一档，数据跨度 1995-2025） */
  function initEraPage() {
    var eras = [
      { label: '全部年代', start: null, end: null },
      { label: '1995-1999', start: 1995, end: 1999 },
      { label: '2000-2004', start: 2000, end: 2004 },
      { label: '2005-2009', start: 2005, end: 2009 },
      { label: '2010-2014', start: 2010, end: 2014 },
      { label: '2015-2019', start: 2015, end: 2019 },
      { label: '2020-2025', start: 2020, end: 2025 },
    ];
    var bar = document.getElementById('eraChips');
    bar.innerHTML = '';
    eras.forEach(function (era, i) {
      var chip = document.createElement('button');
      chip.className = 'chip' + (i === 0 ? ' active' : '');
      chip.textContent = era.label;
      chip.dataset.start = era.start || '';
      chip.dataset.end = era.end || '';
      bar.appendChild(chip);
    });
    bar.onclick = function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      bar.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      rankState.era = chip.label;
      rankState.eraStart = chip.dataset.start ? +chip.dataset.start : null;
      rankState.eraEnd = chip.dataset.end ? +chip.dataset.end : null;
      loadRanking('era');
    };
    loadRanking('era');
  }

  /** 分类型页：类型 chips */
  function initGenrePage() {
    API.getWithCache('/api/types', null).then(function (types) {
      var bar = document.getElementById('genreChips');
      bar.innerHTML = '';
      var all = document.createElement('button');
      all.className = 'chip active';
      all.textContent = '全部类型';
      all.dataset.value = '';
      bar.appendChild(all);
      (types || []).forEach(function (t) {
        var chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = t;
        chip.dataset.value = t;
        bar.appendChild(chip);
      });
      bar.onclick = function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        bar.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        rankState.genre = chip.dataset.value;
        loadRanking('genre');
      };
      loadRanking('genre');
    }).catch(onLoadError);
  }

  /**
   * 拉取某个维度的排行榜
   * @param {'overall'|'region'|'era'|'genre'} dim
   */
  function loadRanking(dim) {
    var containerId = 'rankList-' + dim;
    var params = { n: RANK_SIZE };
    if (dim === 'overall') params.by = rankState.overallBy;
    if (dim === 'region') { if (rankState.region) params.country = rankState.region; }
    if (dim === 'era') {
      if (rankState.eraStart) params.yearStart = rankState.eraStart;
      if (rankState.eraEnd) params.yearEnd = rankState.eraEnd;
    }
    if (dim === 'genre') { if (rankState.genre) params.type = rankState.genre; }

    Ranking.setLoading(containerId, '榜单加载中...');
    API.get('/api/works/top', params, { dedupe: false }).then(function (list) {
      Ranking.render(list, { containerId: containerId });
      // 综合热榜页：同一份榜单数据同时喂给 F7 横向柱状图（取前 10）
      if (dim === 'overall' && global.Charts && global.Charts.topWorksBar) {
        global.Charts.topWorksBar.render(list);
      }
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      Ranking.setLoading(containerId, '加载失败，请检查后端');
    });
  }

  /* ============================================================
   * 5. 影片库（F9）：全局筛选 + 表格 + 分页
   * ============================================================ */
  function bindLibraryFilters() {
    var trigger = UI.debounce(function () {
      collectFilterState();
      pageState.page = 1;
      refreshAll();
    }, CONFIG.DEBOUNCE_MS);

    ['yearStart', 'yearEnd', 'ratingMin', 'ratingMax', 'titleSearch'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', trigger);
    });
    var typeSel = document.getElementById('typeSelect');
    if (typeSel) typeSel.addEventListener('change', trigger);

    // ---- F1 首页左侧筛选面板（与影片库共用 filterState，双向同步） ----
    ['homeYearStart', 'homeYearEnd', 'ratingMin', 'ratingMax'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', trigger);
    });
    var homeTypeSel = document.getElementById('homeTypeSelect');
    if (homeTypeSel) homeTypeSel.addEventListener('change', trigger);

    // F4 评分快捷区间下拉：写入自定义区间输入框
    var preset = document.getElementById('ratingPreset');
    if (preset) {
      preset.addEventListener('change', function () {
        var v = preset.value;
        if (v) {
          var parts = v.split('-');
          document.getElementById('ratingMin').value = parts[0] === '0' ? '' : parts[0];
          document.getElementById('ratingMax').value = parts[1] === '10' ? '' : parts[1];
        } else {
          document.getElementById('ratingMin').value = '';
          document.getElementById('ratingMax').value = '';
        }
        trigger();
      });
    }

    var homeReset = document.getElementById('homeResetBtn');
    if (homeReset) {
      homeReset.addEventListener('click', function () {
        resetFilterInputs();
        pageState.page = 1;
        refreshAll();
        UI.showToast('已重置筛选条件', 'success');
      });
    }

    var reset = document.getElementById('resetBtn');
    if (reset) {
      reset.addEventListener('click', function () {
        resetFilterInputs();
        pageState.page = 1;
        refreshAll();
        UI.showToast('已重置筛选条件', 'success');
      });
    }

    // 初始化类型下拉（A1）——影片库与首页两处
    API.getWithCache('/api/types', null).then(function (types) {
      ['typeSelect', 'homeTypeSelect'].forEach(function (id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">全部类型</option>';
        (types || []).forEach(function (t) {
          var opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t;
          sel.appendChild(opt);
        });
      });
    }).catch(function () { /* 类型下拉失败不阻塞其它功能 */ });
  }

  function collectFilterState() {
    // 影片库与首页筛选面板共享同一份状态：两处输入取"非空优先"
    filterState = {
      type: pickValue('typeSelect', 'homeTypeSelect'),
      yearStart: pickNumber('yearStart', 'homeYearStart'),
      yearEnd: pickNumber('yearEnd', 'homeYearEnd'),
      ratingMin: pickNumber('ratingMin', null),
      ratingMax: pickNumber('ratingMax', null),
      title: pickValue('titleSearch', null),
    };
    // 把状态同步回另一处的控件，避免两面板显示不一致
    syncFilterInputs();
  }

  /** 多个控件取第一个非空值 */
  function pickValue() {
    for (var i = 0; i < arguments.length; i++) {
      var el = document.getElementById(arguments[i]);
      if (el && el.value && el.value.trim() !== '') return el.value.trim();
    }
    return '';
  }

  function pickNumber() {
    for (var i = 0; i < arguments.length; i++) {
      var el = document.getElementById(arguments[i]);
      if (el && el.value !== '') {
        var n = +el.value;
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  /** 把 filterState 回写到两处筛选控件（影片库 + 首页面板） */
  function syncFilterInputs() {
    var mapping = {
      yearStart: filterState.yearStart, yearEnd: filterState.yearEnd,
      ratingMin: filterState.ratingMin, ratingMax: filterState.ratingMax,
    };
    Object.keys(mapping).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = mapping[id] == null ? '' : mapping[id];
    });
    ['typeSelect', 'homeTypeSelect'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = filterState.type || '';
    });
    var ts = document.getElementById('titleSearch');
    if (ts && document.activeElement !== ts) ts.value = filterState.title || '';
    var preset = document.getElementById('ratingPreset');
    if (preset && document.activeElement !== preset) {
      var k = (filterState.ratingMin == null ? '' : filterState.ratingMin) + '-' +
              (filterState.ratingMax == null ? '10' : filterState.ratingMax);
      preset.value = /^(8-10|7-8|6-7|0-6)$/.test(k) ? k : '';
    }
  }

  /** 清空两处筛选控件 */
  function resetFilterInputs() {
    ['yearStart', 'yearEnd', 'ratingMin', 'ratingMax', 'homeYearStart', 'homeYearEnd', 'titleSearch']
      .forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
    ['typeSelect', 'homeTypeSelect'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var preset = document.getElementById('ratingPreset');
    if (preset) preset.value = '';
    filterState = { type: '', yearStart: null, yearEnd: null, ratingMin: null, ratingMax: null, title: '' };
  }

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

  /** 筛选变化：刷新表格 + 全站图表 */
  function refreshAll() {
    loadWorksPage();
    lastOverview = null;   // 丢弃缓存，下次进入图表页时按新筛选重新拉取
    if (currentPage === 'home' || currentPage === 'insight-genre' || currentPage === 'insight-deep') {
      ensureOverview().then(function (data) {
        renderKPIs(data);
        Registry.renderAll(lastOverview, currentPage);
      });
    }
  }

  function bindWorksListEvents() {
    // 事件委托：表格行 / 卡片 / 排行榜卡片 点击都能打开详情
    ['worksTableBody', 'movieGrid'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', function (e) {
        var row = e.target.closest('[data-id]');
        if (row && row.dataset.id) openMovieDetail(row.dataset.id);
      });
    });
    // 排行榜卡片点击 → 详情（事件委托到 content，覆盖所有榜单容器）
    document.getElementById('content').addEventListener('click', function (e) {
      var item = e.target.closest('.rank-item');
      if (item && item.dataset.id) openMovieDetail(item.dataset.id);
    });

    document.getElementById('prevPage').addEventListener('click', function () {
      if (pageState.page > 1) { pageState.page--; loadWorksPage(); }
    });
    document.getElementById('nextPage').addEventListener('click', function () {
      var totalPage = Math.max(1, Math.ceil(pageState.total / pageState.size));
      if (pageState.page < totalPage) { pageState.page++; loadWorksPage(); }
    });
  }

  /** A2：拉取当前页作品列表 */
  function loadWorksPage() {
    WorksTable.setState('loading');
    var params = Object.assign(
      { page: pageState.page - 1, size: pageState.size },   // 后端 0-based
      filterParams()
    );
    API.get('/api/works', params, { dedupe: false }).then(function (data) {
      // 课程要求分页格式：data = { page, size, total, records }
      var list = (data && data.records) || [];
      pageState.total = data && data.total != null ? data.total : list.length;
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

  function updatePageInfo() {
    var totalPage = Math.max(1, Math.ceil(pageState.total / pageState.size));
    document.getElementById('pageInfo').textContent = pageState.page + ' / ' + totalPage;
    document.getElementById('prevPage').disabled = pageState.page <= 1;
    document.getElementById('nextPage').disabled = pageState.page >= totalPage;
  }

  /* ============================================================
   * 6. 顶栏搜索 → 跳转影片库并按标题筛选
   * ============================================================ */
  function bindGlobalSearch() {
    var input = document.getElementById('globalSearch');
    if (!input) return;
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var kw = input.value.trim();
      switchPage('library');
      document.getElementById('titleSearch').value = kw;
      collectFilterState();
      pageState.page = 1;
      refreshAll();
      if (kw) UI.showToast('已按关键词「' + kw + '」筛选', 'success');
    });
  }

  /* ============================================================
   * 7. 图表数据：聚合接口优先，失败自动降级
   * ============================================================ */
  function ensureOverview() {
    if (lastOverview) return Promise.resolve(lastOverview);
    if (legacyMode) return loadLegacy();

    var query = Object.assign({ n: CONFIG.TOP_N }, filterParams());
    return API.get('/api/stats/overview', query, { silent: true }).then(function (data) {
      lastOverview = data;
      return data;
    }).catch(function (err) {
      var msg = err && err.message ? err.message : '';
      if (/HTTP (404|405|500)/.test(msg)) legacyMode = true;
      if (global.console) console.warn('[overview] 聚合接口不可用，降级为多接口模式：', msg);
      return loadLegacy();
    });
  }

  /** 兼容模式：课程要求的 A4 / A5 + 旧 stats 接口 */
  function loadLegacy() {
    var query = filterParams();
    return Promise.all([
      API.get('/api/works/stats', query, { dedupe: false }),
      API.get('/api/stats/rating-votes-scatter', query, { dedupe: false }).catch(function () { return []; }),
      API.get('/api/stats/heatmap', query, { dedupe: false }).catch(function () { return []; }),
      API.get('/api/stats/season-analysis', query, { dedupe: false }).catch(function () { return []; }),
      API.get('/api/stats/top-directors', { n: CONFIG.TOP_N }, { dedupe: false }).catch(function () { return []; }),
      API.get('/api/movies', Object.assign({ page: 0, size: 1 }, query), { dedupe: false }).catch(function () { return null; }),
    ]).then(function (r) {
      var stats = r[0] || {};
      lastOverview = {
        kpi: computeKpiLocally(r[5], stats.yearTrend, r[2]),
        ratingDistribution: stats.ratingDistribution || [],
        yearTrend: stats.yearTrend || [],
        genreCompare: stats.genreCompare || [],
        scatterCostBox: r[1] || [],
        heatmap: r[2] || [],
        seasonAnalysis: r[3] || [],
        topDirectors: r[4] || [],
      };
      return lastOverview;
    });
  }

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
      if (years.length) { yearMin = Math.min.apply(null, years); yearMax = Math.max.apply(null, years); }
    }
    if (heatmapRaw && heatmapRaw.length) {
      var set = {};
      heatmapRaw.forEach(function (d) { if (d.country) set[d.country] = 1; });
      countryCount = Object.keys(set).length;
    }
    return { movieCount: total, avgRating: +avgRating.toFixed(2), yearMin: yearMin, yearMax: yearMax, countryCount: countryCount };
  }

  function onLoadError(err) {
    if (err && err.name === 'AbortError') return;
    UI.showToast('数据加载失败：' + (err.message || err), 'warning');
  }

  /* ============================================================
   * 8. 数据转换层（后端扁平 DTO → 前端图表期望结构）
   * ============================================================ */
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

  function transformScatter(list) {
    if (!list || !list.length) return [];
    // 评分 × 热度散点（公开数据集无真实票房，改用两个真实维度）
    return list.map(function (d) {
      return {
        movie: d.title, title: d.title,
        id: d.id,
        rating: d.rating != null ? +d.rating : 0,
        votes: d.voteCount != null ? +d.voteCount : 0,
        genre: d.country,
      };
    });
  }

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

  function transformSeason(list) {
    if (!list || !list.length) return [];
    return list.map(function (d) {
      return {
        season: d.seasonTag || d.season,
        genre: d.genre,
        avgRating: d.avgRating != null ? +d.avgRating : null,
        count: d.count,
      };
    });
  }

  /* ============================================================
   * 9. A3 作品详情弹窗
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
    // 海报：走后端代理（豆瓣 CDN 有防盗链，浏览器直连会被 418 拒绝），
    // size=large 换豆瓣大图；加载失败时 onerror 回退到渐变封面，保证不出现裂图
    var coverBg = Ranking.coverBackground(m.title || '未命名');
    return '' +
      '<div class="modal-detail">' +
        '<div class="detail-poster" style="background:' + coverBg + '">' +
          '<img src="' + CONFIG.API_BASE + '/api/works/' + m.id + '/poster?size=large" alt="' +
            Ranking.escapeHtml(m.title || '') + '" referrerpolicy="no-referrer" ' +
            'onerror="this.style.display=\'none\'">' +
          '<span class="cover-rating">' + (m.rating != null ? (+m.rating).toFixed(1) : '-') + '</span>' +
        '</div>' +
        '<div class="detail-info">' +
          '<h3>' + Ranking.escapeHtml(m.title || '未命名') + '</h3>' +
          '<p><strong>年份：</strong>' + (m.year || '-') + '　<strong>评分：</strong>' +
            (m.rating != null ? (+m.rating).toFixed(1) : '-') +
            '　<strong>评价人数：</strong>' + (m.voteCount != null ? (+m.voteCount).toLocaleString() : '-') + '</p>' +
          '<p><strong>类型：</strong>' + Ranking.escapeHtml(genres) + '</p>' +
          '<p><strong>国家/地区：</strong>' + Ranking.escapeHtml(m.country || '-') + '</p>' +
          '<p><strong>导演：</strong>' + Ranking.escapeHtml(m.director || '-') + '</p>' +
          '<p><strong>主演：</strong>' + Ranking.escapeHtml(String(cast).replace(/;\s*/g, ' / ')) + '</p>' +
          (m.releaseDate ? '<p><strong>上映日期：</strong>' + Ranking.escapeHtml(m.releaseDate) +
            (m.seasonTag ? '（' + Ranking.escapeHtml(m.seasonTag) + '）' : '') + '</p>' : '') +
          (m.duration ? '<p><strong>片长：</strong>' + m.duration + ' 分钟</p>' : '') +
          (m.link ? '<p><a href="' + Ranking.escapeHtml(m.link) + '" target="_blank" rel="noopener">在豆瓣查看这条条目 ↗</a></p>' : '') +
          (m.intro ? '<p class="detail-intro">' + Ranking.escapeHtml(m.intro) + '</p>' : '') +
        '</div>' +
      '</div>' +
      '<div class="detail-mini-chart" id="detailMiniChart"></div>';
  }

  /** 详情页迷你图：同档期（前后 3 年）影片数量柱状 */
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
      var itemColors = years.map(function (y) { return (+y) === +year ? '#fb7299' : '#bbb'; });
      var base = global.UI_THEME ? global.UI_THEME.baseOption() : {};
      mini.setOption(Object.assign({}, base, {
        title: { text: '同档期（±3年）影片数量对比', left: 'center', textStyle: { fontSize: 12 } },
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
   * 10. 主题切换 / resize / 全局异常
   * ============================================================ */
  function bindThemeToggle() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    var refreshIcon = function () {
      btn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
    };
    refreshIcon();
    btn.addEventListener('click', function () {
      document.body.classList.toggle('dark');
      refreshIcon();
      Registry.applyTheme();
    });
  }

  function bindResize() {
    var resize = UI.throttle(function () { Registry.resizeAll(); }, 200);
    global.addEventListener('resize', resize);
  }

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
