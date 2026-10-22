/**
 * 前端冒烟测试：在 Node 里用最小 DOM/ECharts 桩，跑通 10 个图表模块与注册中心
 * 验证：option 构建无异常、主题名正确（app-light/app-dark）、注册中心调度正确
 *      （核心图首屏渲染 / 深度分析区滚动懒渲染 / Tab 懒渲染 / 主题切换重绘）
 *
 * 运行：node scripts/frontend-smoke-test.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DIST = path.join(__dirname, '..', 'frontend', 'dist');

const el = (id) => {
  const classes = new Set();
  return {
    id, style: {},
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      _set: classes,
    },
    innerHTML: '', textContent: '', children: [], offsetWidth: 800, offsetHeight: 340,
    appendChild(c) { this.children.push(c); return c; }, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
    getClientRects() { return [1]; }, getContext() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
  };
};

const registry = {};
global.document = {
  getElementById: (id) => (registry[id] = registry[id] || el(id)),
  createElement: (t) => el('new-' + t),
  createDocumentFragment: () => el('frag'),
  createTextNode: (t) => ({ text: t }),
  querySelectorAll: () => [],
  querySelector: () => null,
  body: el('body'),
  documentElement: el('html'),
  readyState: 'complete',
  addEventListener() {},
};
global.window = global;
global.getComputedStyle = () => ({ getPropertyValue: () => '' });
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
global.navigator = { userAgent: 'node' };
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = () => {};
global.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
global.addEventListener = () => {};

/* IntersectionObserver 桩：记录被观察元素，手动触发交叉 */
const observers = [];
global.IntersectionObserver = class {
  constructor(cb, options) { this.cb = cb; this.options = options; this.elements = []; observers.push(this); }
  observe(el) { this.elements.push(el); }
  disconnect() { this.elements = []; }
  trigger() {
    this.cb(this.elements.map((el) => ({ isIntersecting: true, target: el })));
  }
};

const inits = [];
global.echarts = {
  version: '5.5.0-smoke',
  registerTheme: (name) => inits.push({ theme: name }),
  graphic: {
    LinearGradient: class { constructor(a, b, c) { this.offset0 = a; this.offset1 = b; this.colorStops = c; } },
    RadialGradient: class { constructor() {} },
  },
  init: (dom, theme) => {
    const rec = { dom, theme, options: [] };
    rec.instance = {
      setOption: (opt) => { rec.options.push(opt); },
      dispose() {}, resize() {}, on() {}, off() {}, getDataURL: () => 'data:,',
    };
    (global.__charts = global.__charts || []).push(rec);
    return rec.instance;
  },
};

function load(rel) {
  const code = fs.readFileSync(path.join(DIST, rel), 'utf8');
  vm.runInThisContext(code, { filename: rel });
}

[
  'js/config.js', 'js/theme.js', 'js/chart-config.js', 'js/utils/debounce.js',
  'js/utils/api.js', 'js/utils/ui.js', 'js/charts/registry.js',
  'js/charts/ratingDistribution.js', 'js/charts/yearTrend.js', 'js/charts/topWorks.js',
  'js/charts/genreCompare.js', 'js/charts/scatterCostBox.js', 'js/charts/heatmap.js',
  'js/charts/seasonAnalysis.js', 'js/charts/topDirectors.js', 'js/charts/costBenefit.js',
  'js/charts/regionCulture.js',
].forEach(load);

let fail = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fail++; };

/* ---------- 1. 主题注册 ---------- */
console.log('[1] ECharts 主题注册');
UI_THEME.registerEChartsThemes();
check(inits.some(i => i.theme === 'app-light'), '注册 app-light 主题');
check(inits.some(i => i.theme === 'app-dark'), '注册 app-dark 主题');
check(UI_THEME.current() === 'app-light', '当前主题 app-light');
document.body.classList.add('dark');
check(UI_THEME.current() === 'app-dark', '切到暗色后主题切换为 app-dark');
document.body.classList.remove('dark');

/* ---------- 2. 10 个图表模块单独渲染 ---------- */
console.log('[2] 10 个图表模块渲染');
const scatter = [{ movie: 'A', title: 'A', cost: 1000, boxOffice: 5000, rating: 8.1, genre: '美国' }];
const samples = {
  ratingDistribution: [
    { range: '6.0-6.5', count: 12, avgRating: 6.2 },
    { range: '6.5-7.0', count: 30, avgRating: 6.7 },
    { range: '7.0-7.5', count: 48, avgRating: 7.2 },
  ],
  yearTrend: { years: ['1995', '1996'], counts: [34, 32], avgRatings: [6.9, 7.1] },
  topWorks: [{ id: 1, title: 'A', director: 'D', rating: 9.4, voteCount: 86213, year: 2010, genres: ['科幻'] }],
  genreCompare: [{ genre: '剧情', avgRating: 7.3, avgBoxOffice: 5100, count: 432 }],
  scatterCostBox: scatter,
  heatmap: { countries: ['美国', '中国大陆'], genres: ['剧情', '动作'], data: [[0, 0, 7.5], [1, 1, 6.8]] },
  seasonAnalysis: [{ season: '暑期档', genre: '动画', avgBoxOffice: 12500, avgRating: 7.8, count: 28 }],
  topDirectors: [{ director: '诺兰', count: 12, avgRating: 8.4 }],
  costBenefit: scatter,
  regionCulture: [{ country: '美国', genre: '动作', avgRating: 7.5, count: 1 }],
};

Object.keys(samples).forEach((key) => {
  const before = (global.__charts || []).length;
  try {
    Charts[key].render(samples[key]);
    const after = global.__charts || [];
    const rec = after[after.length - 1];
    const ok = after.length > before && rec && rec.options.length > 0;
    check(ok, `${key}: 渲染成功（theme=${rec && rec.theme}）`);
  } catch (e) {
    check(false, `${key}: 渲染异常 -> ${e.message}`);
  }
});

/* ---------- 3. 视图切换（F7 / F8） ---------- */
console.log('[3] F7 / F8 视图切换');
try {
  Charts.topWorks.setMode('votes');
  Charts.topWorks.render(samples.topWorks);
  check(true, 'topWorks 切换到"按评价人数"');
  Charts.genreCompare.setMode('radar');
  Charts.genreCompare.render(samples.genreCompare);
  const rec = (global.__charts || []).slice(-1)[0];
  check(rec.options[0].radar != null, 'genreCompare 切换到雷达图（含 radar 配置）');
} catch (e) {
  check(false, '视图切换异常 -> ' + e.message);
}

/* ---------- 4. 注册中心调度 ---------- */
console.log('[4] 图表注册中心调度');
ChartRegistry.configure({
  defs: CHART_DEFS,
  transformers: {
    transformYearTrend: (l) => ({ years: l.map(d => String(d.year)), counts: l.map(d => d.count), avgRatings: l.map(d => d.avgRating) }),
    transformScatter: (l) => l,
    transformHeatmap: (l) => l,
    transformSeason: (l) => l,
    transformRegionCulture: (l) => l,
  },
});
const payload = {
  ratingDistribution: samples.ratingDistribution,
  yearTrend: [{ year: 1995, count: 34, avgRating: 6.9 }],
  genreCompare: samples.genreCompare,
  topWorks: samples.topWorks,
  scatterCostBox: scatter,
  heatmap: samples.heatmap,
  seasonAnalysis: samples.seasonAnalysis,
  topDirectors: samples.topDirectors,
};
const beforeAll = (global.__charts || []).length;
ChartRegistry.renderAll(payload);
setTimeout(() => {
  const core = (global.__charts || []).length - beforeAll;
  check(core === 4, `首屏只渲染核心区 4 张图（实际 ${core} 张，F5-F8）`);

  // 深度分析区（visibility 懒渲染）：未滚动不画
  const beforeVis = (global.__charts || []).length;
  check(observers.length === 4, `深度分析区 4 张图已建立视口监听（实际 ${observers.length} 个）`);
  check((global.__charts || []).length - beforeVis === 0, '未滚动进入视口 → 深度分析区不渲染');
  observers.forEach(o => o.trigger());   // 模拟滚动到位
  const renderedVis = (global.__charts || []).length - beforeVis;
  check(renderedVis === 4, `滚动进入视口后渲染 4 张深度分析图（实际 ${renderedVis} 张）`);

  // 切到 Tab → 懒渲染 1 张
  const beforeTab = (global.__charts || []).length;
  ChartRegistry.activateTab('costBenefit');
  setTimeout(() => {
    const renderedTab = (global.__charts || []).length - beforeTab;
    check(renderedTab === 1, `切到 Tab 后懒渲染 1 张图（实际 ${renderedTab} 张）`);

    // 主题切换：只重绘不请求
    const beforeTheme = (global.__charts || []).length;
    ChartRegistry.applyTheme();
    setTimeout(() => {
      const re = (global.__charts || []).length - beforeTheme;
      check(re >= 9, `主题切换重绘 ${re} 张图`);
      console.log(fail === 0 ? '\n全部通过 ✅' : `\n失败 ${fail} 项 ❌`);
      process.exit(fail === 0 ? 0 : 1);
    }, 40);
  }, 40);
}, 40);
