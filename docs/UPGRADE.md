# 项目升级指南：H2 → MySQL + Nginx + ApiFox

> 适用版本：2026-10-19 升级后
> 当前架构：MySQL 8.0 + Spring Boot 3.2.5（端口 8081）+ Nginx 1.26.2（端口 80）+ 原生前端（dist 目录）
> 已弃用：H2 内嵌数据库 / Swagger（SpringDoc）/ python http.server

---

## 1. 需要安装的软件清单

| 软件 | 用途 | 下载地址 | 建议版本 |
|------|------|---------|---------|
| **MySQL Community Server** | 数据库 | https://dev.mysql.com/downloads/mysql/ | 8.0.x |
| **MySQLWorkbench** | 数据库 GUI 管理 | https://dev.mysql.com/downloads/workbench/ | 8.0.x |
| **Nginx for Windows** | 前端静态文件 + API 代理 | https://nginx.org/en/download.html（Windows zip 解压版） | 1.24+ |
| **ApiFox** | API 调试 + 文档（替代 Postman/Swagger） | https://apifox.com/ | 最新版 |
| **IntelliJ IDEA** | Java 后端开发（已有） | — | Ultimate 2025.x |
| **Git** | 版本控制（已有） | — | 2.x |

> 💡 **MySQL 安装建议**：用 Installer，安装时自己设置一个记得住的 root 密码，端口保持默认 3306，勾选 Windows Service 开机自启。**密码不要写进任何会被提交的文件**，请填入 `application-local.yml` 或设置为环境变量。

---

## 2. 已完成的代码改动

### 后端 pom.xml
| 改动 | 详情 |
|------|------|
| ❌ 删除 H2 依赖 | `com.h2database:h2` |
| ❌ 删除 SpringDoc 依赖 | `org.springdoc:springdoc-openapi-starter-webmvc-ui` |
| ✅ 新增 MySQL 驱动 | `com.mysql:mysql-connector-j:8.3.0` |
| ✅ 保留 OpenCSV | CSV 数据加载 |

### 后端 application.yml（当前实际配置）
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/movie_dashboard?useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useUnicode=true&characterEncoding=utf8
    driver-class-name: com.mysql.cj.jdbc.Driver
    username: root          # 本机 MySQL 账号
    password: "你的数据库密码"
  jpa:
    database-platform: org.hibernate.dialect.MySQLDialect
    hibernate:
      ddl-auto: update      # Hibernate 自动建表/更新
server:
  port: 8081                # 与 nginx.conf proxy_pass 对齐
```

### DataInitializer.java（已修复 detached 问题）
- `movieRepository.save(m)` 返回值接回 `m`（`m = movieRepository.save(m)`），保持 managed 状态
- MovieFinancial 正常入库，当前 **850 条财务记录**全部加载

### 前端 js/config.js
```javascript
API_BASE: ''   // 走 Nginx /api 反向代理，同源无跨域
```

### 关键文件
| 文件 | 作用 |
|------|------|
| `frontend/nginx-1.26.2/conf/nginx.conf` | 实际运行的 Nginx 配置（root 指向 frontend/dist） |
| `docs/nginx.conf.example` | 配置模板（路径占位符，组员 clone 后改 root 用） |
| `docs/apifox-import.json` | OpenAPI 3.0 JSON，ApiFox 可直接导入 |
| `docs/mysql-init.sql` | MySQL 建库脚本 |

---

## 3. 从零运行完整步骤

### Step 1：确认 MySQL 运行

MySQLWorkbench 用你自己的账号连接 → 执行 `docs/mysql-init.sql`：

```sql
CREATE DATABASE IF NOT EXISTS movie_dashboard DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> 库已存在则跳过。Hibernate 启动时自动建 4 张表。

### Step 2：IDEA 启动后端

1. File → Open → 选 **backend** 目录（不要选 movie-dashboard 根）
2. 右下角等 Maven 依赖下载完
3. 打开 `MovieDashboardApplication.java` → 右键 → **Run**
4. 等控制台输出：
   ```
   Tomcat started on port 8081
   Started MovieDashboardApplication in x seconds
   [DataInit] movies 表为空，开始从 CSV 加载数据...
   [DataInit] 加载完成！ 电影总数: 850  类型: 14  财务记录: 850
   ```
5. MySQLWorkbench 执行 `SELECT COUNT(*) FROM movie_dashboard.movies;` → **850**

> 后续重启会跳过加载（表已有数据）。想重新加载：`TRUNCATE TABLE movie_dashboard.movies; TRUNCATE TABLE movie_dashboard.movie_financials;` 再重启。

### Step 3：验证后端 API

```powershell
curl http://localhost:8081/api/movies?page=0&size=2
```

返回 `{"code":0,"message":"ok","data":{...}}` → 后端 OK。

### Step 4：启动 Nginx

1. 项目自带 Nginx：`frontend/nginx-1.26.2/`（或去 nginx.org 下载 1.26.2 解压到无中文路径）
2. 打开 `frontend/nginx-1.26.2/conf/nginx.conf`，确认第 25 行 root：
   ```nginx
   root D:/33333/2026web开发作业/04小组作业/movie-dashboard/frontend/dist;
   ```
   （组员改成自己本机的 `frontend/dist` 绝对路径，正斜杠）
3. 启动：
   ```powershell
   cd frontend/nginx-1.26.2
   .\nginx.exe              # 启动
   .\nginx.exe -s reload    # 改配置后重载
   .\nginx.exe -s stop      # 停止
   ```
4. 浏览器 → **http://localhost/** → 完整看板
5. 调试：日志在 `frontend/nginx-1.26.2/logs/error.log`

### Step 5：ApiFox 导入

1. ApiFox → 新建项目 → 导入 → OpenAPI/Swagger → 文件 → 选 `docs/apifox-import.json`
2. 环境 → 新建 `本地开发`，baseURL = `http://localhost`（走 Nginx）或 `http://localhost:8081`（直连后端）
3. 9 个接口自动生成，带参数说明 + 响应示例，直接调试

---

## 4. 完整运行时架构（答辩要能画出来）

```
┌──────────────────────┐     ┌──────────────────────────┐
│   浏览器 (Chrome)    │     │   Nginx (localhost:80)   │
│   http://localhost/  │────→│   root: frontend/dist/   │
└──────────────────────┘     └──────────┬───────────────┘
                                        │ location ^~ /api/
                                        │ proxy_pass → http://127.0.0.1:8081/api/
                                        ▼
                              ┌──────────────────────────┐
                              │  Spring Boot (8081)      │
                              │  Controller → Service    │
                              │  → Repository            │
                              └──────────┬───────────────┘
                                         │ JPA / Hibernate
                                         ▼
                              ┌──────────────────────────┐
                              │  MySQL 8.0 (3306)        │
                              │  movie_dashboard         │
                              │  - movies (850)          │
                              │  - genres (14)           │
                              │  - movie_genres          │
                              │  - movie_financials (850)│
                              └──────────────────────────┘
```

**为什么用 Nginx？**
- 生产环境标准部署方式（答辩展示工程能力）
- 解决 CORS：前端请求同源 `/api/`，经 Nginx 转发，浏览器无跨域
- 静态资源 7 天缓存 + SPA 路由支持
- 将来可做负载均衡（多后端实例）

---

## 5. 答辩时能展示什么

| 功能 | 展示方式 |
|------|---------|
| **真实 MySQL 数据库** | Workbench 执行 `SELECT COUNT(*) FROM movies` = 850；`SHOW CREATE TABLE movies` 展示 4 表结构 |
| **Nginx 反向代理** | 访问 http://localhost/ 看看板；F12 Network 看到请求发到 `/api/movies` 而非 `:8081` |
| **ApiFox 调试** | 打开 ApiFox 实时调用接口，改筛选参数对比返回 |
| **数据持久化** | 重启后端 → MySQL 数据还在 |
| **筛选联动** | 改年份范围 → 8 张图表 + 电影列表同步刷新 |

---

## 6. 常见问题 FAQ

| 症状 | 原因 | 解决 |
|------|------|------|
| MySQLWorkbench 连不上 | MySQL 服务没启动 | Windows 服务管理器 → MySQL80 → Start |
| 启动报 `Access denied for user 'root'` | 账号或密码不对 | 检查 `application-local.yml` / 环境变量 `DB_PASSWORD` 中的凭据 |
| 启动报 `Unknown database 'movie_dashboard'` | 库没建 | 执行 docs/mysql-init.sql |
| Nginx 启动后浏览器打不开 | 端口 80 被占（IIS/其他 nginx） | `netstat -ano \| findstr :80` 查 PID → `taskkill /F /PID xxx` |
| Nginx 前端能开但 /api 返回 404 | root 路径错或 proxy_pass 错 | 检查 nginx.conf root 指向 frontend/dist；proxy_pass 结尾斜杠 |
| Nginx 调 api 返回 502 | 后端没运行 | 先 IDEA Run 后端，确认 8081 可访问 |
| movies 表 0 条数据 | CSV 没加载 | 看 IDEA 控制台 DataInit 日志；TRUNCATE 后重启 |
| 改了 CSV 数据没变化 | DataInit 检测到有数据跳过 | TRUNCATE movies + movie_financials → 重启 |
| IDEA Run 报端口占用 | 旧 java 进程没关 | `netstat -ano \| findstr :8081` → taskkill |
| 前端图表全空 | 后端没起 / 缓存旧 JS | 先验证 8081，再 Ctrl+Shift+R 强刷 |
| ApiFox 导入失败 | JSON 格式问题 | `python -m json.tool docs/apifox-import.json` 验证 |

---

## 7. 全链路启动命令速查

```powershell
# === 1. MySQL（常驻服务，开机自启）===
net start MySQL80

# === 2. 后端（IDEA 里 Run MovieDashboardApplication，或命令行）===
cd movie-dashboard/backend
mvnw.cmd spring-boot:run
# 等看到 "Started MovieDashboardApplication"

# === 3. Nginx ===
cd movie-dashboard/frontend/nginx-1.26.2
.\nginx.exe

# === 4. 浏览器 ===
# http://localhost/                     看板
# http://localhost:8081/api/movies      后端直连验证
```

然后：浏览器打开 http://localhost/ → 完整看板。
ApiFox 导入 docs/apifox-import.json → 联调。
MySQLWorkbench → `SELECT COUNT(*) FROM movie_dashboard.movies;` → 850。
