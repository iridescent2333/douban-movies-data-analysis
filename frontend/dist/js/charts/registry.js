/**
 * charts/registry.js —— 图表注册中心
 *
 * 解决的问题（也是后续加图表的唯一入口）：
 *   - 以前每加/改一张图，都要动 main.js 的 reloadAll / 主题切换 / resize 三处，容易漏
 *   - 以前 8 张图在首屏全部绘制，Tab 内的 4 张图用户看不到也照画一遍，白白占 CPU
 *   - 以前 ECharts 加载失败时图表静默失败，容器永远停在"加载中..."
 *
 * 现在：
 *   - 图表清单来自 chart-config.js（纯声明）
 *   - 统一管理 init / render / resize / dispose / 主题切换 / 空态 / 错误态
 *   - Tab 内图表懒渲染：切到哪个 Tab 才画哪个
 *   - 主题切换只重绘，不再重新请求接口（响应更快）
 *
 * 对外接口：window.ChartRegistry
 */
(function (global) {
  'use strict';

  var defs = [];
  var transformers = {};
  var lastPayload = null;
  var renderedKeys = {};      // 已成功渲染过的图表
  var activeTab = null;      // 当前激活的 Tab id
  var frameHandle = null;    // requestAnimationFrame 句柄

  /* ---------------- 基础工具 ---------------- */

  function hasECharts() {
    return !!(global.echarts && global.echarts.init);
  }

  function containerOf(def) {
    return document.getElementById(def.containerId);
  }

  /** 容器状态：loading / empty / error / normal */
  function setState(def, state) {
    var el = containerOf(def);
    if (!el) return;
    el.classList.remove('loading', 'empty', 'error');
    if (state) el.classList.add(state);
  }

  function moduleOf(def) {
    var mod = global.Charts && global.Charts[def.module || def.key];
    return mod || null;
  }

  function isLazy(def) {
    return def.lazy === true || !!def.tab;
  }

  /** 是否处于可见容器中（隐藏容器 width=0，绘制会得到空图） */
  function isVisible(def) {
    var el = containerOf(def);
    if (!el) return false;
    if (def.tab && def.tab !== activeTab) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  /* ---------------- 配置 ---------------- */

  /**
   * 初始化注册中心
   * @param {Object} options {defs: 图表声明, transformers: 转换函数表}
   */
  function configure(options) {
    options = options || {};
    defs = options.defs || global.CHART_DEFS || [];
    transformers = options.transformers || transformers;
    return { count: defs.length };
  }

  /** 注册/覆盖转换函数（transformYearTrend 等） */
  function setTransformers(map) {
    Object.keys(map || {}).forEach(function (k) { transformers[k] = map[k]; });
  }

  /* ---------------- 渲染 ---------------- */

  /**
   * 渲染单个图表
   * @param {Object} def    图表声明
   * @param {Object} payload 数据集合
   */
  function renderOne(def, payload) {
    var mod = moduleOf(def);
    if (!mod || !mod.render) {
      setState(def, 'error');
      return;
    }
    if (!hasECharts()) {
      // 图表库还没就绪（本地文件缺失且 CDN 也不可达）
      setState(def, 'error');
      return;
    }
    var raw = payload ? payload[def.source] : null;
    var data = raw;
    if (def.transform && transformers[def.transform]) {
      data = transformers[def.transform](raw);
    }
    try {
      mod.render(data);
      setState(def, 'normal');
      renderedKeys[def.key] = true;
    } catch (e) {
      setState(def, 'error');
      if (global.console) console.error('[ChartRegistry] 渲染失败:', def.key, e);
    }
  }

  /**
   * 渲染全部需要立即渲染的图表（非懒渲染 + 当前 Tab 的懒渲染图表）
   * 同一帧内用 requestAnimationFrame 合并，避免连续 setOption 造成多次重排
   */
  function renderAll(payload) {
    if (payload) lastPayload = payload;
    if (frameHandle) {
      global.cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }
    frameHandle = global.requestAnimationFrame(function () {
      frameHandle = null;
      defs.forEach(function (def) {
        if (isLazy(def)) return;
        if (!isVisible(def)) return;      // 容器不可见时跳过，避免画成 0 宽
        renderOne(def, lastPayload);
      });
      renderActiveTabCharts();
    });
  }

  /** 渲染当前激活 Tab 下的懒渲染图表 */
  function renderActiveTabCharts() {
    if (!activeTab) return;
    defs.forEach(function (def) {
      if (!isLazy(def) || def.tab !== activeTab) return;
      if (!lastPayload) return;
      renderOne(def, lastPayload);
    });
  }

  /** 切换 Tab：激活对应懒渲染图表并修正尺寸（隐藏时宽度为 0） */
  function activateTab(tabKey) {
    activeTab = tabKey;
    if (!lastPayload) return;
    // 先切换 DOM 可见性由调用方完成，这里等一帧再画，保证容器已有宽度
    global.requestAnimationFrame(function () {
      renderActiveTabCharts();
      defs.forEach(function (def) {
        if (def.tab === tabKey) {
          var mod = moduleOf(def);
          if (mod && mod.resize) mod.resize();
        }
      });
    });
  }

  /* ---------------- 生命周期 ---------------- */

  /** 窗口尺寸变化：只 resize 已渲染过的图表 */
  function resizeAll() {
    defs.forEach(function (def) {
      if (!renderedKeys[def.key]) return;
      var mod = moduleOf(def);
      if (mod && mod.resize) {
        try { mod.resize(); } catch (e) { /* 忽略单张图 resize 失败 */ }
      }
    });
  }

  /** 销毁全部 ECharts 实例（主题切换前调用） */
  function disposeAll() {
    defs.forEach(function (def) {
      var mod = moduleOf(def);
      if (mod && mod.dispose) {
        try { mod.dispose(); } catch (e) { /* 忽略 */ }
      }
      renderedKeys[def.key] = false;
    });
  }

  /**
   * 主题切换：重新注册主题 → 销毁实例 → 用缓存数据重绘（不重新请求接口）
   */
  function applyTheme() {
    if (global.UI_THEME && global.UI_THEME.registerEChartsThemes) {
      global.UI_THEME.registerEChartsThemes();
    }
    disposeAll();
    renderAll(null);   // 传 null 表示沿用 lastPayload
  }

  /** 供外部查询状态 */
  function state() {
    return {
      defs: defs.length,
      rendered: Object.keys(renderedKeys).filter(function (k) { return renderedKeys[k]; }),
      activeTab: activeTab,
      echarts: hasECharts(),
      echartsStatus: global.echartsStatus,
    };
  }

  global.ChartRegistry = {
    configure: configure,
    setTransformers: setTransformers,
    renderAll: renderAll,
    renderOne: renderOne,
    activateTab: activateTab,
    resizeAll: resizeAll,
    disposeAll: disposeAll,
    applyTheme: applyTheme,
    hasECharts: hasECharts,
    setState: setState,
    state: state,
  };

})(window);
