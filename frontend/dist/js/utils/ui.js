/**
 * ui.js —— UI 辅助工具
 *   - showToast(msg, type)        右上角轻量提示
 *   - showModal(htmlContent)      通用弹窗（电影详情用）
 *   - showLoading / hideLoading   图表 loading 状态
 *   - emptyHTML                   空数据占位文案
 * 挂载到 window.UI_UTILS 上（与 debounce.js 合并）
 */
(function (global) {
  'use strict';

  global.UI_UTILS = global.UI_UTILS || {};

  /* ---------- Toast ---------- */
  var toastTimer = null;
  // 相同文案在 2 秒内只提示一次：后端未启动时并发请求会同时失败，避免刷屏
  var lastToastMsg = '';
  var lastToastAt = 0;

  /**
   * 显示 Toast 提示
   * @param {string} msg   提示文本
   * @param {'success'|'warning'|'error'} [type='success']
   */
  function showToast(msg, type) {
    type = type || 'success';
    var container = document.getElementById('toastContainer');
    if (!container) return;

    var now = Date.now();
    if (msg === lastToastMsg && now - lastToastAt < 2000) return;   // 去重
    lastToastMsg = msg;
    lastToastAt = now;

    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    container.appendChild(el);

    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 2500);
  }

  /* ---------- Modal ---------- */
  /**
   * 显示电影详情模态框
   * @param {string} htmlContent 模态框内部 HTML
   */
  function showModal(htmlContent) {
    var overlay = document.getElementById('modalOverlay');
    var body = document.getElementById('modalBody');
    if (!overlay || !body) return;

    body.innerHTML = htmlContent;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';

    function close() {
      overlay.hidden = true;
      body.innerHTML = '';
      document.body.style.overflow = '';
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onEsc);
      // 关闭时触发自定义事件（让 main.js 处理详情迷你图销毁）
      global.dispatchEvent(new CustomEvent('modal:close'));
    }

    function onOverlayClick(e) { if (e.target === overlay) close(); }
    function onEsc(e) { if (e.key === 'Escape') close(); }

    document.getElementById('modalClose').onclick = close;
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onEsc);
  }

  /* ---------- Loading ---------- */
  /**
   * 给容器加 loading 状态
   * @param {string} containerId
   */
  function showLoading(containerId) {
    var el = document.getElementById(containerId);
    if (el) el.classList.add('loading');
  }
  function hideLoading(containerId) {
    var el = document.getElementById(containerId);
    if (el) el.classList.remove('loading');
  }

  /**
   * 标记空数据（图表区域友好占位）
   * @param {string} containerId
   */
  function markEmpty(containerId) {
    var el = document.getElementById(containerId);
    if (el) {
      el.classList.remove('loading');
      el.classList.add('empty');
    }
  }
  function clearEmpty(containerId) {
    var el = document.getElementById(containerId);
    if (el) el.classList.remove('empty');
  }

  // 暴露
  global.UI_UTILS.showToast = showToast;
  global.UI_UTILS.showModal = showModal;
  global.UI_UTILS.showLoading = showLoading;
  global.UI_UTILS.hideLoading = hideLoading;
  global.UI_UTILS.markEmpty = markEmpty;
  global.UI_UTILS.clearEmpty = clearEmpty;

})(window);
