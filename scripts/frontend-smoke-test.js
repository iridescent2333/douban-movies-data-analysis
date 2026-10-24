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
  'js/charts/ratingDistribution.js', 'js/charts/yearTrend.js', 'js/charts/topWorksBar.js',
  'js/charts/genreCompare.js', 'js/charts/scatterCostBox.js', 'js/charts/heatmap.js',
  'js/charts/seasonAnalysis.js', 'js/charts/topDirectors.js', 'js/ranking.js', 'js/works-table.js',
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
const scatter = [{ movie: 'A', title: 'A', id: 1, rating: 8.1, votes: 500000, genre: '美国' }];
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
check(!Charts.costBenefit && !Charts.regionCulture,
  '成本效益 / 地域文化图表已按需求移除');
check(!!Charts.topWorksBar, 'F7 横向柱状图模块已回归（课程要求）');

/* ---------- 2.5 热力图轴对齐回归（曾经 x/y 对调导致越界+转置） ---------- */
console.log('[2.5] 热力图 地区×类型 轴对齐');
const HM_TYPES = ['剧情','爱情','喜剧','恐怖','悬疑','战争','历史','纪录片','动作','动画','奇幻','科幻'];
const HM_REGIONS = ['中国大陆','中国台湾','中国香港','美国','日本','韩国','英国','法国','德国','俄罗斯'];
const hmData = [];
HM_TYPES.forEach((g, gi) => HM_REGIONS.forEach((c, ri) => {
  if ((gi + ri) % 3 === 0) hmData.push([gi, ri, 6 + (gi % 4) * 0.5, (gi + 1) * (ri + 1)]);
}));
hmData.push([11, 9, 7.2, 5]);   // 边界点：类型索引 11=科幻、地区索引 9=俄罗斯
Charts.heatmap.render({ countries: HM_REGIONS, genres: HM_TYPES, data: hmData });
const hmRec = global.__charts[global.__charts.length - 1];
const hmOpt = hmRec.options[hmRec.options.length - 1];
const hmGLen = hmOpt.xAxis.data.length, hmCLen = hmOpt.yAxis.data.length;
const hmPts = hmOpt.series[0].data;
let hmOob = 0;
hmPts.forEach((p) => { if (p[0] < 0 || p[0] >= hmGLen || p[1] < 0 || p[1] >= hmCLen) hmOob++; });
check(hmGLen === 12 && hmCLen === 10, `热力图轴 x=12 类型 / y=10 地区（实际 ${hmGLen}/${hmCLen}）`);
check(hmOob === 0, `热力图 ${hmPts.length} 个数据点全部落在轴范围内（越界 ${hmOob}）`);
const hmBoundary = hmPts.find((p) => p[2] === 7.2);
check(!!hmBoundary && hmOpt.xAxis.data[hmBoundary[0]] === '科幻' && hmOpt.yAxis.data[hmBoundary[1]] === '俄罗斯',
  '热力图边界点 [11,9] → 科幻 × 俄罗斯（证明 x/y 未转置）');

/* ---------- 3. 排行榜（豆瓣式卡片） ---------- */
console.log('[3] 排行榜卡片渲染');
const rankData = [
  { id: 1292052, title: '肖申克的救赎', year: 1994, rating: 9.7, voteCount: 3225431, director: '弗兰克·德拉邦特',
    leadActor: '蒂姆·罗宾斯; 摩根·弗里曼', genres: ['剧情', '犯罪'], country: '美国',
    posterUrl: 'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p480747492.webp',
    intro: '一场谋杀案使银行家安迪蒙冤入狱，希望在监狱中生根发芽。' },
  { id: 1291561, title: '千与千寻', year: 2019, rating: 9.4, voteCount: 2490528, director: '宫崎骏',
    leadActor: '柊瑠美; 入野自由', genres: ['剧情', '动画'], country: '日本',
    posterUrl: 'https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2557573348.webp',
    intro: '千寻误入神灵世界，为拯救父母展开冒险。' },
];
Ranking.render(rankData, { containerId: 'rankList-overall' });
const box = registry['rankList-overall'];
const html = box.children.map(c => c.innerHTML).join('');
check(box.children.length === 2, '渲染 2 张排行榜卡片');
check(/class="rank-no top1"/.test(html), '第 1 名带 top1 高亮样式');
check(/class="rank-cover" style="background:linear-gradient/.test(html), '封面使用生成的渐变背景');
check(/cover-title/.test(html) && /肖申克的救赎/.test(html), '封面含影片标题');
check(/cover-rating">9\.7/.test(html), '封面右上角显示评分');
check(/导演：弗兰克·德拉邦特/.test(html), '信息区显示导演');
check(/主演：蒂姆·罗宾斯 \/ 摩根·弗里曼/.test(html), '主演用 / 分隔展示');
check(/rank-intro/.test(html) && /蒙冤入狱/.test(html), '展示故事梗概');
check(/1994<\/b> 年/.test(html), '展示上映年份');
check(/rank-tag/.test(html) && /美国/.test(html), '展示类型/地区标签');
check(/class="rank-poster" src="[^"]*\/api\/works\/1292052\/poster"/.test(html), '封面走后端海报代理（真实豆瓣海报）');
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

  // 切到深度分析页：scatter/heatmap 进入即渲染（修复首屏空白），season/topDirectors 仍懒渲染等滚动
  const beforeDeep = (global.__charts || []).length;
  const obsBefore = observers.length;
  ChartRegistry.renderAll(payload, 'insight-deep');
  setTimeout(() => {
    const immediate = (global.__charts || []).length - beforeDeep;
    check(immediate === 2, `深度分析页打开即渲染 scatter/heatmap 2 张（实际 ${immediate} 张，避免空白）`);
    check(observers.length - obsBefore === 2, `season/topDirectors 2 张图已建立视口监听（实际 ${observers.length - obsBefore} 个）`);
    observers.forEach(o => o.trigger());
    const deepCount = (global.__charts || []).length - beforeDeep;
    check(deepCount === 4, `懒渲染触发后共 4 张深度分析图（实际 ${deepCount} 张）`);

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
