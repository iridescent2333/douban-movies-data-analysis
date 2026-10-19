/**
 * config.js —— 全局应用配置
 * 挂载到 window.APP_CONFIG，其他模块可直接读取
 */
window.APP_CONFIG = {
  /** 后端 API 基础地址 */
  API_BASE: '',            // 走 Nginx 反向代理 /api → localhost:8080/api

  /** 筛选输入防抖时间（毫秒） */
  DEBOUNCE_MS: 300,

  /** localStorage 缓存有效期（5 分钟） */
  CACHE_TTL_MS: 5 * 60 * 1000,

  /** 默认分页大小 */
  DEFAULT_PAGE_SIZE: 12,

  /** 排行榜 TOP N */
  TOP_N: 20,

  /** 请求超时（毫秒） */
  FETCH_TIMEOUT_MS: 8000,

  /** ECharts 主题名：亮色默认用 null（自带），暗色用 'dark' */
  ECHARTS_THEME_DARK: 'dark',
};
