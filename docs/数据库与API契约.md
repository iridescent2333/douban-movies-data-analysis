# 数据库与 API 契约

> 给谁看的：前后端开发联调参考 + 老师验收看接口设计  
> 阅读指引：**先看 ER 图理解数据模型 → 查表字段 → 第四节看课程要求接口 A1-A5（前端主用）→ 第五节看拓展接口**。
> 在线文档：启动后端后访问 Swagger UI <http://localhost:8081/swagger-ui.html>（本文件是其静态快照，改接口后两边同步更新）。

---

## 一、ER 图（文字版）

```
┌───────────────┐       ┌──────────────────┐       ┌───────────────────┐
│    genres     │       │   movie_genres   │       │      movies       │
├───────────────┤       ├──────────────────┤       ├───────────────────┤
│ id      (PK)  │◄──┐   │ movie_id  (PK,FK)├──►──►│ id        (PK)     │
│ name    (UK)  │   │   │ genre_id  (PK,FK)│──┐    │ title              │
└───────────────┘   │   └──────────────────┘  │    │ director          │
                    │                           │    │ lead_actor        │
                    └───────────────────────────┘                                                         │ country           │
                                                     │ release_year      │ ← 库表列名；JSON 字段名为 year
                                                     │ duration          │
                                                     │ rating            │
                                                     │ vote_count        │
                                                     │ intro             │
                                                     │ poster_url        │
                                                     └────────┬──────────┘
                                                              │ 1
                                                              │
                                                              │ 1 (optional)
                                                     ┌────────▼──────────┐
                                                     │ movie_financials  │
                                                     ├───────────────────┤
                                                     │ movie_id (PK,FK)  │
                                                     │ budget_wan        │
                                                     │ box_office_wan    │
                                                     │ release_date      │
                                                     │ season_tag        │
                                                     └───────────────────┘

关系：
  movies ──M:N── genres     （通过 movie_genres 中间表）
  movies ──1:1── movie_financials   （当前 850 部电影全部有财务行，其中 418 条含预算+票房数值）
```

---

## 二、四张表字段说明

### 2.1 `genres` — 类型字典表

| 字段   | 类型          | 约束     | 说明       |
|--------|---------------|----------|------------|
| id     | INT           | PK, AUTO | 自增主键   |
| name   | VARCHAR(50)   | NOT NULL, UNIQUE | 类型中文名（如 "科幻"） |

预置 14 条：剧情 / 喜剧 / 爱情 / 动画 / 科幻 / 悬疑 / 恐怖 / 动作 / 战争 / 文艺 / 主旋律 / 纪录片 / 短片 / Cult

### 2.2 `movies` — 电影主表

| 字段        | 类型           | 约束       | 说明                              |
|-------------|----------------|------------|-----------------------------------|
| id          | BIGINT         | PK, AUTO   | 自增主键                          |
| title       | VARCHAR(200)   | NOT NULL   | 电影标题                          |
| director    | VARCHAR(100)   | ——         | 导演（多导演用 `; ` 分隔）        |
| lead_actor  | VARCHAR(300)   | ——         | 主演（多个用 `; ` 分隔）          |
| country     | VARCHAR(50)    | ——         | 制片国家/地区（如 "美国"）        |
| release_year | INT           | ——         | 上映年份（数据库列名；JSON 字段名为 `year`） |
| duration    | INT            | ——         | 片长（分钟）                      |
| rating      | DECIMAL(3,1)  | ——         | 豆瓣评分（2.0 – 9.8，一位小数）   |
| vote_count  | INT            | ——         | 评价人数                          |
| intro       | TEXT           | ——         | 简介                              |
| poster_url  | VARCHAR(500)   | ——         | 海报 URL（本项目用占位图）        |

**索引**：`idx_year` / `idx_rating` / `idx_country`

### 2.3 `movie_genres` — 多对多关联表

| 字段       | 类型   | 约束          | 说明        |
|------------|--------|---------------|-------------|
| movie_id   | BIGINT | PK, FK→movies.id  | 电影主键 |
| genre_id   | INT    | PK, FK→genres.id  | 类型主键 |

### 2.4 `movie_financials` — 财务数据表

| 字段           | 类型          | 约束         | 说明                              |
|----------------|---------------|--------------|-----------------------------------|
| movie_id       | BIGINT        | PK, FK→movies.id | 关联电影主键（一对一）        |
| budget_wan     | DECIMAL(12,2)| ——           | 制作预算（万元，原始数据是美元×汇率） |
| box_office_wan | DECIMAL(12,2)| ——           | 票房（万元）                      |
| release_date   | DATE          | ——           | 上映日期（yyyy-MM-dd）            |
| season_tag     | VARCHAR(30)   | ——           | 档期标签（如 "暑期档"）           |

> **行数口径（2026-10 数据）**：本表共 **850 行**——每部电影一条，只要 `budget_wan` / `box_office_wan` / `release_date` 任一非空即由 `DataInitializer` 建行；
> 其中 **418 条**同时含预算+票房数值，散点图 / 档期图 / 成本效益图实际使用的是这 418 条。

---

## 三、统一返回格式 `Result<T>`

所有接口 **都** 返回这个格式，不会变。

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

| code  | 含义         | message          | data             |
|-------|--------------|------------------|------------------|
| 0     | 成功         | "ok"             | 业务数据（任意类型 T） |
| -1    | 业务失败     | 具体错误信息      | null             |
| 404   | 未找到资源   | "电影不存在"     | null             |
| 400   | 参数校验失败 | "yearStart 必须 ≤ yearEnd" | null     |
| 500   | 服务器错误   | 异常简要描述      | null             |

---

## 四、课程要求接口契约（A1-A5）★ 前端主用

> 对应课程《项目需求文档三：电影数据分析看板》的接口清单，路径与要求逐一一致。

### 4.1 A1 类型列表

```
GET /api/types
```

**响应**

```json
{ "code": 0, "message": "ok", "data": ["Cult", "主旋律", "剧情", "动作", "动画", "喜剧", "恐怖", "悬疑", "战争", "文艺", "爱情", "短片", "科幻", "纪录片"] }
```

### 4.2 A2 作品分页列表（F9 数据源）

```
GET /api/works?type=科幻&yearStart=2015&yearEnd=2025&ratingMin=8&title=星际&page=0&size=10
```

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | Integer | ❌ | 页码，从 0 开始，默认 0 |
| size | Integer | ❌ | 每页条数，默认 20（前端 F9 表格固定 10） |
| type | String | ❌ | 类型（精确匹配，来自 A1） |
| yearStart | Integer | ❌ | 起始年份（含） |
| yearEnd | Integer | ❌ | 结束年份（含） |
| ratingMin | BigDecimal | ❌ | 最低评分（含） |
| ratingMax | BigDecimal | ❌ | 最高评分（含） |
| title | String | ❌ | 标题模糊匹配 |

**响应**（Spring Data Page）

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "content": [
      {
        "id": 3080, "title": "冷酷的谎言往事", "director": "Satyajit Ray",
        "leadActor": "Hrithik Roshan; Scarlett Johansson", "country": "德国",
        "year": 2016, "duration": 123, "rating": 9.8, "voteCount": 38616,
        "posterUrl": "", "intro": "当和平时期来临，一位退休的老兵必须面对人性深处的挣扎……",
        "genres": ["动画", "Cult", "文艺"]
      }
    ],
    "totalElements": 850, "totalPages": 85, "number": 0, "size": 10,
    "first": true, "last": false, "empty": false
  }
}
```

### 4.3 A3 作品详情

```
GET /api/works/3080
```

**响应**：字段同 4.2 的列表项，另加 `intro`（简介）与 `financial`（财务对象，无数据时为 `null`）：

```json
{
  "code": 0, "message": "ok",
  "data": {
    "id": 3080, "title": "冷酷的谎言往事", "genres": ["动画", "Cult", "文艺"],
    "rating": 9.8, "voteCount": 38616, "year": 2016, "country": "德国",
    "intro": "当和平时期来临……",
    "financial": { "budgetWan": null, "boxOfficeWan": null, "releaseDate": "2016-08-28", "seasonTag": "暑期档" }
  }
}
```

> 不存在的 id 返回 `{"code":404,...}`（HTTP 404）。

### 4.4 A4 统计数据（评分分布 + 年度趋势 + 类型对比）

```
GET /api/works/stats?type=科幻&yearStart=2015
```

**响应**

```json
{
  "code": 0, "message": "ok",
  "data": {
    "ratingDistribution": [
      { "range": "2.0-2.5", "count": 1, "avgRating": 2.4 },
      { "range": "6.0-6.5", "count": 4, "avgRating": 6.2 }
    ],
    "yearTrend":  [ { "year": 1995, "count": 34, "avgRating": 6.94, "avgBoxOffice": 129978056.79 } ],
    "genreCompare": [ { "genre": "剧情", "avgRating": 7.31, "avgBoxOffice": 5100.00, "count": 135 } ]
  }
}
```

> `ratingDistribution` 固定返回 16 个评分段（2.0-10.0，0.5 分粒度），无数据的段 `count=0`，保证直方图 x 轴连续。
> `yearTrend` / `genreCompare` 的字段与下面的拓展接口完全一致，前端转换层可直接复用。

### 4.5 A5 热门作品 TOP N

```
GET /api/works/top?n=20&by=rating&country=美国&yearStart=2010&yearEnd=2014&type=科幻
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| n | Integer | ❌ | 返回条数，默认 10（前端榜单传 20） |
| by | String | ❌ | `rating` 按评分降序（默认）/ `votes` 按评价人数降序 |
| type | String | ❌ | 类型（分类型榜单用） |
| country | String | ❌ | 国家/地区（分地区榜单用） |
| yearStart / yearEnd | Integer | ❌ | 年份区间（分年代榜单用） |
| ratingMin / ratingMax / title | — | ❌ | 同 A2 的筛选参数 |

**响应**：`MovieDTO` 数组（字段同 A2 列表项，**含 `intro` 故事梗概**，供排行榜卡片展示）。

> 前端四个榜单页面对应该接口的不同参数组合：
> 综合热榜（无筛选）、分地区（`country`）、分年代（`yearStart/yearEnd`）、分类型（`type`）。

---

## 五、拓展接口契约（深度分析 + 聚合）

### 5.1 电影列表（分页 + 多条件筛选）

```
GET /api/movies?yearStart=2010&yearEnd=2020&country=美国&ratingMin=8.0&ratingMax=9.0&genres=科幻&genres=动作&title=星际&page=0&size=5
```

**Query 参数**

| 参数       | 类型      | 必填 | 说明                              |
|------------|-----------|------|-----------------------------------|
| yearStart  | Integer   | ❌   | 起始年份（含）                    |
| yearEnd    | Integer   | ❌   | 结束年份（含）                    |
| genres     | List<String> | ❌   | 类型名，多个表示**同时包含（AND）**。前端传**逗号分隔**：`genres=科幻,动作`；重复参数 `?genres=科幻&genres=动作` 亦可 |
| country    | String    | ❌   | 精确匹配国家/地区                 |
| ratingMin  | BigDecimal| ❌   | 最低评分（含）                    |
| ratingMax  | BigDecimal| ❌   | 最高评分（含）                    |
| title      | String    | ❌   | 模糊匹配（LIKE '%xxx%'）          |
| page       | Integer   | ❌   | 页码，从 0 开始，默认 0           |
| size       | Integer   | ❌   | 每页条数，默认 20                 |

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "content": [
      {
        "id": 123,
        "title": "盗梦空间",
        "director": "Christopher Nolan",
        "country": "美国",
        "year": 2010,
        "duration": 148,
        "rating": 9.4,
        "voteCount": 86213,
        "posterUrl": ""
      }
    ],
    "totalElements": 42,
    "totalPages": 9,
    "number": 0,
    "size": 5,
    "first": true,
    "last": false,
    "empty": false
  }
}
```

---

### 5.2 电影详情

```
GET /api/movies/123
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 123,
    "title": "盗梦空间",
    "director": "Christopher Nolan",
    "leadActor": "Leonardo DiCaprio; Joseph Gordon-Levitt",
    "country": "美国",
    "year": 2010,
    "duration": 148,
    "rating": 9.4,
    "voteCount": 86213,
    "intro": "一个关于梦境与现实的故事...",
    "posterUrl": "",
    "genres": ["科幻", "动作", "悬疑"],
    "financial": {
      "budgetWan": 16500.00,
      "boxOfficeWan": 83500.00,
      "releaseDate": "2010-07-16",
      "seasonTag": "暑期档"
    }
  }
}
```

> 如果该电影**没有财务数据**，`financial` 字段为 `null`。

---

### 5.3 筛选器下拉可选项

```
GET /api/movies/filters
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "years": [1995, 1996, 1997, "...", 2025],
    "countries": ["中国大陆", "中国香港", "中国台湾", "美国", "日本", "..."],
    "genres": ["剧情", "喜剧", "爱情", "动画", "科幻", "悬疑", "..."]
  }
}
```

---

### 5.4 年份趋势

```
GET /api/stats/year-trend
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "year": 1995, "totalCount": 28, "avgRating": 6.82, "avgBoxOfficeWan": 3200.00 },
    { "year": 1996, "totalCount": 31, "avgRating": 7.01, "avgBoxOfficeWan": 3850.00 },
    { "year": 1997, "totalCount": 35, "avgRating": 7.15, "avgBoxOfficeWan": 4100.00 },
    "...",
    { "year": 2025, "totalCount": 14, "avgRating": 7.33, "avgBoxOfficeWan": 5600.00 }
  ]
}
```

---

### 5.5 类型对比

```
GET /api/stats/genre-compare
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "name": "动画", "count": 185, "avgRating": 7.56, "avgBoxOfficeWan": 8200.00 },
    { "name": "剧情", "count": 432, "avgRating": 7.31, "avgBoxOfficeWan": 5100.00 },
    { "name": "恐怖", "count": 148, "avgRating": 6.52, "avgBoxOfficeWan": 2300.00 },
    "..."
  ]
}
```

---

### 5.6 成本 vs 票房散点

```
GET /api/stats/scatter-cost-box
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "title": "盗梦空间", "budgetWan": 16500.00, "boxOfficeWan": 83500.00, "rating": 9.4 },
    { "title": "流浪地球", "budgetWan": 30000.00, "boxOfficeWan": 46800.00, "rating": 7.9 },
    "..."
  ]
}
```

> 仅返回含预算+票房数值的电影（当前 418 条）；只有上映日期、无数值的电影不出现在散点中。

---

### 5.7 国家 × 类型 热力图

```
GET /api/stats/heatmap
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "country": "美国", "genre": "科幻", "avgRating": 7.55, "count": 45 },
    { "country": "美国", "genre": "动作", "avgRating": 6.82, "count": 52 },
    { "country": "中国大陆", "genre": "主旋律", "avgRating": 7.41, "count": 38 },
    "..."
  ]
}
```

> 前端需要把它转成 ECharts 热力图需要的 `[[xIndex, yIndex, value], ...]` 格式，x 轴是国家，y 轴是类型。

---

### 5.8 档期 × 类型 分析

```
GET /api/stats/season-analysis
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "seasonTag": "暑期档", "genre": "动画", "avgBoxOfficeWan": 12500.00, "avgRating": 7.82, "count": 28 },
    { "seasonTag": "国庆档", "genre": "主旋律", "avgBoxOfficeWan": 18300.00, "avgRating": 7.55, "count": 22 },
    "..."
  ]
}
```

---

### 5.9 导演 TOP N

```
GET /api/stats/top-directors?n=10
```

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| n | Integer | ❌ | 返回前 N 位导演，**默认 10**；前端看板实际传 `n=20` |

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "director": "Christopher Nolan", "movieCount": 12, "avgRating": 8.45 },
    { "director": "张艺谋", "movieCount": 11, "avgRating": 7.62 },
    { "director": "Steven Spielberg", "movieCount": 10, "avgRating": 7.93 },
    "..."
  ]
}
```

### 5.10 看板聚合（一次请求返回整屏数据）★ 前端首屏与筛选都走这个

```
GET /api/stats/overview?n=20&yearStart=2015&yearEnd=2025&country=美国
```

**Query 参数**：与其它 stats 接口相同的筛选参数（`yearStart` / `yearEnd` / `genres` / `country` / `ratingMin` / `ratingMax`），外加 `n`（导演榜条数，默认 10）。

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "kpi": {
      "movieCount": 850,
      "avgRating": 7.18,
      "yearMin": 1995,
      "yearMax": 2025,
      "countryCount": 10
    },
    "yearTrend":     [ { "year": 1995, "count": 34, "avgRating": 6.94, "avgBoxOffice": 129978056.79 } ],
    "genreCompare":  [ { "genre": "剧情", "avgRating": 7.31, "avgBoxOffice": 5100.00, "count": 135 } ],
    "scatterCostBox":[ { "budgetWan": 16500.00, "boxOfficeWan": 83500.00, "rating": 9.4, "title": "盗梦空间", "country": "美国" } ],
    "heatmap":       [ { "country": "美国", "genre": "科幻", "avgRating": 7.55, "count": 45 } ],
    "seasonAnalysis":[ { "seasonTag": "暑期档", "genre": "动画", "avgBoxOffice": 12500.00, "avgRating": 7.82, "count": 28 } ],
    "topDirectors":  [ { "director": "Christopher Nolan", "count": 12, "avgRating": 8.45 } ]
  }
}
```

> 六个数组的字段与各自的独立接口 **完全一致**，前端的数据转换层可直接复用。
> 设计意图：后端只查一次 `movies` + 一次 `movie_financials`，6 类图表基于同一份数据在内存里算出，
> 把"6 次全表查询 + 6 次网络往返"压缩成"1 次查询 + 1 次往返"（实测 2725ms → 600ms）。

---

## 六、分页参数约定

| 方向       | 参数 | 说明                                                    |
|------------|------|---------------------------------------------------------|
| 后端 → 前端 | `number`  | 0-based 页码，前端显示时 +1                              |
|            | `size`    | 每页条数                                                |
|            | `totalPages` | 总页数                                               |
|            | `totalElements` | 总条数                                            |
|            | `first` / `last` | 是否首页/末页（前端用来控制按钮 disabled）            |
| 前端 → 后端 | `page`    | 0-based，传后端时 **不要 +1**，直接显示页码 - 1         |
|            | `size`    | 同后端                                                  |

**典型前端分页逻辑**：

```js
// 用户看到的页码（1-based）
let currentPage = 1;
// 传给后端时 -1
const res = await api.getMovies({ page: currentPage - 1, size: 20, ...filters });
// 渲染上一页/下一页按钮
const totalPages = res.data.totalPages;
document.getElementById('prevPage').disabled = (currentPage <= 1);
document.getElementById('nextPage').disabled = (currentPage >= totalPages);
```

---

## 七、设计决策记录

| 问题                                  | 决策                                                  | 理由                                         |
|---------------------------------------|-------------------------------------------------------|----------------------------------------------|
| 为什么 movies 和 movie_financials 分开？ | 财务字段稀疏（仅约半数电影有预算+票房数值），拆表比在 movies 里放大量 null 更好 | 数据库范式 + 查询效率（统计票房时只查有数值的 418 条） |
| 为什么 genres 独立成表？                | 多对多关系需要中间表 + 类型是字典数据                    | 统计时 GROUP BY genre 很方便                |
| 为什么不用 `@OneToMany` 而是 `@ManyToMany`？ | 类型是真正的多对多（一部电影多个类型，一个类型多部电影） | JPA 的 `@JoinTable` 自动生成中间表           |
| 为什么 budget 单位是"万"而不是"原始美元"？  | 统一成人民币万元，前后端一致显示，不做货币换算           | 课程作业不需要精确汇率，单位统一即可         |
