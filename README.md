# 🎬 豆瓣电影数据洞察看板

> 基于 **2050 部真实豆瓣电影**的全栈数据可视化看板：原生前端 + ECharts 呈现，Spring Boot + MySQL 提供数据，从评分、热度、类型、地区、年代等多维度洞察优质影片。

<p align="center">
  <b>原生 HTML + CSS + JavaScript</b> · <b>ECharts 5</b> · <b>Spring Boot 3</b> · <b>MySQL 8</b> · <b>Nginx</b>
</p>

---

## 📌 项目概述

**豆瓣电影数据洞察看板**是 Web 开发技术课程的小组作业（对应课程"图书/电影数据分析看板"选题，取**电影**方向）。项目以 Kaggle 公开的豆瓣电影数据集（CC0 公有领域）为数据源，清洗得到 **2050 条真实记录**（覆盖 1931–2026 年），构建一个覆盖"总览 → 榜单 → 洞察 → 明细"完整链路的数据看板。

- **实现目标**：严格遵循课程规范——数据入库 MySQL、由 Spring Boot 后端查询返回（不可前端直读静态文件），前端用原生 HTML/CSS/JS + `fetch` + ECharts 渲染，不引入 Vue/React/axios。
- **课程符合度**：完整覆盖前端功能 **F1–F9** 与后端接口 **A1–A5**。
- **访问方式**：本地 Nginx 托管前端（8083）并反向代理 `/api` 到后端（8081），浏览器访问 `http://localhost:8083/`。

---

## ✨ 功能特性

- **🌐 全局筛选联动**：类型 / 年份区间 / 评分区间单一数据源，任一变化即重新请求后端，首页图表、KPI、热榜、影片库**全链路同步刷新**，图表与列表结果始终一致。
- **📊 8 张 ECharts 图表**：评分分布直方图、年度趋势双轴图、热门 TOP10 横向柱状图、类型对比（双轴柱状 / 三维雷达双视图）、评分×热度散点图、地区×类型热力矩阵、档期×类型气泡图、导演 TOP N。
- **🔁 图表点击反选筛选**：点评分分布柱体、类型对比柱体/雷达顶点，即可反向写入筛选条件，实现"看图即筛选"。
- **🏆 四大榜单**：综合 / 分地区 / 分年代 / 分类型，支持按评分 / 按评价人数排序，豆瓣式影片卡片（封面 + 评分 + 导演 + 主演 + 梗概）。
- **🎞️ 影片库（F9）**：表格 / 卡片双视图，多条件筛选 + 分页，点击查看详情弹窗；表格含**封面列**。
- **🖼️ 海报代理**：后端代理豆瓣 CDN 图片（规避 Referer 防盗链）并按 MD5 缓存，前端同源引用。
- **🌗 明暗主题**、**🔍 全局搜索**、**⚡ 请求层优化**（防抖 / 超时 / 取消陈旧请求 / localStorage 缓存）。

---

## 🛠️ 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| **前端** | 原生 HTML + CSS + JavaScript（ES6+） | 无框架、无构建工具，`frontend/dist` 直接运行 |
| **图表** | Apache ECharts 5 | 已本地化（`vendor/echarts.min.js`），断网可用 |
| **通信** | 原生 `fetch` | 统一封装：query 拼接 / 业务码校验 / 超时 / 去重取消 / 缓存 |
| **后端** | Spring Boot 3.2.5 · JDK 17 · Spring Data JPA | Controller / Service / Repository 分层 |
| **数据库** | MySQL 8.0 | 2050 条真实数据 |
| **数据导入** | OpenCSV + DataInitializer | 启动检测空表自动从 CSV 入库 |
| **API 文档** | SpringDoc OpenAPI（Swagger UI） | `/swagger-ui.html` 自动生成、可在线调试 |
| **反向代理** | Nginx | 8083 托管前端 + `/api` 代理到 8081，同源避跨域 |

---

## 🖥️ 页面展示

看板为"左侧多级菜单 + 右侧内容按页切换"布局，共 6 大页面：

### 1. 首页（数据总览）
左侧全局筛选面板（类型 / 年份 / 评分）+ 4 个 KPI 指标卡（电影总数、平均评分、年代跨度、国家地区数）+ **F5 评分分布**柱状图 + **F6 年度趋势**双轴图 + **F7 综合热榜** TOP5 速览。所有模块随筛选实时刷新。

### 2. 综合热榜
**F7 热门 TOP10** 横向柱状图 + 豆瓣式影片卡片列表，支持按**评分 / 评价人数**切换排序，点击卡片查看详情。

### 3. 分地区热榜
中国大陆 / 中国香港 / 中国台湾 / 美国 / 日本 / 韩国 / 英国 / 法国 / 德国等地区 Tab 切换，展示对应地区高分热门影片（含评分、评价人数、导演、主演、梗概）。

### 4. 类型对比（F8）
各类型"平均评分"与"平均热度（评价人数）"**双轴柱状图**，可切换**三维雷达图**（评分 / 数量 / 热度）；图例可显隐，点击柱体反选类型筛选。

### 5. 深度分析
**评分 × 热度散点图**（对数轴、按地区着色、气泡映射热度）+ **地区 × 类型热力矩阵**（10 地区 × 12 类型，颜色 = 平均评分）+ 档期 × 类型气泡图 + 导演 TOP N。

### 6. 影片库（F9）
表格 / 卡片双视图，多条件筛选 + 每页 10 条分页；表格列为**封面 → ID → 标题 → 导演 → 类型 → 评分 → 评价人数 → 年份**；点击打开详情弹窗。

---

## 🚀 快速开始

> 详细步骤与 FAQ 见 [《部署与运行说明》](docs/部署与运行说明.md)。启动顺序：**MySQL → 后端(8081) → Nginx(8083)**。

### 环境要求
JDK 17+ · Maven 3.8+（或用 `mvnw`）· MySQL 8.0 · Nginx 1.24+ · 现代浏览器

### 1) 建库
```sql
CREATE DATABASE IF NOT EXISTS movie_dashboard
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2) 启动后端（首次自动导入 2050 条数据）
```bash
cd backend
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
# 编辑 application-local.yml 填写数据库密码
mvnw.cmd spring-boot:run        # Windows
./mvnw spring-boot:run          # macOS / Linux
```

### 3) 启动 Nginx
复制 `docs/nginx.conf.example` 为 Nginx 的 `conf/nginx.conf`，把 `root` 改成本机 `frontend/dist` 绝对路径，`listen 8083`，`/api/` 代理到 `http://127.0.0.1:8081/api/`，然后 `nginx.exe` 启动。

### 4) 访问看板
浏览器打开 **http://localhost:8083/**（**Ctrl+Shift+R 强刷**避免旧缓存）。

- 接口在线文档：http://localhost:8081/swagger-ui.html
- 后端直连验证：`curl http://localhost:8081/api/works?page=0&size=2`

---

## 📂 项目目录结构

```
movie-dashboard/
├── backend/                        # Spring Boot 后端
│   └── src/main/
│       ├── java/com/movie/dashboard/
│       │   ├── controller/         # 接口层（Movie / Works / Stats / Types / Poster）
│       │   ├── service/            # 业务层（MovieService / StatsService）
│       │   ├── repository/         # 数据访问层（JPA）
│       │   ├── entity/  dto/       # 实体与数据传输对象
│       │   ├── config/             # CORS / 数据初始化 / OpenAPI
│       │   └── exception/          # 统一返回 + 全局异常
│       └── resources/
│           ├── data/movies.csv     # 2050 条真实数据（自动入库）
│           ├── schema.sql          # 建表脚本
│           └── application*.yml    # 配置（local 本地密码不入库）
├── frontend/dist/                  # 前端（Nginx 直接托管）
│   ├── index.html
│   ├── css/style.css
│   ├── js/                         # main / ranking / works-table / config …
│   │   └── charts/                 # 8 个 ECharts 模块 + registry 注册中心
│   └── vendor/echarts.min.js       # 本地化 ECharts
├── scripts/                        # 数据清洗 + 前端回归测试
│   ├── build_dataset.py            # Kaggle 原始数据 → 规范化 movies.csv
│   ├── dom-interaction-test.js     # jsdom 交互回归测试
│   └── frontend-smoke-test.js      # 图表渲染冒烟测试
└── docs/                           # 项目文档
    ├── 项目说明文档.md · 部署与运行说明.md · 功能使用手册.md
    ├── 答辩预案.md · AI使用记录表.md
    ├── nginx.conf.example · reset-db.sql
```

---

## 👥 团队信息（04 小组）

| 成员 | 角色 | 主要负责 |
|------|------|----------|
| **张同学** | 组长 | 后端全链路（Spring Boot / JPA / MySQL）、数据导入、总协调、答辩主讲 |
| **钟同学** | 组员 | 前端页面与样式、ECharts 图表、主入口与交互逻辑 |
| **曹同学** | 组员 | Git 协作规范、数据清洗脚本、测试、文档 |

---

## 📝 版本记录与更新说明

| 版本 | 说明 |
|------|------|
| **v1.0（当前）** | 课程交付版：MySQL + Spring Boot(8081) + Nginx(8083) 全栈架构；2050 条真实豆瓣数据；覆盖 F1–F9 / A1–A5；含筛选全链路联动、8 图表、双视图影片库、海报代理、明暗主题。 |

**近期完善**：
- 数据标准化：类型归并为 **12 个核心类型**、地区聚焦 **10 个核心地区**，口径全站统一；
- 修复首页筛选"二次筛选不更新"（镜像面板回读）、F9 表格列错位并新增**封面列**、评价人数表头对齐；
- 修复深度分析热力矩阵 **x/y 轴对调**与**配色发白**问题，矩阵完整可见；
- 前端补充 jsdom 交互回归测试与图表冒烟测试。

> 更早历史：初期为 H2 原型，后迁移至 MySQL 全栈版本；接口文档由 SpringDoc Swagger 自动生成。

---

## 📄 许可证与文档

- 数据来源：[Douban Movies Dataset](https://www.kaggle.com/datasets/dengfuping/douban-movies-dataset)（CC0 公有领域）
- 详细文档见 [`docs/`](docs/)：项目说明 · 部署运行 · 功能使用 · 答辩预案 · AI 使用记录
- 本项目仅用于课程学习与教学演示。
