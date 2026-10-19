/**
 * api.js —— 统一请求工具
 * 功能：
 *   1. 自动拼接 API_BASE 前缀
 *   2. 自动序列化 query string
 *   3. 统一业务码校验（后端 Result 成功码为 0，兼容历史 200），否则抛异常
 *   4. 8 秒超时支持
 *   5. localStorage 缓存包装 getWithCache
 * 挂载到 window.API
 */
(function (global) {
  'use strict';

  var CONFIG = global.APP_CONFIG;
  var CACHE_PREFIX = 'movie_dash_cache_';

  /**
   * 将 params 对象序列化为 URL 查询字符串
   * 过滤 null / undefined / 空字符串
   * @param {Object} params
   * @returns {string}
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
   * @param {string} url
   * @param {Object} options
   * @returns {Promise<Response>}
   */
  function fetchWithTimeout(url, options) {
    options = options || {};
    var timeoutMs = options.timeout || CONFIG.FETCH_TIMEOUT_MS;
    var controller;
    var timer;

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
   * @param {string} path   例如 /api/movies
   * @param {Object} params 查询参数
   * @returns {Promise<*>}  data 字段
   */
  function get(path, params) {
    var url = CONFIG.API_BASE + path + buildQueryString(params);
    return fetchWithTimeout(url, { method: 'GET' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (body) {
        // 统一响应格式校验 —— 后端 Result 类成功码为 0（兼容历史 200）
        if (body && (body.code === 0 || body.code === 200)) {
          return body.data;
        }
        throw new Error((body && body.message) || '接口返回异常（业务码非 0）');
      })
      .catch(function (err) {
        // 全局 toast 提示
        if (global.UI_UTILS && global.UI_UTILS.showToast) {
          global.UI_UTILS.showToast('请求失败：' + (err.message || err), 'error');
        }
        throw err;
      });
  }

  /**
   * 生成 localStorage 缓存 key
   */
  function makeCacheKey(path, params) {
    var qs = buildQueryString(params);
    return CACHE_PREFIX + path + qs;
  }

  /**
   * 带缓存的 GET 请求
   * @param {string} path
   * @param {Object} params
   * @param {boolean} [forceRefresh=false] 强制刷新
   * @returns {Promise<*>}
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

  /**
   * 清空所有本模块写入的缓存
   */
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
    clearCache: clearCache,
    buildQueryString: buildQueryString,
  };

})(window);
