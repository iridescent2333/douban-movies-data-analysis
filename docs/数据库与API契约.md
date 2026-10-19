# 数据库与 API 契约

> 给谁看的：前后端开发联调参考 + 老师验收看接口设计  
> 阅读指引：**先看 ER 图理解数据模型，再查表字段，最后看 API 示例 JSON**。

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
                    └───────────────────────────┘    │ country           │
                                                     │ year              │
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
  movies ──1:0..1── movie_financials   （约 50% 的 movie 有财务记录）
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
| year        | INT            | ——         | 上映年份                          |
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

## 四、API 契约（9 个接口 + 请求/响应 JSON 示例）

### 4.1 电影列表（分页 + 多条件筛选）

```
GET /api/movies?yearStart=2010&yearEnd=2020&country=美国&ratingMin=8.0&ratingMax=9.0&genres=科幻&genres=动作&title=星际&page=0&size=5
```

**Query 参数**

| 参数       | 类型      | 必填 | 说明                              |
|------------|-----------|------|-----------------------------------|
| yearStart  | Integer   | ❌   | 起始年份（含）                    |
| yearEnd    | Integer   | ❌   | 结束年份（含）                    |
| genres     | List<String> (重复) | ❌ | 类型名，`?genres=科幻&genres=动作` 表示同时包含 |
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

### 4.2 电影详情

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

### 4.3 筛选器下拉可选项

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

### 4.4 年份趋势

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

### 4.5 类型对比

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

### 4.6 成本 vs 票房散点

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

> 只有约 50% 有财务数据的电影会返回在这里。

---

### 4.7 国家 × 类型 热力图

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

### 4.8 档期 × 类型 分析

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

### 4.9 导演 TOP N

```
GET /api/stats/top-directors?n=10
```

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

---

## 五、分页参数约定

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

## 六、设计决策记录

| 问题                                  | 决策                                                  | 理由                                         |
|---------------------------------------|-------------------------------------------------------|----------------------------------------------|
| 为什么 movies 和 movie_financials 分开？ | 财务数据只存在于 50% 的电影上，拆表比在 movies 里放大量 null 更好 | 数据库范式 + 查询效率（统计票房时只查 418 条） |
| 为什么 genres 独立成表？                | 多对多关系需要中间表 + 类型是字典数据                    | 统计时 GROUP BY genre 很方便                |
| 为什么不用 `@OneToMany` 而是 `@ManyToMany`？ | 类型是真正的多对多（一部电影多个类型，一个类型多部电影） | JPA 的 `@JoinTable` 自动生成中间表           |
| 为什么 budget 单位是"万"而不是"原始美元"？  | 统一成人民币万元，前后端一致显示，不做货币换算           | 课程作业不需要精确汇率，单位统一即可         |
