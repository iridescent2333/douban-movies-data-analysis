/**
 * config.js —— 全局应用配置
 * 挂载到 window.APP_CONFIG，其他模块可直接读取
 */
window.APP_CONFIG = {
  /** 后端 API 基础地址 */
  API_BASE: '',            // 空串：走 Nginx 同源反向代理 /api → localhost:8081/api

  /**
   * 全站统一的「核心类型」字典（与后端 Constants.CORE_GENRES 保持一致）。
   * 前端筛选下拉、分类型热榜、类型对比、深度分析热力矩阵均使用此列表，共 12 个。
   */
  CORE_TYPES: [
    '剧情', '爱情', '喜剧', '恐怖', '悬疑', '战争',
    '历史', '纪录片', '动作', '动画', '奇幻', '科幻',
  ],

  /**
   * 全站统一的「核心地区」字典（与后端 Constants.CORE_REGIONS 保持一致）。
   * 分地区热榜、深度分析热力矩阵纵轴均使用此列表，共 10 个。
   */
  CORE_REGIONS: [
    '中国大陆', '中国台湾', '中国香港', '美国', '日本',
    '韩国', '英国', '法国', '德国', '俄罗斯',
  ],

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
