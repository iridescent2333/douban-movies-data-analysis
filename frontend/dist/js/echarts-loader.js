/**
 * echarts-loader.js —— ECharts 加载器（本地优先 + CDN 兜底）
 *
 * 背景：此前 index.html 直接引 cdn.jsdelivr.net 的 ECharts，
 *      在国内网络下会 ERR_CONNECTION_RESET，导致 window.echarts 为空，
 *      所有图表模块静默 return，页面只剩 KPI 数字和"加载中..."。
 *
 * 现在：
 *   1. index.html 用 <script src="vendor/echarts.min.js"> 本地加载（仓库内，离线可用）；
 *   2. 若本地文件缺失/损坏，本加载器按顺序尝试多个 CDN 镜像；
 *   3. 全部失败时广播 echarts:error 事件，页面给出明确提示（而不是永久"加载中"）。
 *
 * 对外接口：
 *   window.echartsReady   —— Promise，resolve 后 window.echarts 可用
 *   window.echartsStatus  —— 'local' | 'cdn' | 'error'
 */
(function (global) {
  'use strict';

  /** 备用 CDN（按国内可达性排序） */
  var CDN_FALLBACKS = [
    'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js',
    'https://unpkg.com/echarts@5.5.0/dist/echarts.min.js',
    'https://cdn.bootcdn.net/ajax/libs/echarts/5.5.0/echarts.min.js',
    'https://registry.npmmirror.com/echarts/5.5.0/files/dist/echarts.min.js',
  ];

  var status = 'pending';
  var resolveReady;
  var readyPromise = new Promise(function (resolve) { resolveReady = resolve; });

  function setStatus(s) {
    status = s;
    global.echartsStatus = s;
  }

  function broadcast(type) {
    global.dispatchEvent(new CustomEvent(type, { detail: { status: status } }));
  }

  /** 依次尝试 CDN 镜像，第一个加载成功的即 resolve */
  function loadFromCDN(index) {
    if (index >= CDN_FALLBACKS.length) {
      setStatus('error');
      broadcast('echarts:error');
      resolveReady(false);
      return;
    }
    var script = document.createElement('script');
    script.src = CDN_FALLBACKS[index];
    script.async = true;
    script.onload = function () {
      if (global.echarts) {
        setStatus('cdn');
        broadcast('echarts:ready');
        resolveReady(true);
      } else {
        loadFromCDN(index + 1);
      }
    };
    script.onerror = function () { loadFromCDN(index + 1); };
    document.head.appendChild(script);
  }

  function init() {
    if (global.echarts) {
      // 本地 vendor/echarts.min.js 加载成功
      setStatus('local');
      broadcast('echarts:ready');
      resolveReady(true);
      return;
    }
    // 本地缺失 → 回退 CDN
    loadFromCDN(0);
  }

  global.echartsReady = readyPromise;
  global.echartsStatus = status;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
