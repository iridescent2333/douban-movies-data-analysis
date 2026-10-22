/**
 * charts/registry.js —— 图表注册中心
 *
 * 多页面版：每个图表声明自己属于哪个页面（chart-config.js 的 page 字段），
 * 只有用户切到该页面时才渲染，避免一次性绘制全部图表。
 *
 * 统一管理：init / render / resize / dispose / 主题切换 / 空态 / 错误态，
 * 并支持「滚动进入视口才画」的懒渲染（IntersectionObserver）。
 *
 * 对外接口：window.ChartRegistry
 */
(function (global) {
  'use strict';

  var defs = [];
  var transformers = {};
  var lastPayload = null;
  var lastPage = null;
  var renderedKeys = {};        // 已成功渲染过的图表
  var visibilityObserved = {};  // 已建立视口监听的图表
  var frameHandle = null;       // requestAnimationFrame 句柄

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
    return def.lazy === 'visibility';
  }

  function isVisibilityLazy(def) {
    return def.lazy === 'visibility';
  }

  /** 属于某个页面的图表 */
  function defsOfPage(pageId) {
    return defs.filter(function (def) { return (def.page || null) === (pageId || null); });
  }

  /** 容器是否在视口内（隐藏页面 width=0，绘制会得到空图） */
  function isVisible(def) {
    var el = containerOf(def);
    if (!el) return false;
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
   * @param {Object} def     图表声明
   * @param {Object} payload 数据集合
   */
  function renderOne(def, payload) {
    var mod = moduleOf(def);
    if (!mod || !mod.render) { setState(def, 'error'); return; }
    if (!hasECharts()) { setState(def, 'error'); return; }

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
   * 渲染某个页面的图表
   * @param {Object} payload 数据集合（传 null 表示沿用上次的数据）
   * @param {string} pageId  页面 id
   */
  function renderAll(payload, pageId) {
    if (payload) lastPayload = payload;
    if (pageId !== undefined) lastPage = pageId;
    if (frameHandle) {
      global.cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }
    frameHandle = global.requestAnimationFrame(function () {
      frameHandle = null;
      defsOfPage(lastPage).forEach(function (def) {
        if (isLazy(def)) return;              // 懒渲染图表交给视口监听
        if (!isVisible(def)) return;          // 容器不可见时跳过，避免画成 0 宽
        renderOne(def, lastPayload);
      });
      observeVisibilityCharts();
    });
  }

  /**
   * 为「滚动懒渲染」的图表建立 IntersectionObserver：
   * 容器进入视口时自动绘制一次，之后再次进入不再重绘。
   */
  function observeVisibilityCharts() {
    var pending = defsOfPage(lastPage).filter(isVisibilityLazy);
    if (!global.IntersectionObserver) {
      // 老浏览器不支持 → 退化为立即渲染
      pending.forEach(function (def) {
        if (lastPayload) renderOne(def, lastPayload);
      });
      return;
    }
    pending.forEach(function (def) {
      if (visibilityObserved[def.key]) return;
      var el = containerOf(def);
      if (!el) return;
      visibilityObserved[def.key] = true;
      var observer = new global.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (lastPayload) renderOne(def, lastPayload);
            observer.disconnect();
          }
        });
      }, { rootMargin: '160px 0px' });
      observer.observe(el);
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
   * 主题切换：重新注册主题 → 销毁实例 → 用缓存数据重绘当前页
   * （视口懒渲染的图表若此前已画过，也一起重绘，否则切完主题会空白）
   */
  function applyTheme() {
    if (global.UI_THEME && global.UI_THEME.registerEChartsThemes) {
      global.UI_THEME.registerEChartsThemes();
    }
    var wasRendered = {};
    defs.forEach(function (def) { if (renderedKeys[def.key]) wasRendered[def.key] = true; });

    disposeAll();

    if (frameHandle) {
      global.cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }
    frameHandle = global.requestAnimationFrame(function () {
      frameHandle = null;
      defsOfPage(lastPage).forEach(function (def) {
        if (isLazy(def)) return;
        if (!isVisible(def)) return;
        renderOne(def, lastPayload);
      });
      defsOfPage(lastPage).filter(isVisibilityLazy).forEach(function (def) {
        if (wasRendered[def.key]) renderOne(def, lastPayload);
      });
      observeVisibilityCharts();
    });
  }

  /** 供外部查询状态 */
  function state() {
    return {
      defs: defs.length,
      page: lastPage,
      rendered: Object.keys(renderedKeys).filter(function (k) { return renderedKeys[k]; }),
      echarts: hasECharts(),
      echartsStatus: global.echartsStatus,
    };
  }

  global.ChartRegistry = {
    configure: configure,
    setTransformers: setTransformers,
    renderAll: renderAll,
    renderOne: renderOne,
    resizeAll: resizeAll,
    disposeAll: disposeAll,
    applyTheme: applyTheme,
    hasECharts: hasECharts,
    setState: setState,
    defsOfPage: defsOfPage,
    state: state,
  };

})(window);
