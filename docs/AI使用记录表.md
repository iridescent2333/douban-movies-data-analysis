# AI 使用记录表

> 给谁看的：老师验收（必须提交）+ 组员内部复盘  
> 阅读指引：**如实逐文件填写，不夸大不隐瞒**。开头是总的说明（本组如何平衡 AI 使用和自主学习），后面按文件逐个记录。AI 辅助范围用百分比估算，自己做的修改要写清楚改了什么。

---

## 🔹 本组如何平衡 AI 使用和自主学习

我们的总体原则是：

1. **AI 帮我们写"重复劳动"**：pom.xml 依赖配置、Entity/DTO 的 @Data 注解样板、Swagger `@Operation` 注解、Controller 的参数声明、ECharts 基础配置（比如 tooltip、legend 通用设置）——这些模板化的代码让 AI 快速生成，省掉我们查 Lombok 注解叫什么名字、SpringDoc 参数怎么写的时间。
2. **核心业务逻辑自己写**：Service 层的 JPQL 多表连接、统计分组、筛选条件组合、Python 数据生成器的分布控制（正态分布参数、预算偏置、档期规则）——这些 AI 生成的往往不符合真实业务需求，我们自己设计并实现。
3. **每个 AI 生成的片段必须自己读懂**：代码合并前先通读一遍，加注释或重构，确保完全理解 AI 写了什么。比如 AI 生成的 `PageRequest.of(page, size)` 我们去查了 Spring Data 的文档知道 page 是从 0 开始的，不然容易和前端从 1 开始的页码对不上。
4. **AI 调试失败时自己排查**：如果 AI 给的代码报错（比如 H2 不支持某条 SQL、跨域没配好），我们自己用 Google / Stack Overflow 找原因，然后修改 AI 给的代码。
5. **Python 数据生成器几乎全自己写**：因为我们需要精确控制分布特征（评分正态 N(7.0, 1.2)、预算类型偏置、档期规则、国家权重），AI 很难一次性写出符合这些精确要求的代码。

---

## 🔹 后端文件明细

### config/ 包

| 文件                     | AI 辅助做了什么                                    | AI 生成占比 | 自己做的修改和理解                                                                 |
|--------------------------|---------------------------------------------------|------------|-----------------------------------------------------------------------------------|
| CorsConfig.java          | 生成基础 CorsConfiguration + addCorsMappings 模板  | 60%        | 补上了 allowedOrigins 里的 Live Server 端口、allowedHeaders: `*`、credentials: true |
| OpenApiConfig.java       | 生成 OpenAPI Bean + @ConfigurationProperties 注解  | 50%        | 手动改成硬编码 title/version，不用配置文件；加了 servers 配置                       |
| DataInitializer.java     | 生成 CommandLineRunner 模板                       | 40%        | 改成了 `if (genreRepository.count() == 0)` 才初始化，避免每次重启重复插入 genres      |

### controller/ 包

| 文件                 | AI 辅助做了什么                                         | AI 生成占比 | 自己做的修改和理解                                                                       |
|----------------------|--------------------------------------------------------|------------|-----------------------------------------------------------------------------------------|
| MovieController.java | 生成三个方法骨架、@Operation + @Parameter Swagger 注解 | 50%        | 自己实现了 MovieQueryDTO 的参数组装（List<String> genres 怎么传、yearStart/yearEnd 的处理） |
| StatsController.java | 生成六个统计接口骨架 + Swagger 注解                     | 45%        | 自己加了 topDirectors 的 `@RequestParam(defaultValue = "10")` 默认值                      |

### service/ 包

| 文件                | AI 辅助做了什么                                             | AI 生成占比 | 自己做的修改和理解                                                                     |
|---------------------|------------------------------------------------------------|------------|---------------------------------------------------------------------------------------|
| MovieService.java   | 类结构 + 基础 CRUD 方法骨架                                 | 25%        | **主要是自己写的**：JPQL 筛选条件拼接（多个 genres 怎么 IN 查询、评分区间怎么 between）、详情里财务数据的合并逻辑、FilterOptionsDTO 的组装 |
| StatsService.java   | 类结构 + 每个统计方法的方法签名                              | 20%        | **完全自己写的**：6 个统计查询的 JPQL/原生 SQL 都自己设计，包含 GROUP BY + AVG/COUNT + JOIN 的复杂查询 |

### repository/ 包

| 文件                       | AI 辅助做了什么                     | AI 生成占比 | 自己做的修改和理解                                       |
|----------------------------|------------------------------------|------------|---------------------------------------------------------|
| MovieRepository.java       | 接口骨架 + findBy... 命名查询       | 50%        | 补上了 `Page<Movie> findAll()`、`List<Movie> findByYearBetween` 等命名查询；加了一个原生 @Query 按国家分组 |
| MovieFinancialRepository.java | 接口骨架                          | 40%        | 自己加了 `Optional<MovieFinancial> findByMovieId(Long movieId)`  |
| GenreRepository.java       | 接口骨架                           | 30%        | 自己加了 `List<Genre> findAll()` + `Optional<Genre> findByName(String name)` |

### entity/ 包

| 文件                | AI 辅助做了什么                          | AI 生成占比 | 自己做的修改和理解                                             |
|---------------------|-----------------------------------------|------------|---------------------------------------------------------------|
| Movie.java          | @Entity + @Data + 基础字段 + @OneToMany | 70%        | 把 @OneToMany 改成了 @ManyToMany 通过 movie_genres 关联表；加了 @Table(indexes=...) |
| MovieFinancial.java | @Entity + @Data + 字段                   | 75%        | 改成 @OneToOne + @JoinColumn 指向 Movie 的主键                 |
| Genre.java          | @Entity + @Data + 字段                   | 75%        | 加了 unique=true 在 name 字段                                  |

### dto/ 包（共 10 个）

| 文件                     | AI 辅助做了什么                              | AI 生成占比 | 自己做的修改和理解                                     |
|--------------------------|---------------------------------------------|------------|-------------------------------------------------------|
| MovieDTO.java            | 类骨架 + 字段 + @Data + Swagger @Schema 注解 | 65%        | 自己选了精简字段（只留列表页需要的 8 个字段）           |
| MovieDetailDTO.java      | 类骨架 + @Schema                            | 60%        | 自己设计了内嵌静态类 FinancialInfo；加了 null 检查字段  |
| MovieQueryDTO.java       | 类骨架 + 参数字段 + @Data                   | 55%        | 自己写了构造器、setter 链式调用辅助方法                |
| FilterOptionsDTO.java    | 类骨架 + 三个 List 字段                     | 70%        | 改成 record（后来 Lombok Data 也行，最终用 Data）       |
| YearTrendDTO.java        | 类骨架 + 三个字段                           | 60%        | 加了 totalCount / avgRating / avgBoxOffice             |
| GenreCompareDTO.java     | 类骨架 + 字段                               | 60%        | 加了 name + count + avgRating + avgBoxOffice            |
| ScatterPointDTO.java     | 类骨架 + 散点三个维度                       | 70%        | 加了 title + budgetWan + boxOfficeWan + rating（供 tooltip 显示） |
| HeatmapDTO.java          | 类骨架 + 国家类型平均评分                    | 70%        | 改成 country + genre + avgRating + count               |
| SeasonAnalysisDTO.java   | 类骨架 + 档期 × 类型 × 指标                  | 60%        | 加了 seasonTag + genre + avgBoxOffice + avgRating + count |
| DirectorTopDTO.java      | 类骨架 + 导演 TOP N                         | 65%        | 加了 director + movieCount + avgRating                 |

### exception/ 包

| 文件                        | AI 辅助做了什么                                  | AI 生成占比 | 自己做的修改和理解                                                   |
|-----------------------------|-------------------------------------------------|------------|----------------------------------------------------------------------|
| Result.java                 | 类骨架 + code/message/data 三个字段 + 工厂方法  | 70%        | 自己设计了 ok(String message, T data) 和 error(int code, String msg) 两个重载 |
| GlobalExceptionHandler.java | @RestControllerAdvice 骨架                       | 60%        | 自己加了 @ExceptionHandler(MovieNotFoundException.class) 和 @ExceptionHandler(MethodArgumentNotValidException.class) |

### resources/

| 文件                            | AI 辅助做了什么                              | AI 生成占比 | 自己做的修改和理解                                       |
|---------------------------------|---------------------------------------------|------------|---------------------------------------------------------|
| application.yml                 | server.port / datasource / jpa 基础配置模板   | 50%        | 早期配过 H2 文件模式 + springdoc；**后来自己改造**：迁移为 MySQL 数据源、账号密码改为环境变量占位 `${DB_USERNAME}/${DB_PASSWORD}`、补 HikariCP 连接池与错误响应配置 |
| schema.sql                      | CREATE TABLE 语句模板                        | 45%        | 自己设计了 4 张表的字段；加了索引；改成 CREATE TABLE IF NOT EXISTS  |
| data/data.sql（已删除）          | ——                                          | 0%         | 原由 init_h2_sql.py 生成的 H2 专用 MERGE 语句；**本次收尾时删除**（迁移 MySQL 后已无用，数据改由 DataInitializer 从 CSV 加载） |
| pom.xml                         | Spring Boot Parent + 依赖声明模板             | 60%        | 自己移除了 H2 与 springdoc-openapi 依赖，替换为 mysql-connector-j 8.3.0；移除了 Lombok（手写 getter/setter 规避 JDK 兼容问题）|

---

## 🔹 前端文件明细

### 根目录

| 文件            | AI 辅助做了什么                              | AI 生成占比 | 自己做的修改和理解                                                               |
|-----------------|---------------------------------------------|------------|---------------------------------------------------------------------------------|
| index.html      | HTML5 基础结构 + ECharts CDN + script 加载顺序 | 40%        | **自己写的结构**：header / 筛选条 / KPI / 2×2 核心图表 / Tab / 列表 / 模态框 的布局 |

### css/

| 文件          | AI 辅助做了什么                                      | AI 生成占比 | 自己做的修改和理解                                                          |
|---------------|-----------------------------------------------------|------------|--------------------------------------------------------------------------|
| style.css     | CSS 变量明暗两套色板 + 基础 reset + 卡片阴影模板      | 25%        | **主要自己写**：Flex + Grid 布局、图表容器最小高度统一 360px、筛选条样式、模态框动画、电影卡片 grid、分页按钮、主题切换过渡效果 |

### js/ 根目录

| 文件       | AI 辅助做了什么                            | AI 生成占比 | 自己做的修改和理解                                                          |
|------------|-------------------------------------------|------------|--------------------------------------------------------------------------|
| config.js  | const API_BASE 一行 + 几个常量            | 30%        | 最终形态为 `API_BASE: ''`（空串，走 Nginx 同源代理，不再直连 8080）；自定了防抖 300ms / 缓存 5 分钟 / 超时 8s / TOP_N 20 |
| main.js    | DOMContentLoaded 入口 + 事件绑定骨架       | 15%        | **全部自己写**：初始化顺序、筛选联动 debounce 调度、KPI 数据拉取、分页逻辑、主题切换时所有图表重新 init |

### js/utils/

| 文件               | AI 辅助做了什么                                 | AI 生成占比 | 自己做的修改和理解                                                          |
|--------------------|------------------------------------------------|------------|--------------------------------------------------------------------------|
| debounce.js        | debounce(fn, wait) 基础实现（闭包 + clearTimeout） | 75%        | 自己加了 leading/trailing 参数支持（虽然最后只用 trailing）；加了 cancel() 方法 |
| api.js             | fetchJSON(url) 骨架 + 错误处理                  | 50%        | 自己加了 URLSearchParams 拼接查询参数（数组转逗号分隔）；统一错误显示 Toast；加了 timeout（AbortController **8 秒**超时，与 config.js 的 FETCH_TIMEOUT_MS 一致） |
| ui.js              | showToast / openModal / closeModal 骨架         | 35%        | **自己写了电影卡片渲染函数**（从 MovieDTO 列表生成卡片 HTML，海报用占位图）；自己写了分页按钮渲染 |

### js/charts/（8 个）

| 文件                | AI 辅助做了什么                                              | AI 生成占比 | 自己做的修改和理解                                                                      |
|---------------------|-------------------------------------------------------------|------------|----------------------------------------------------------------------------------------|
| yearTrend.js        | ECharts 折线图 option 骨架（tooltip + legend + grid）         | 50%        | 自己实现了双 Y 轴（电影数左轴、平均评分右轴）；自己写了从 YearTrendDTO 数组转成 series 数据的逻辑 |
| genreCompare.js     | 柱状图 option 骨架                                           | 45%        | 自己实现横向双柱（评分×1000 与平均票房同轴对比）、按类型数量倒序、tooltip 格式化（柱上加 label 显示评分） |
| scatterCostBox.js   | 散点图 option 骨架                                           | 40%        | 自己实现气泡大小映射评分（symbolSize 用 data[2] 值，范围 clamp 到 8-60）；自己写 tooltip 格式化 |
| heatmap.js          | 热力图 option 骨架 + visualMap 色阶                           | 50%        | 自己把后端返回的 HeatmapDTO 转成 ECharts 需要的二维数组格式 `[[col, row, value], ...]`  |
| seasonAnalysis.js   | 气泡图 option 骨架                                           | 40%        | 自己实现颜色映射评分（visualMap + 分数段）；气泡大小映射票房；tooltip 里格式化预算/票房为万元单位 |
| topDirectors.js     | 横向柱状图 option 骨架                                       | 55%        | 自己实现 X 轴（导演名）和 Y 轴（作品数）的反转；自己加了 label 显示平均评分               |
| costBenefit.js      | ——                                                          | 0%         | **全部自己写**：前端基于 scatterCostBox 原始数据二次加工，按预算分桶、算 ROI 和平均评分，组合图 |
| regionCulture.js    | ——                                                          | 0%         | **全部自己写**：桑基图的三层 nodes/links 拼接逻辑，从 heatmap + genreCompare 两个接口数据合成 |

---

## 🔹 Python 脚本文件

| 文件                | AI 辅助做了什么                                    | AI 生成占比 | 自己做的修改和理解                                                                    |
|---------------------|---------------------------------------------------|------------|--------------------------------------------------------------------------------------|
| generate_data.py    | random 基础 API 用法、CSV 写出模板                 | 15%        | **90% 自己写**：真实电影/导演/演员/类型/国家名单；正态分布参数；类型预算偏置映射；档期规则；质量检查统计 |
| init_h2_sql.py      | ——                                                | 0%         | **全部自己写**：读 CSV → INSERT INTO movies + INSERT INTO genres + 多对多 INSERT INTO movie_genres + INSERT INTO movie_financials（H2 时代产物，MySQL 迁移后已被 DataInitializer 取代，脚本保留待清理） |

---

## 🔹 一个典型案例：AI vs 自己

**场景**：写 StatsService.heatmap() 方法，需要按国家 × 类型聚合平均评分。

**AI 给的代码**：
```java
@Query("SELECT m.country, g.name, AVG(m.rating), COUNT(m.id) FROM Movie m JOIN m.genres g GROUP BY m.country, g.name")
List<Object[]> heatmap();
```

AI 这一段能用，但有两个问题：① 返回的是 `List<Object[]>`，不优雅；② 没有过滤没有类型的电影（虽然我们数据集里没有，但防御性编程应该加）；③ 没处理返回值里可能为 null 的情况。

**自己改成**：
```java
public List<HeatmapDTO> heatmap() {
    List<Object[]> rows = movieRepository.findCountryGenreRating();
    return rows.stream()
        .filter(r -> r[0] != null && r[1] != null)
        .map(r -> {
            HeatmapDTO dto = new HeatmapDTO();
            dto.setCountry((String) r[0]);
            dto.setGenre((String) r[1]);
            dto.setAvgRating(((Number) r[2]).doubleValue());
            dto.setCount(((Number) r[3]).intValue());
            return dto;
        })
        .collect(Collectors.toList());
}
```

这个改造就是我们平衡 AI 和自主学习的缩影——**AI 给我骨架和语法提示，但业务过滤、类型安全、空值处理、DTO 组装这些真正体现工程能力的环节，必须自己来**。

---

## 🔹 收尾交付阶段的 AI 使用（补录）

本阶段（代码整理 / 脱敏 / 文档 / 推送）同样由 AI 辅助，清单如下：

| 文件 / 动作                        | AI 辅助做了什么                              | AI 生成占比 | 自己做的修改和理解                                       |
|---------------------------------|---------------------------------------------|------------|---------------------------------------------------------|
| `.gitignore`                     | 生成忽略规则初稿                             | 70%        | 自己补充了 `application-local.yml` / `.env` 等凭据文件的排除规则，确保真实凭据永不入库 |
| `.env.example`                   | 生成环境变量清单                             | 80%        | 自己核对每个变量与 `application.yml` 的占位符一一对应 |
| `application.yml`（改造版）        | 占位符写法建议                               | 60%        | 自己决定把账号密码抽成环境变量 + 本地 override 文件（`application-local.yml`，不入库），兼顾隐私与本地一键运行 |
| `MovieDashboardApplication.java` | 改写启动日志为 logger 输出                    | 50%        | 自己删掉了失效的 Swagger/H2 提示行，改为从运行环境读取实际端口 |
| `GlobalExceptionHandler.java`    | 补充异常分支建议                             | 55%        | 自己加入类型不匹配/缺失参数处理，并把 500 响应改为通用文案以避免信息泄漏，详细堆栈写入日志 |
| `README.md`（重写）               | 结构模板与章节草稿                           | 65%        | 自己按项目实际架构逐项校对：目录结构、环境变量表、9 个接口参数、FAQ 均取自实际代码与实测结果 |
| `docs/代码说明.md`                 | 架构图与章节框架草稿                         | 60%        | 自己逐文件核对后再写入，模块职责、字段名、分页约定都对照源码校准 |
| 隐私脱敏                          | 全局扫描正则建议                             | 40%        | 自己确认脱敏清单：姓名改为「姓氏+星号」、配置项全部环境变量化并在推送前二次复核 |
| 旧文档修订（答辩预案等）           | 过时段落改写建议                             | 50%        | 自己逐条比对现状修正（Swagger→ApiFox、H2→MySQL、5500→Nginx 80） |

> 结论：AI 主要承担模板骨架、扫描脚本与文案润色；**环境配置策略、隐私边界判断、代码变更是否保功能的复核，均由我们自己拍板和验证**（每次改动后重新编译 + 全链路 curl 验证通过）。

---

## 🔹 2026-10-20 文档重构与团队协作阶段（补录）

版本一推送到 GitHub 后，为支持三人协作与后续开发，对文档体系做了"更新合并整理"，本阶段同样由 AI 辅助：

| 文件 / 动作                        | AI 辅助做了什么                              | AI 生成占比 | 自己做的修改和理解                                       |
|---------------------------------|---------------------------------------------|------------|---------------------------------------------------------|
| `docs/团队协作指南.md`（新增）      | 协作流程框架与章节草稿                        | 55%        | 自己按课程三人团队实际裁剪：分支模型从简、PR 审批 1 人、同步节奏与现有任务清单对齐 |
| `docs/快速上手.md`（新增）          | 环境清单/启动步骤合并建议                     | 60%        | 逐条对照本机实测：nginx 二进制不入库的坑、CSV 财务口径（850 行/418 条）均按代码事实写入 |
| `docs/README.md`（新增）           | 文档地图与阅读路线                            | 50%        | 自己确定"新组员/改代码/答辩"三条路线并逐篇核对链接 |
| 旧文档校准（6 份）                  | 全文比对代码找差异                            | 40%        | 自己逐项核对源码后修订：H2→MySQL、Swagger→ApiFox、500ms→300ms、10s→8s、`year`→`release_year`、雷达图描述删除等 |
| `CONTRIBUTING.md` + `.github/`    | GitHub 社区文件模板                           | 70%        | 自己补了 CODEOWNERS 的人员分派与 PR 检查单（含凭据不入库检查项） |
| 删除 `docs/UPGRADE.md`             | 合并方案建议                                  | 30%        | 自己判断其内容与 README/快速上手重复且为一次性迁移记录，保留"版本演进记录"一节后删除 |

> 本阶段结论同上：AI 承担比对、起草与格式化；**文档内容是否与代码一致、协作流程是否符合团队实际，均由组长逐项核实后定稿**。

---

## 🔹 提交承诺

> 我们确认以上记录完全属实。AI 辅助的部分我们都完整阅读和理解，并在必要处做了修改。核心业务逻辑（数据分布设计、Service 层 JPQL、前端图表二次加工）由我们自主完成。如果老师抽查任何一段代码，我们都能解释清楚它的作用和设计理由。
