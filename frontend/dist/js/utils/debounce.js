/**
 * debounce.js —— 通用防抖 / 节流工具
 * 挂载到 window.UI_UTILS.debounce / throttle，不污染全局
 */
(function (global) {
  'use strict';

  /**
   * 防抖函数：事件触发后 wait 毫秒内再次触发则重新计时
   * @param {Function} fn    要执行的函数
   * @param {number}   wait  等待毫秒数
   * @returns {Function}
   */
  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var ctx = this;
      var args = arguments;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        fn.apply(ctx, args);
      }, wait);
    };
  }

  /**
   * 节流函数：每隔 wait 毫秒最多执行一次
   * @param {Function} fn    要执行的函数
   * @param {number}   wait  间隔毫秒数
   * @returns {Function}
   */
  function throttle(fn, wait) {
    var lastTime = 0;
    return function () {
      var now = Date.now();
      if (now - lastTime >= wait) {
        lastTime = now;
        fn.apply(this, arguments);
      }
    };
  }

  // 暴露到全局工具命名空间
  global.UI_UTILS = global.UI_UTILS || {};
  global.UI_UTILS.debounce = debounce;
  global.UI_UTILS.throttle = throttle;

})(window);
