/**
 * dom-interaction-test.js —— jsdom 真实 DOM 交互测试
 *
 * 目的：不用浏览器，真实加载 index.html + 全部前端脚本，
 * 模拟用户操作（改筛选、点 chips、点菜单），断言发出的请求 URL 参数正确。
 *
 * 覆盖本轮回归点：
 *   1. 首页筛选面板：改类型/年份/评分 → 必须发出带对应参数的 overview/works 请求
 *   2. 影片库评分筛选：在影片库输入评分 → 请求必须带 ratingMin/ratingMax
 *   3. 分地区热榜：点地区 chip → /api/works/top 必须带 country 参数
 *   4. 分类型热榜：点类型 chip → /api/works/top 必须带 type 参数
 *   5. 分年代热榜：点年代 chip → 必须带 yearStart/yearEnd
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DIST = path.join(__dirname, '..', 'frontend', 'dist');
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8');

// ---- 请求记录 + fetch 桩 ----
const requests = [];
function canned(url) {
  const u = String(url);
  const movie = { id: 1292052, title: '肖申克的救赎', rating: 9.7, voteCount: 3225431, year: 1994,
    director: '弗兰克·德拉邦特', leadActor: '蒂姆·罗宾斯 ; 摩根·弗里曼', genres: ['剧情', '犯罪'],
    country: '美国', posterUrl: 'https://img3.doubanio.com/x.webp', intro: '简介',
    releaseDate: '1994-09-10', seasonTag: '秋季档', duration: 142, link: 'https://movie.douban.com/subject/1292052/' };
  if (u.includes('/api/types')) return { code: 0, msg: 'ok', data: ['剧情','爱情','喜剧','恐怖','悬疑','战争','历史','纪录片','动作','动画','奇幻','科幻'] };
  if (u.includes('/api/movies/filters')) return { code: 0, msg: 'ok', data: { years: [1994, 2000], countries: ['美国', '中国大陆', '中国香港'], genres: ['剧情', '动作'] } };
  if (u.includes('/api/stats/overview')) return { code: 0, msg: 'ok', data: {
    kpi: { movieCount: 2050, avgRating: 7.89, yearMin: 1931, yearMax: 2026, countryCount: 12 },
    ratingDistribution: [{ label: '8.0-8.5', count: 345, avgRating: 8.2 }],
    yearTrend: [{ year: 1994, count: 50, avgRating: 8.1 }],
    genreCompare: [{ genre: '剧情', avgRating: 7.9, avgVotes: 200000, count: 1100 }],
    scatterCostBox: [], heatmap: [], seasonAnalysis: [], topDirectors: [], topWorks: [movie] } };
  if (u.includes('/api/works/top')) return { code: 0, msg: 'ok', data: [movie] };
  if (u.includes('/api/works/stats')) return { code: 0, msg: 'ok', data: { ratingDistribution: [], yearTrend: [], genreCompare: [] } };
  if (u.includes('/api/works/') && /\/api\/works\/\d+$/.test(u)) return { code: 0, msg: 'ok', data: movie };
  if (u.includes('/api/works')) return { code: 0, msg: 'ok', data: { page: 0, size: 10, total: 1, records: [movie] } };
  return { code: 0, msg: 'ok', data: null };
}

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,   // 提供 requestAnimationFrame
});
const { window } = dom;

// fetch 桩：记录 URL，返回罐头响应
window.fetch = function (url, opts) {
  requests.push(String(url));
  return Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(canned(url)),
  });
};
// ECharts 在 jsdom 里无法初始化 canvas，置空即可（renderOne 有 try/catch，会走错误态，不影响交互测试）
window.echarts = undefined;

// ---- 按 index.html 顺序加载脚本 ----
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1].split('?')[0]);
for (const src of scripts) {
  if (src.startsWith('vendor/')) continue;      // 跳过 echarts
  const code = fs.readFileSync(path.join(DIST, src), 'utf-8');
  window.eval(code);
}

// 触发 DOMContentLoaded → bootstrap
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

// ---- 断言工具 ----
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, extra || ''); }
}
function lastReq(pred) {
  for (let i = requests.length - 1; i >= 0; i--) if (pred(requests[i])) return requests[i];
  return null;
}
function fire(el, type) {
  el.dispatchEvent(new window.Event(type, { bubbles: true }));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function main() {
  await sleep(600);   // 等 bootstrap + 首页数据加载

  console.log('\n[1] 启动与首页加载');
  check('启动请求了 /api/stats/overview', !!lastReq(u => u.includes('/api/stats/overview')));
  check('启动请求了 /api/types（填充类型下拉）', !!lastReq(u => u.includes('/api/types')));
  check('首页热榜速览请求 /api/works/top', !!lastReq(u => u.includes('/api/works/top')));

  console.log('\n[2] 首页筛选面板（用户反馈：操作无反应）');
  requests.length = 0;
  const homeType = window.document.getElementById('homeTypeSelect');
  check('首页类型下拉已被填充选项', homeType.options.length > 1, 'options=' + homeType.options.length);
  homeType.value = '剧情';
  fire(homeType, 'change');
  await sleep(500);   // 防抖 300ms
  const ovReq = lastReq(u => u.includes('/api/stats/overview'));
  check('改首页类型 → 重新拉取 overview', !!ovReq, 'requests=' + JSON.stringify(requests));
  check('overview 请求带 type=剧情 参数', !!ovReq && ovReq.includes(encodeURIComponent('剧情')), ovReq);
  const worksReq = lastReq(u => u.includes('/api/works?') || u.includes('/api/works?'.replace('?', '?')));
  check('同时刷新影片库 /api/works', !!lastReq(u => /\/api\/works\?/.test(u)));

  requests.length = 0;
  const hy = window.document.getElementById('homeYearStart');
  hy.value = '2015'; fire(hy, 'input');
  await sleep(500);
  check('首页年份区间 → overview 带 yearStart=2015', (lastReq(u => u.includes('/api/stats/overview')) || '').includes('yearStart=2015'));

  requests.length = 0;
  const preset = window.document.getElementById('ratingPreset');
  preset.value = '8-10'; fire(preset, 'change');
  await sleep(500);
  check('F4 评分快捷下拉 → overview 带 ratingMin=8', (lastReq(u => u.includes('/api/stats/overview')) || '').includes('ratingMin=8'));
  check('快捷下拉写回首页自定义输入框', window.document.getElementById('homeRatingMin').value === '8');

  console.log('\n[2.5] 连续改筛选（回归：第 2 次及以后必须生效，不能停在旧数据）');
  // 曾经的 bug：第 1 次选类型后，syncFilterInputs 把值镜像写进影片库下拉；
  // 第 2 次改首页类型时，collectFilterState 先读到影片库下拉里的旧值 → 发旧筛选 → 数据不更新。
  requests.length = 0;
  homeType.value = '战争'; fire(homeType, 'change');
  await sleep(500);
  const ov1 = lastReq(u => u.includes('/api/stats/overview'));
  check('第 1 次选"战争" → overview 带 type=战争', !!ov1 && ov1.includes(encodeURIComponent('战争')), ov1);

  requests.length = 0;
  homeType.value = '科幻'; fire(homeType, 'change');
  await sleep(500);
  const ov2 = lastReq(u => u.includes('/api/stats/overview'));
  check('第 2 次改选"科幻" → overview 必须带 type=科幻（不能还是战争）',
    !!ov2 && ov2.includes(encodeURIComponent('科幻')) && !ov2.includes(encodeURIComponent('战争')), ov2);

  requests.length = 0;
  const hy2 = window.document.getElementById('homeYearStart');
  hy2.value = '2000'; fire(hy2, 'input');
  await sleep(500);
  const ov3 = lastReq(u => u.includes('/api/stats/overview'));
  check('第 3 次改年份 → overview 带 yearStart=2000 且保留 type=科幻',
    !!ov3 && ov3.includes('yearStart=2000') && ov3.includes(encodeURIComponent('科幻')), ov3);

  console.log('\n[3] 影片库评分筛选（用户反馈：按评分查询无效）');
  // 切到影片库
  window.document.querySelector('.menu-item[data-page="library"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(400);
  requests.length = 0;
  const libMin = window.document.getElementById('ratingMin');
  libMin.value = '8.5'; fire(libMin, 'input');
  await sleep(500);
  const wReq = lastReq(u => /\/api\/works\?/.test(u));
  check('影片库输入最低评分 → /api/works 带 ratingMin=8.5', !!wReq && wReq.includes('ratingMin=8.5'), wReq);

  console.log('\n[4] 分地区热榜（用户反馈：没有生效）');
  window.document.querySelector('.menu-item[data-page="rank-region"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(400);
  const chips = window.document.querySelectorAll('#regionChips .chip');
  check('地区 chips 已渲染（含全部地区）', chips.length >= 3, 'chips=' + chips.length);
  requests.length = 0;
  chips[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));   // 美国
  await sleep(400);
  const regionReq = lastReq(u => u.includes('/api/works/top'));
  check('点地区 chip → top 带 country 参数', !!regionReq && regionReq.includes('country='), regionReq);

  console.log('\n[5] 分类型热榜');
  window.document.querySelector('.menu-item[data-page="rank-genre"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(400);
  const gchips = window.document.querySelectorAll('#genreChips .chip');
  check('类型 chips 已渲染', gchips.length >= 3, 'chips=' + gchips.length);
  requests.length = 0;
  gchips[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(400);
  const genreReq = lastReq(u => u.includes('/api/works/top'));
  check('点类型 chip → top 带 type 参数', !!genreReq && genreReq.includes('type='), genreReq);

  console.log('\n[6] 分年代热榜');
  window.document.querySelector('.menu-item[data-page="rank-era"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(300);
  const echips = window.document.querySelectorAll('#eraChips .chip');
  requests.length = 0;
  echips[3].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));   // 1990-1999
  await sleep(400);
  const eraReq = lastReq(u => u.includes('/api/works/top'));
  check('点年代 chip → top 带 yearStart=1990&yearEnd=1999',
    !!eraReq && eraReq.includes('yearStart=1990') && eraReq.includes('yearEnd=1999'), eraReq);

  console.log('\n[6.5] ID 唯一性回归（重复 id 曾导致影片库评分筛选无效）');
  const libMinEl = window.document.getElementById('ratingMin');
  const homeMinEl = window.document.getElementById('homeRatingMin');
  check('ratingMin 与 homeRatingMin 是两个不同元素', !!libMinEl && !!homeMinEl && libMinEl !== homeMinEl);
  check('影片库评分输入框在影片库页内', !!libMinEl && !!libMinEl.closest('#page-library'));

  console.log('\n[7] 详情弹窗 + 卡片视图');
  const item = window.document.querySelector('#rankList-era .rank-item');
  check('榜单渲染出影片卡片', !!item);
  if (item) {
    requests.length = 0;
    item.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await sleep(300);
    check('点击卡片 → 请求 /api/works/{id} 详情', !!lastReq(u => /\/api\/works\/\d+$/.test(u)));
    check('详情弹窗已打开', !window.document.getElementById('modalOverlay').hidden);
  }

  // 卡片视图：5 列 × 2 行海报卡
  window.document.querySelector('.menu-item[data-page="library"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(300);
  window.document.querySelector('#viewToggle .toggle-btn[data-view="card"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(400);
  const cards = window.document.querySelectorAll('#movieGrid .movie-card');
  check('卡片模式渲染出影片卡片', cards.length >= 1, 'cards=' + cards.length);
  const firstCard = cards[0];
  check('卡片含后端代理海报图', !!firstCard && /<img class="card-poster-img" src="[^"]*\/api\/works\/\d+\/poster"/.test(firstCard.innerHTML));
  check('卡片含评分徽章', !!firstCard && /card-rating/.test(firstCard.innerHTML));
  check('卡片含评价人数', !!firstCard && /card-votes/.test(firstCard.innerHTML));

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试运行异常：', e); process.exit(1); });
