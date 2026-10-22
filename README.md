# 豆瓣电影数据洞察看板

> 面向电影产业链的多维度数据分析看板 —— Web 开发技术课程小组作业
>
> 通过 Spring Boot + MySQL + 原生前端 + ECharts，把 850 部电影的评分、票房、成本、类型、地区、档期数据整合为可交互的可视化看板，为电影投资方、制片人、导演/编剧、发行宣传等产业链角色提供决策参考。

---

## 📸 运行截图

> 📌 **截图位置**：请在答辩/提交前将实际运行截图保存到 `docs/screenshots/` 目录，并替换下方占位。

| 序号 | 截图内容 | 占位文件 |
|------|---------|---------|
| 1 | 看板整体效果（KPI + 4 张核心图表 + Tab 面板 + 电影列表） | `docs/screenshots/01-overview.png` |
| 2 | 筛选联动效果（修改筛选条件后图表与列表同步刷新） | `docs/screenshots/02-filter.png` |
| 3 | 电影详情弹窗（点击电影卡片弹出） | `docs/screenshots/03-detail.png` |
| 4 | 明暗主题切换效果 | `docs/screenshots/04-theme.png` |
| 5 | ApiFox 接口调试界面（导入 `docs/apifox-import.json` 后） | `docs/screenshots/05-apifox.png` |
| 6 | MySQL Workbench 数据量验证（`SELECT COUNT(*) FROM movies` = 850） | `docs/screenshots/06-mysql.png` |

![看板整体效果占位](docs/screenshots/01-overview.png)

---

## 🎯 项目背景与功能

### 背景

电影投资决策长期依赖经验判断，缺少直观的数据支撑。本项目以公开电影数据为基础，围绕「地域文化」「类型×档期」「投入产出」「人才图谱」「评分画像」五个维度，构建面向电影产业链的数据洞察看板。

### 核心功能

| 模块 | 功能 |
|------|------|
| **全局筛选器** | 年份范围、类型多选、国家/地区、评分区间、标题模糊搜索，debounce 300ms 触发全图表联动刷新 |
| **KPI 总览** | 电影总数、加权平均评分、年代跨度、覆盖国家/地区数，实时按筛选条件计算 |
| **核心图表（4 张）** | ① 年代趋势（数量柱状 + 评分折线双 Y 轴）<br>② 类型评分 vs 票房对比<br>③ 成本-票房散点（含线性拟合）<br>④ 国家×类型评分热力矩阵 |
| **产业链面板（4 个 Tab）** | ① 档期×类型气泡图（投资/发行视角）<br>② 导演 TOP N 柱状+折线（人才视角）<br>③ 成本效益散点（ROI 视角）<br>④ 国家→类型→评分桑基图（地域文化视角） |
| **电影列表** | 卡片网格 + 分页浏览，点击进入详情弹窗 |
| **拓展能力** | 明暗主题切换、localStorage 5 分钟缓存、请求超时控制、空数据友好占位 |

---

## 🛠 技术栈

| 分层 | 技术选型 | 选型理由 |
|------|---------|---------|
| 后端 | Java 17 · Spring Boot 3.2.5 · Spring Data JPA · MySQL Connector/J 8.3 · OpenCSV | 分层架构清晰、JPA 自动生成查询、内置连接池与 CORS；OpenCSV 用于启动时加载初始数据 |
| 数据库 | MySQL 8.0 | 真实持久化关系库，支持复杂 JOIN 与索引优化，可现场演示数据真实性 |
| 前端 | 原生 HTML5 + CSS3 + ES6 JavaScript（**无 Vue/React/axios/构建工具**） | 课程硬性要求；用 IIFE 模块化 + CSS 变量保证工程质量 |
| 图表 | Apache ECharts 5.5.0（**本地 vendor 化** + 多 CDN 兜底） | 中文文档完善，支持双轴、热力、散点、桑基等全部所需图表；本地化后断网/被墙也能正常渲染 |
| HTTP 调用 | 原生 Fetch API（自封装 `api.js`） | 统一超时 8s、缓存、错误校验，替代 axios |
| 部署 | Nginx 1.26.2（Windows） | 静态托管 + `/api/` 反向代理（同源无跨域）+ 静态资源缓存 |
| 接口管理 | ApiFox（导入 OpenAPI 3.0 JSON） | 替代 Swagger UI，适合团队协作与自动化调试 |
| 数据处理 | Python 3（pandas / requests） | 数据生成与清洗，随机种子固定保证可复现 |

---

## 📁 目录结构

```
movie-dashboard/
├── README.md                          # 本文件（项目主文档）
├── .gitignore                         # 忽略规则：编译产物/IDE/本机凭据/二进制
├── .env.example                       # 环境变量示例（复制为 .env 后填写，不入库）
├── backend/                           # 【后端】Spring Boot 工程
│   ├── pom.xml                        # Maven 依赖清单
│   ├── mvnw / mvnw.cmd                # Maven Wrapper（无需全局安装 Maven）
│   └── src/main/
│       ├── java/com/movie/dashboard/
│       │   ├── MovieDashboardApplication.java      # 启动类
│       │   ├── config/                             # 配置层
│       │   │   ├── CorsConfig.java                 # 跨域配置（Nginx 代理之外的兜底）
│       │   │   └── DataInitializer.java            # 启动自检 + 从 CSV 加载初始数据
│       │   ├── controller/                         # REST 接口层
│       │   │   ├── MovieController.java            # /api/movies 系列
│       │   │   └── StatsController.java            # /api/stats/* 系列
│       │   ├── service/                            # 业务逻辑层
│       │   │   ├── MovieService.java               # 分页查询 / 详情 / 筛选器选项
│       │   │   └── StatsService.java               # 6 类图表聚合 + 筛选过滤
│       │   ├── repository/                         # 数据访问层（JPA）
│       │   │   ├── MovieRepository.java            # 多条件筛选 JPQL + 分页
│       │   │   ├── GenreRepository.java
│       │   │   └── MovieFinancialRepository.java
│       │   ├── entity/                             # 数据库实体（映射 4 张表）
│       │   │   ├── Movie.java  Genre.java  MovieFinancial.java
│       │   ├── dto/                                # 请求/响应数据传输对象（10 个）
│       │   └── exception/                          # 统一响应 + 全局异常处理
│       │       ├── Result.java                     # {code, message, data}
│       │       └── GlobalExceptionHandler.java     # @ControllerAdvice
│       └── resources/
│           ├── application.yml                     # 主配置（环境变量占位，无真实凭据）
│           ├── application-local.yml.example       # 本地配置模板 → 复制为 application-local.yml
│           ├── schema.sql                          # 建表 DDL（4 张表）
│           └── data/movies.csv                     # 850 条初始数据（启动时加载）
├── frontend/
│   ├── dist/                     # 【前端】Nginx 部署根目录
│   │   ├── index.html             # 单页应用入口
│   │   ├── css/style.css          # 明暗主题 + CSS Grid 布局
│   │   ├── vendor/echarts.min.js  # ECharts 5.5.0 本地副本（离线可用，不受 CDN 屏蔽影响）
│   │   └── js/                    # 19 个 JS 文件：config + theme + chart-config + loader + main + utils(3) + charts(9)
│   │       ├── config.js          # 全局配置（API_BASE 为空串，走 Nginx 同源代理）
│   │       ├── theme.js           # 设计令牌：CSS 变量 + ECharts 主题（app-light / app-dark）同源
│   │       ├── chart-config.js    # 图表声明表：新增图表只加一行
│   │       ├── echarts-loader.js  # ECharts 加载器：本地优先，失败自动回退多个 CDN
│   │       ├── main.js            # 入口：初始化、事件绑定、数据转换层、调度注册中心
│   │       ├── utils/             # api.js(fetch封装+去重+取消) / debounce.js / ui.js
│   │       └── charts/            # registry.js(注册中心) + 8 个 ECharts 图表模块
│   └── nginx-1.26.2/              # 组长本机的 Nginx（二进制，.gitignore 排除；组员需自行下载）
├── scripts/                       # 数据脚本（Python）与前端自测脚本
│   ├── generate_data.py           # 数据生成器（种子 42，可复现）
│   ├── convert_to_normalized.py   # CSV → 规范化 SQL（H2 时代产物，保留备查）
│   ├── init_h2_sql.py             # 同上（H2 时代遗留，待清理）
│   ├── frontend-smoke-test.js     # 前端冒烟测试：node scripts/frontend-smoke-test.js
│   ├── requirements.txt           # Python 依赖清单
│   └── movies.csv                 # 生成的数据副本（与后端 classpath 内 CSV 同源）
├── CONTRIBUTING.md                # 贡献指南入口（PR/Issue 时 GitHub 自动提示）
└── docs/                          # 文档（入口：docs/README.md 索引）
    ├── README.md                  # 文档地图 + 三条阅读路线
    ├── 团队协作指南.md             # GitHub 协作全流程：分支保护 / PR / Issue / 规范
    ├── 快速上手.md                 # 从零到跑起来（环境/配置/启动/FAQ/版本演进）
    ├── 代码说明.md                 # 模块职责 / 核心流程 / 数据模型 / 扩展指引
    ├── 数据库与API契约.md          # 表结构 + 接口契约 + JSON 示例
    ├── 项目逻辑流程.md             # 开发路线图 + 时序图 + 扩展点
    ├── 组员任务清单.md             # 三人分工明细与进度
    ├── 答辩预案.md                 # 开场白 + 演示流程 + 高频问答
    ├── 数据说明.md                 # 数据分布与生成规则
    ├── AI使用记录表.md             # AI 辅助占比如实记录（课程要求）
    ├── apifox-import.json         # ApiFox 导入文件（OpenAPI 3.0，9 个接口）
    ├── mysql-init.sql             # MySQL 建库脚本
    └── nginx.conf.example         # Nginx 配置模板（路径占位符，组员复制后改 root）
```

---

## ✅ 环境要求

| 软件 | 版本要求 | 用途 | 备注 |
|------|---------|------|------|
| JDK | 17 及以上 | 后端编译运行 | 编译产物为 Java 17 字节码 |
| MySQL Server | 8.0.x | 数据存储 | 需记住自己设置的账号密码 |
| MySQL Workbench | 8.0.x | 数据库 GUI 管理 | 选装，用于验证数据 |
| Nginx | 1.24+（Windows 解压版） | 前端托管 + API 代理 | ⚠️ 二进制不入库，组员 clone 后需自行下载（见 `docs/快速上手.md`） |
| IntelliJ IDEA | 2023+ | 后端开发调试 | 选装，也可命令行 Maven |
| ApiFox | 最新版 | 接口调试 | 选装 |
| Python | 3.8+ | 数据脚本（可选） | 仅需重新生成数据时使用 |
| Git | 2.x | 版本控制 | |

---

## 🚀 安装与启动

启动顺序固定为：**MySQL → 后端 → Nginx**，三者缺一不可。

### Step 0 · 准备数据库（仅首次）

```sql
-- MySQL Workbench 打开 docs/mysql-init.sql 执行，或直接执行：
CREATE DATABASE IF NOT EXISTS movie_dashboard
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 1 · 配置数据库连接（仅首次）

二选一：

```bash
# 方式 A（推荐）：复制模板，填写自己的账号密码
cd backend/src/main/resources
cp application-local.yml.example application-local.yml     # Windows: copy
# 编辑 application-local.yml 里的 password

# 方式 B：设置环境变量（优先级最高）
export DB_USERNAME=root
export DB_PASSWORD=你的密码
export DB_HOST=localhost DB_PORT=3306 DB_NAME=movie_dashboard SERVER_PORT=8081
# Windows PowerShell：$env:DB_PASSWORD="你的密码"
```

> ⚠️ `application-local.yml` 与 `.env` 已在 `.gitignore` 中排除，**不会进入版本库**。
> 全部可配变量见 `.env.example`。

### Step 2 · 启动后端

```bash
cd backend
mvnw.cmd spring-boot:run          # Windows
./mvnw spring-boot:run            # macOS / Linux
# 或 IDEA：打开 MovieDashboardApplication.java → 右键 Run
```

首次启动会依次完成：Hibernate 自动建 4 张表 → DataInitializer 从 `movies.csv` 加载 850 条数据 → 监听 **8081** 端口。

成功标志（控制台）：

```
Started MovieDashboardApplication in x seconds
  API 基地址 : http://localhost:8081/api
  [DataInit] 加载完成！ 电影总数: 850  类型: 14  财务记录: 850
```

> 后续重启若表中已有数据则跳过加载。想重新加载：先执行
> `TRUNCATE TABLE movie_dashboard.movies; TRUNCATE TABLE movie_dashboard.movie_financials;` 再重启。

### Step 3 · 配置并启动 Nginx

> ⚠️ `frontend/nginx-1.26.2/` 被 .gitignore 排除（二进制不入库），**clone 仓库的同学需自行到 nginx.org 下载**，解压到无中文/无空格路径。

```bash
# 用仓库模板生成配置：复制 docs/nginx.conf.example 覆盖 <你的nginx>/conf/nginx.conf
# 把 root 一行的 __YOUR_FRONTEND_DIST_PATH__ 改成本项目 frontend/dist 的绝对路径（正斜杠）
# listen 当前为 8083（80 被占用时的团队约定）；若改回 80，访问地址变成 http://localhost/
```

```powershell
cd frontend/nginx-1.26.2
.\nginx.exe              # 启动
.\nginx.exe -s reload    # 改配置后重载
.\nginx.exe -s stop      # 停止
```

### Step 4 · 打开看板

浏览器访问 **http://localhost:8083/**（Ctrl+Shift+R 强刷避免旧缓存）。

### Step 5 · ApiFox 调试接口（可选）

ApiFox → 新建项目 → 导入 → OpenAPI/Swagger → 选 `docs/apifox-import.json` → 新建环境，`baseURL` 填 `http://localhost:8083`（走 Nginx）或 `http://localhost:8081`（直连后端）。

---

## ⚡ 性能与体验优化（2026-10 改造）

| 优化点 | 做法 | 实测效果 |
|--------|------|---------|
| **图表库离线可用** | ECharts 5.5.0 本地化到 `frontend/dist/vendor/`，加载失败自动回退 4 个 CDN 镜像 | 断网/被墙也能渲染，不再整屏"加载中..." |
| **1 次请求出整屏** | 新增 `/api/stats/overview`：后端只查一次 movies + 一次 financials，6 类图表在内存里基于同一份数据算出 | 整屏数据请求 **2725ms → 600ms**（约 4.5 倍） |
| **响应压缩** | 后端开启 gzip（`server.compression`），Nginx 模板同时对静态资源开 gzip | overview 响应 **71KB → 14KB**（-80%） |
| **Tab 懒渲染** | Tab 面板内 4 张图改为"切到才画" | 首屏少绘 4 张图，主线程更早可交互 |
| **请求去重 + 取消陈旧响应** | `api.js` 记录进行中的请求；连续筛选时 abort 上一轮，避免旧数据覆盖新数据 | 快速调整筛选不再出现数据"闪回" |
| **主题切换零请求** | 切换明暗主题只重绘图表，复用内存中的数据 | 主题切换不再触发 6 个接口 |
| **列表渲染优化** | DocumentFragment 批量插入 + 事件委托 + HTML 转义 | 减少重排，标题含特殊字符也不会破坏结构 |
| **UI 调优单一入口** | 页面 CSS 变量与 ECharts 主题同源于 `js/theme.js` | 改配色只动 1 个文件，8 个图表零改动 |

> 前端自测：`node scripts/frontend-smoke-test.js`（无浏览器也能验证 8 张图表的 option 构建与调度逻辑）。

---

## 📡 接口说明

统一前缀 `/api`，统一响应格式 `{"code":0,"message":"ok","data":...}`（`code=0` 表示成功）。

| # | Method | 路径 | 说明 | 主要参数 |
|---|--------|------|------|---------|
| 1 | GET | `/api/movies` | 电影分页列表 + 多条件筛选 | `page`(0起) `size` `yearStart` `yearEnd` `genres`(逗号分隔) `country` `ratingMin` `ratingMax` `title` |
| 2 | GET | `/api/movies/{id}` | 单部电影详情（含类型、财务） | 路径 id |
| 3 | GET | `/api/movies/filters` | 筛选器下拉选项（年份/国家/类型） | — |
| 4 | GET | `/api/stats/year-trend` | 逐年电影数量与平均评分 | 支持全部筛选参数 |
| 5 | GET | `/api/stats/genre-compare` | 类型平均评分 vs 平均票房 | 支持全部筛选参数 |
| 6 | GET | `/api/stats/scatter-cost-box` | 成本-票房散点（含评分/片名） | 支持全部筛选参数 |
| 7 | GET | `/api/stats/heatmap` | 国家 × 类型评分热力矩阵 | 支持全部筛选参数 |
| 8 | GET | `/api/stats/season-analysis` | 档期 × 类型交叉分析 | 支持全部筛选参数 |
| 9 | GET | `/api/stats/top-directors` | 导演作品 TOP N | `n`（后端默认 10，前端传 20；当前不随其他筛选联动） |
| 10 | GET | `/api/stats/overview` | **看板聚合接口**：一次返回 6 类图表数据 + KPI 汇总 | 支持全部筛选参数 + `n` |

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "content": [{"id": 3080, "title": "冷酷的谎言往事", "rating": 9.8, "genres": ["动画","Cult"]}],
    "totalElements": 850,
    "totalPages": 71
  }
}
```

> 分页字段遵循 Spring Data 约定：`content` / `totalElements` / `totalPages`，`page` **从 0 开始**
> （前端页码从 1 起，由 `main.js` 做换算）。
> 完整契约与更多示例见 [`docs/数据库与API契约.md`](docs/数据库与API契约.md)。

---

## 📊 数据来源与数据模型

### 数据来源

| 项 | 说明 |
|----|------|
| 主方案 | Kaggle TMDB 公开电影数据集（含预算/票房/评分字段） |
| 备选 | Python 爬虫抓取豆瓣公开榜单（遵守 robots） |
| 当前数据 | 由 `scripts/generate_data.py` 确定性生成（`random.seed(42)`），任意机器结果一致 |
| 入库方式 | CSV → Python 清洗 → `DataInitializer` 经 JPA 写入 MySQL（**非静态文件直读**） |

### 数据规模

| 指标 | 数值 |
|------|------|
| 电影总数 | **850** 条 |
| 年份跨度 | 1995 – 2025（31 年） |
| 类型数 | **14** 种（剧情/喜剧/爱情/动画/科幻/悬疑/恐怖/动作/战争/文艺/主旋律/纪录片/短片/Cult） |
| 国家/地区 | **10** 个（中国大陆、中国香港、中国台湾、美国、日本、韩国、印度、英国、法国、德国） |
| 财务数据 | 850 条财务记录（每部电影一条），其中 **418 条**含预算+票房数值 |
| 评分分布 | 正态 N(7.0, 1.2)，截断至 2.0–9.8 |

### 数据模型（4 张表，满足第三范式）

```
genres ──< movie_genres >── movies ──1:1── movie_financials
```

| 表名 | 职责 | 关键字段 |
|------|------|---------|
| `movies` | 电影主表 | id, title, director, lead_actor, country, release_year, duration, rating, vote_count, intro, poster_url |
| `genres` | 类型字典表 | id, name（唯一） |
| `movie_genres` | 电影-类型多对多关联 | movie_id, genre_id（联合主键） |
| `movie_financials` | 财务信息（稀疏字段独立成表） | movie_id（主键）, budget_wan, box_office_wan, release_date, season_tag |

> 设计要点：类型拆分 + 关联表满足 3NF 原子性；财务字段稀疏故独立建表以避免大量 NULL；
> 年份列名实际为 `release_year`（避开 SQL 保留字 `YEAR`）。
> 详见 [`docs/代码说明.md`](docs/代码说明.md) 与 [`docs/数据库与API契约.md`](docs/数据库与API契约.md)。

---

## 👥 组员分工

| 成员 | 角色 | 负责模块 |
|------|------|---------|
| 张** | 组长 | 后端全链路（Spring Boot 架构、Entity/DTO/Controller/Service）+ MySQL + Nginx 部署 + 总协调 + 答辩主讲 |
| 钟** | 前端 | 页面结构（HTML/CSS）+ 8 张 ECharts 图表 + 筛选联动 + 明暗主题切换 |
| 曹** | 拓展 | Git 协作 + 数据生成脚本 + ApiFox 接口联调测试 + 文档 + 拓展图表（成本效益/地域文化） |

> 姓名已按课程提交要求脱敏（保留姓氏 + 星号）。详细分工见 `docs/组员任务清单.md`。

---

## 🤝 团队协作

仓库：<https://github.com/iridescent2333/douban-movies-data-analysis>

- **分支模型**：`main` 受保护，只接受 PR；每人从最新 main 切 `feature/*` 分支开发
- **合并要求**：至少 1 人 review 通过 + PR 检查单全过 + 意见全部解决
- **Commit 规范**：Conventional Commits（`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`）
- **任务分派**：GitHub Issues + Projects 看板，做完 PR 描述写 `Closes #编号`
- **完整流程**（邀请成员、分支保护配置、审查清单、协作节奏）：见 [`docs/团队协作指南.md`](docs/团队协作指南.md)

---

## ❓ 常见问题（FAQ）

| 现象 | 原因 | 解决办法 |
|------|------|---------|
| 后端报 `Access denied for user` | 账号或密码不对 | 检查 `application-local.yml` / `.env` 中的凭据 |
| 后端报 `Unknown database 'movie_dashboard'` | 库没建 | 执行 `docs/mysql-init.sql` |
| 后端报 `Communications link failure` | MySQL 服务没启动 | Windows：`net start MySQL80`；macOS：`brew services start mysql` |
| 页面能打开但图表全空 | 后端没起来 / 前端 JS 缓存 | 先验证 `http://localhost:8081/api/movies?page=0&size=1`；再 Ctrl+Shift+R 强刷 |
| F12 里 `/api/...` 报 **502 Bad Gateway** | Nginx 转发不到后端 | 确认后端在 8081 监听，检查 nginx.conf 的 `proxy_pass` 端口 |
| 页面 404 且样式全丢 | nginx.conf 的 `root` 路径不对 | 改成本机 `frontend/dist` 绝对路径（正斜杠）后 `nginx.exe -s reload` |
| Nginx 启动失败 | 8083 端口被占用（团队约定端口，原 80 常被 IIS / 旧 nginx 占） | `netstat -ano \| findstr :8083` 查 PID → `taskkill /F /PID xxx`，或再换一个 `listen` 端口并同步本文档 |
| IDEA Run 报 `Port 8081 already in use` | 旧进程没关 | `netstat -ano \| findstr :8081` → `taskkill /F /PID xxx` |
| 改了 CSV 但数据没变 | DataInitializer 检测到表非空会跳过 | `TRUNCATE` movies 与 movie_financials 后重启 |
| 筛选后数量没变化 | 前端 localStorage 缓存 5 分钟 | Ctrl+Shift+R 强刷或清缓存验证 |
| ApiFox 导入失败 | JSON 格式问题 | `python -m json.tool docs/apifox-import.json` 校验 |
| 图表全空白 + 控制台 `ERR_CONNECTION_RESET` | **旧版本**直接引 cdn.jsdelivr.net 的 ECharts，CDN 被墙导致 `window.echarts` 为空 | 现已把 ECharts 本地化到 `frontend/dist/vendor/echarts.min.js`；确认该文件存在（未被误删），并 **Ctrl+Shift+R 强刷** |
| 改了前端代码但页面没变化 | Nginx 对 js/css 设了 7 天强缓存 | Ctrl+Shift+R 强刷；或 `.\nginx.exe -s reload` |
| 调后端时提示"聚合接口不可用" | 前后端版本不匹配（后端未重启到新版） | 重启后端即可；前端会自动降级为旧的 6 接口模式，功能不受影响 |
| 组员 clone 后启动无数据 | 正常，首次启动会加载 CSV | 等控制台出现 `[DataInit] 加载完成！` |
| 组员 clone 后没有 nginx 目录 | 正常，二进制被 .gitignore 排除 | 自行下载 Nginx，按 `docs/快速上手.md` Step 3 配置 |

更多排查细节见 [`docs/快速上手.md`](docs/快速上手.md)。

---

## 📚 文档导航

完整文档地图与阅读路线见 [`docs/README.md`](docs/README.md)。常用入口：

| 文档 | 用途 |
|------|------|
| [`docs/团队协作指南.md`](docs/团队协作指南.md) | **三人协作必读**：分支模型、PR 流程、Commit 规范、审查清单 |
| [`docs/快速上手.md`](docs/快速上手.md) | 新组员/换电脑：从零安装到看板跑起来 + FAQ |
| [`docs/代码说明.md`](docs/代码说明.md) | 模块职责、核心流程、数据模型、二次开发与扩展指引 |
| [`docs/数据库与API契约.md`](docs/数据库与API契约.md) | 表结构、接口参数与响应 JSON 示例（改接口前必读） |
| [`docs/apifox-import.json`](docs/apifox-import.json) | ApiFox 直接导入 |
| [`docs/nginx.conf.example`](docs/nginx.conf.example) | Nginx 配置模板 |
| [`docs/答辩预案.md`](docs/答辩预案.md) | 演示流程与老师高频问答 |
| [`docs/AI使用记录表.md`](docs/AI使用记录表.md) | AI 使用占比如实记录 |

---

## 🔒 隐私与配置安全

- 配置文件中**不含任何真实凭据**：数据库连接通过环境变量 `${DB_USERNAME}` / `${DB_PASSWORD}` 注入
- 本地凭据载体（`application-local.yml`、`.env`）已在 `.gitignore` 中排除
- 文档中的组员姓名已脱敏为「姓氏 + 星号」

---

*Web 开发技术 · 小组作业 · 2026*
