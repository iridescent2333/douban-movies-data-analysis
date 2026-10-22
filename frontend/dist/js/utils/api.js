/**
 * api.js —— 统一请求工具
 * 功能：
 *   1. 自动拼接 API_BASE 前缀与 query string
 *   2. 统一业务码校验（后端 Result 成功码为 0，兼容历史 200）
 *   3. 8 秒超时（AbortController）
 *   4. localStorage 缓存包装 getWithCache
 *   5. 请求去重 + 取消陈旧请求（快速连续筛选时，旧响应不再触发重绘）
 * 挂载到 window.API
 */
(function (global) {
  'use strict';

  var CONFIG = global.APP_CONFIG;
  var CACHE_PREFIX = 'movie_dash_cache_';

  /** 进行中的请求：key -> { promise, controller } */
  var inflight = {};

  /**
   * 将 params 对象序列化为 URL 查询字符串
   * 过滤 null / undefined / 空字符串
   */
  function buildQueryString(params) {
    if (!params) return '';
    var parts = [];
    Object.keys(params).forEach(function (key) {
      var v = params[key];
      if (v === null || v === undefined || v === '') return;
      // 数组类型用逗号拼接，例如 genres: ['动作','科幻'] => genres=动作,科幻
      if (Array.isArray(v)) v = v.join(',');
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
    });
    return parts.length ? ('?' + parts.join('&')) : '';
  }

  /**
   * 带超时的 fetch 包装
   */
  function fetchWithTimeout(url, options) {
    options = options || {};
    var timeoutMs = options.timeout || CONFIG.FETCH_TIMEOUT_MS;
    var controller = null;
    var timer = null;

    if (global.AbortController) {
      controller = new AbortController();
      options.signal = controller.signal;
      timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    }

    return fetch(url, options).then(function (res) {
      if (timer) clearTimeout(timer);
      return res;
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  /**
   * 基础 GET 请求
   * @param {string} path    例如 /api/movies
   * @param {Object} params  查询参数
   * @param {Object} options { dedupe: 是否复用进行中的同 URL 请求（默认 true） }
   * @returns {Promise<*>} data 字段
   */
  function get(path, params, options) {
    options = options || {};
    var qs = buildQueryString(params);
    var url = CONFIG.API_BASE + path + qs;
    var key = path + qs;

    // 去重：同一请求已在进行中且允许复用，直接返回既有 Promise，避免并发重复请求
    if (options.dedupe !== false && inflight[key]) {
      return inflight[key].promise;
    }

    var controller = global.AbortController ? new AbortController() : null;
    var promise = fetchWithTimeout(url, {
      method: 'GET',
      signal: controller ? controller.signal : undefined,
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (body) {
      // 统一响应格式校验 —— 后端 Result 类成功码为 0（兼容历史 200）
      if (body && (body.code === 0 || body.code === 200)) {
        return body.data;
      }
      throw new Error((body && (body.msg || body.message)) || '接口返回异常（业务码非 0）');
    }).catch(function (err) {
      // 全局 toast 提示（取消请求不提示，避免筛选时的噪音；
      // options.silent 可关闭提示，用于"接口缺失自动降级"这类可预期错误）
      if (err && err.name === 'AbortError') throw err;
      if (!options.silent && global.UI_UTILS && global.UI_UTILS.showToast) {
        global.UI_UTILS.showToast('请求失败：' + (err.message || err), 'error');
      }
      throw err;
    }).finally(function () {
      delete inflight[key];
    });

    inflight[key] = { promise: promise, controller: controller };
    return promise;
  }

  /**
   * 取消所有进行中的请求。
   * 用于：用户连续调整筛选条件时，丢弃上一轮尚未返回的请求，
   *      避免旧数据后到、覆盖新数据的"闪烁"问题。
   */
  function cancelInFlight() {
    Object.keys(inflight).forEach(function (key) {
      var item = inflight[key];
      if (item && item.controller) {
        try { item.controller.abort(); } catch (e) { /* ignore */ }
      }
    });
    inflight = {};
  }

  /* ---------------- 缓存 ---------------- */

  function makeCacheKey(path, params) {
    return CACHE_PREFIX + path + buildQueryString(params);
  }

  /**
   * 带缓存的 GET 请求
   */
  function getWithCache(path, params, forceRefresh) {
    var key = makeCacheKey(path, params);
    var ttl = CONFIG.CACHE_TTL_MS;

    if (!forceRefresh) {
      try {
        var raw = localStorage.getItem(key);
        if (raw) {
          var cached = JSON.parse(raw);
          if (Date.now() - cached.ts < ttl) {
            return Promise.resolve(cached.data);
          }
        }
      } catch (e) { /* ignore */ }
    }

    return get(path, params).then(function (data) {
      try {
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
      } catch (e) { /* 可能 quota 超限 */ }
      return data;
    });
  }

  /** 清空所有本模块写入的缓存 */
  function clearCache() {
    try {
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(CACHE_PREFIX) === 0) keysToRemove.push(k);
      }
      keysToRemove.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
  }

  global.API = {
    get: get,
    getWithCache: getWithCache,
    cancelInFlight: cancelInFlight,
    clearCache: clearCache,
    buildQueryString: buildQueryString,
  };

})(window);
