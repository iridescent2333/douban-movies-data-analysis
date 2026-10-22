/**
 * 前端冒烟测试：在 Node 里用最小 DOM/ECharts 桩，跑通图表模块、排行榜与注册中心
 * 验证：option 构建无异常、主题名正确（app-light/app-dark）、按页面渲染、
 *      滚动懒渲染、排行榜卡片结构完整
 *
 * 运行：node scripts/frontend-smoke-test.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DIST = path.join(__dirname, '..', 'frontend', 'dist');

const el = (id) => {
  const classes = new Set();
  const children = [];
  let html = '';
  const node = {
    id, style: {}, dataset: {},
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      _set: classes,
    },
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; if (v === '') children.length = 0; },
    textContent: '',
    children,
    offsetWidth: 800, offsetHeight: 340,
    appendChild(c) {
      // DocumentFragment 拍平：把片段的 children 逐个加入
      if (c && c.__isFragment) { c.children.forEach(x => children.push(x)); return c; }
      children.push(c); return c;
    },
    removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
    getClientRects() { return [1]; }, getContext() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
  };
  return node;
};

const registry = {};
global.document = {
  getElementById: (id) => (registry[id] = registry[id] || el(id)),
  createElement: (t) => el('new-' + t),
  createDocumentFragment: () => Object.assign(el('frag'), { __isFragment: true }),
  createTextNode: (t) => ({ text: t }),
  querySelectorAll: () => [],
  querySelector: () => null,
  body: el('body'),
  documentElement: el('html'),
  readyState: 'complete',
  addEventListener() {},
};global.window = global;
global.getComputedStyle = () => ({ getPropertyValue: () => '' });
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
global.navigator = { userAgent: 'node' };
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = () => {};
global.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
global.addEventListener = () => {};

/* IntersectionObserver 桩 */
const observers = [];
global.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; this.elements = []; observers.push(this); }
  observe(elm) { this.elements.push(elm); }
  disconnect() { this.elements = []; }
  trigger() { this.cb(this.elements.map((elm) => ({ isIntersecting: true, target: elm }))); }
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
  vm.runInThisContext(fs.readFileSync(path.join(DIST, rel), 'utf8'), { filename: rel });
}

[
  'js/config.js', 'js/theme.js', 'js/chart-config.js', 'js/utils/debounce.js',
  'js/utils/api.js', 'js/utils/ui.js', 'js/charts/registry.js',
  'js/charts/ratingDistribution.js', 'js/charts/yearTrend.js', 'js/charts/genreCompare.js',
  'js/charts/scatterCostBox.js', 'js/charts/heatmap.js', 'js/charts/seasonAnalysis.js',
  'js/charts/topDirectors.js', 'js/ranking.js', 'js/works-table.js',
].forEach(load);

let fail = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fail++; };

/* ---------- 1. 主题注册 ---------- */
console.log('[1] ECharts 主题注册');
UI_THEME.registerEChartsThemes();
check(inits.some(i => i.theme === 'app-light'), '注册 app-light 主题');
check(inits.some(i => i.theme === 'app-dark'), '注册 app-dark 主题');
check(UI_THEME.palette()[0] === '#FB7299', '主色为 B 站粉 #FB7299');

/* ---------- 2. 7 个图表模块渲染 ---------- */
console.log('[2] 7 个图表模块渲染');
const scatter = [{ movie: 'A', title: 'A', cost: 1000, boxOffice: 5000, rating: 8.1, genre: '美国' }];
const samples = {
  ratingDistribution: [
    { range: '6.0-6.5', count: 12, avgRating: 6.2 },
    { range: '7.0-7.5', count: 48, avgRating: 7.2 },
  ],
  yearTrend: { years: ['1995', '1996'], counts: [34, 32], avgRatings: [6.9, 7.1] },
  genreCompare: [{ genre: '剧情', avgRating: 7.3, avgBoxOffice: 5100, count: 432 }],
  scatterCostBox: scatter,
  heatmap: { countries: ['美国', '中国大陆'], genres: ['剧情', '动作'], data: [[0, 0, 7.5], [1, 1, 6.8]] },
  seasonAnalysis: [{ season: '暑期档', genre: '动画', avgBoxOffice: 12500, avgRating: 7.8, count: 28 }],
  topDirectors: [{ director: '诺兰', count: 12, avgRating: 8.4 }],
};
Object.keys(samples).forEach((key) => {
  const before = (global.__charts || []).length;
  try {
    Charts[key].render(samples[key]);
    const after = global.__charts || [];
    check(after.length > before, `${key}: 渲染成功`);
  } catch (e) {
    check(false, `${key}: 渲染异常 -> ${e.message}`);
  }
});
check(!Charts.costBenefit && !Charts.regionCulture && !Charts.topWorks,
  '成本效益 / 地域文化 / TOP10 柱状图已按需求移除');

/* ---------- 3. 排行榜（豆瓣式卡片） ---------- */
console.log('[3] 排行榜卡片渲染');
const rankData = [
  { id: 3080, title: '冷酷的谎言往事', year: 2016, rating: 9.8, voteCount: 38616, director: 'Satyajit Ray',
    leadActor: 'Hrithik Roshan; Scarlett Johansson; 松隆子', genres: ['动画', 'Cult', '文艺'], country: '德国',
    intro: '当和平时期来临，一位退休的老兵必须面对人性深处的挣扎，做出关乎成长与告别的抉择。' },
  { id: 1, title: '测试影片', year: 2020, rating: 7.5, voteCount: 1000, director: '某导演',
    leadActor: '甲; 乙', genres: ['剧情'], country: '美国', intro: '一部测试影片。' },
];
Ranking.render(rankData, { containerId: 'rankList-overall' });
const box = registry['rankList-overall'];
const html = box.children.map(c => c.innerHTML).join('');
check(box.children.length === 2, '渲染 2 张排行榜卡片');
check(/class="rank-no top1"/.test(html), '第 1 名带 top1 高亮样式');
check(/class="rank-cover" style="background:linear-gradient/.test(html), '封面使用生成的渐变背景');
check(/cover-title/.test(html) && /冷酷的谎言往事/.test(html), '封面含影片标题');
check(/cover-rating">9\.8/.test(html), '封面右上角显示评分');
check(/导演：Satyajit Ray/.test(html), '信息区显示导演');
check(/主演：Hrithik Roshan \/ Scarlett Johansson/.test(html), '主演用 / 分隔展示');
check(/rank-intro/.test(html) && /人性深处的挣扎/.test(html), '展示故事梗概');
check(/2016<\/b> 年/.test(html), '展示上映年份');
check(/rank-tag/.test(html) && /德国/.test(html), '展示类型/地区标签');
// 封面颜色确定性：同一标题两次生成一致
check(Ranking.coverBackground('测试影片') === Ranking.coverBackground('测试影片'), '同一影片封面颜色恒定');
// 空态
Ranking.render([], { containerId: 'rankList-overall' });
check(/rank-empty/.test(box.innerHTML), '空数据有友好占位');

/* ---------- 4. 注册中心按页面渲染 ---------- */
console.log('[4] 注册中心按页面渲染');
ChartRegistry.configure({
  defs: CHART_DEFS,
  transformers: {
    transformYearTrend: (l) => ({ years: l.map(d => String(d.year)), counts: l.map(d => d.count), avgRatings: l.map(d => d.avgRating) }),
    transformScatter: (l) => l,
    transformHeatmap: (l) => l,
    transformSeason: (l) => l,
  },
});
const payload = {
  ratingDistribution: samples.ratingDistribution,
  yearTrend: [{ year: 1995, count: 34, avgRating: 6.9 }],
  genreCompare: samples.genreCompare,
  scatterCostBox: scatter,
  heatmap: samples.heatmap,
  seasonAnalysis: samples.seasonAnalysis,
  topDirectors: samples.topDirectors,
};
const beforeHome = (global.__charts || []).length;
ChartRegistry.renderAll(payload, 'home');
setTimeout(() => {
  const homeCount = (global.__charts || []).length - beforeHome;
  check(homeCount === 2, `首页只渲染 2 张图（实际 ${homeCount} 张：评分分布 + 年度趋势）`);

  // 切到深度分析页：4 张懒渲染图等滚动
  const beforeDeep = (global.__charts || []).length;
  ChartRegistry.renderAll(payload, 'insight-deep');
  setTimeout(() => {
    check((global.__charts || []).length - beforeDeep === 0, '深度分析页未滚动不渲染');
    check(observers.length === 4, `4 张图已建立视口监听（实际 ${observers.length} 个）`);
    observers.forEach(o => o.trigger());
    const deepCount = (global.__charts || []).length - beforeDeep;
    check(deepCount === 4, `滚动后渲染 4 张深度分析图（实际 ${deepCount} 张）`);

    // 主题切换：只重绘当前页（深度分析 4 张），其它页不碰
    const beforeTheme = (global.__charts || []).length;
    ChartRegistry.applyTheme();
    setTimeout(() => {
      const re = (global.__charts || []).length - beforeTheme;
      check(re === 4, `主题切换只重绘当前页图表（实际 ${re} 张，深度分析 4 张）`);
      console.log(fail === 0 ? '\n全部通过 ✅' : `\n失败 ${fail} 项 ❌`);
      process.exit(fail === 0 ? 0 : 1);
    }, 40);
  }, 40);
}, 40);
