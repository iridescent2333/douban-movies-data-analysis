# PR 检查单

> 提交前逐项自检；review 人按此清单核对。规则详见 [`docs/团队协作指南.md`](../docs/团队协作指南.md)。

## 这个 PR 做了什么

<!-- 一句话说明，例如：新增导演 TOP N 筛选联动 -->

-

## 关联 Issue

Closes #

## 变更类型

- [ ] feat 新功能
- [ ] fix 缺陷修复
- [ ] docs 文档
- [ ] refactor 重构
- [ ] chore 工程/其他

## 自测清单（提交人填写）

- [ ] 后端能正常启动（涉及后端时），控制台有 `[DataInit] 加载完成！`
- [ ] 涉及接口：ApiFox / curl 实际调过，返回 `code:0`
- [ ] 涉及页面：浏览器无 Console 报错，明暗主题均验证
- [ ] 涉及数据：`scripts/generate_data.py` 重跑结果一致（种子 42）
- [ ] **未提交** `application-local.yml` / `.env` / 任何真实密码
- [ ] 改了接口 / 数据库 / 配置：已同步 `docs/数据库与API契约.md`（+ `docs/apifox-import.json`）
- [ ] commit 信息符合 Conventional Commits

## 给 review 人的提示（可选）

<!-- 哪里需要重点看、哪里是权衡后的妥协 -->
