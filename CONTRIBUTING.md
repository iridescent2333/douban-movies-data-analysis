# 贡献指南（Contribution Guide）

> 完整版协作规范见 [`docs/团队协作指南.md`](docs/团队协作指南.md)，本文件是速览版，GitHub 会在你新建 PR / Issue 时自动展示。

## 开始之前

1. 确认你已被添加为仓库 Collaborator（权限 Write）
2. 读一遍 [`docs/团队协作指南.md`](docs/团队协作指南.md) 和 [`docs/快速上手.md`](docs/快速上手.md)（把项目跑起来）
3. 每天开工先 `git checkout main && git pull origin main`

## 提交代码的唯一路径

```
认领 Issue → 从 main 切 feature/xxx 分支 → 开发 + 本地自测 → commit → push → 开 PR → review → 合并
```

- **不要直接 push 到 `main`**（分支保护会拒绝）
- 一个分支只做一件事；commit 信息遵守 Conventional Commits：`feat(backend): xxx` / `fix(frontend): xxx` / `docs: xxx`
- PR 至少需要 **1 位其他组员 Approve** 才能合并

## 合并前自测清单

- [ ] 后端 `mvnw.cmd spring-boot:run` 正常启动，控制台出现 `[DataInit] 加载完成！`
- [ ] 改到的接口用 ApiFox / curl 实际调过，返回 `code:0`
- [ ] 改到的页面浏览器无 Console 报错，明暗主题都看过
- [ ] **没有**提交 `application-local.yml` / `.env` / 任何真实密码
- [ ] 改了接口 / 数据库 / 配置 → 同 PR 内更新 `docs/数据库与API契约.md`（+ `docs/apifox-import.json`）

## 目录归属（默认 review 人，见 `.github/CODEOWNERS`）

| 目录 | 负责人 |
|------|--------|
| `backend/` | 张**（组长） |
| `frontend/` | 钟** |
| `scripts/` `docs/` `.github/` | 曹** |

## 遇到问题

- 卡住了 → 在对应 Issue 下评论，或群里 @ 相关同学
- 发现 bug → 直接建 Issue（缺陷报告模板），附复现步骤和截图
