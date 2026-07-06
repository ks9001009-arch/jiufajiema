# 开发流程与约定

本文档补充日常开发流程；强制性条款以 [PROJECT_RULES.md](../PROJECT_RULES.md) 为准。

## 新功能开发顺序

1. **数据库模型** — 在 `packages/database` 设计表结构并编写 migration
2. **后端接口** — 在 `apps/api` 按模块实现 API、权限、日志与 adapter 调用
3. **前端页面** — 在 `apps/web` 实现展示与交互，消费已有 API

不允许跳过步骤或在前端先行固化业务规则。

## 代码组织

| 规则 | 说明 |
|------|------|
| 文件 ≤ 300 行 | 超出则按职责拆文件 |
| 函数 ≤ 60 行 | 超出则提取子函数或下沉到 service |
| 一文件一模块 | 禁止多模块逻辑混写 |
| 后端模块化 | 按 domain 分目录：routes / service / repository 等 |

## 禁止事项

- 临时代码、硬编码价格/密钥/钱包地址/权限规则
- 生产库手工改表或改数据
- 接口内长时间阻塞（应使用 jobs）
- 状态中文字符串散落各处（使用 `packages/shared` 枚举）
- 页面跨多个无关模块随意拼装 API

## 日志与审计

| 场景 | 要求 |
|------|------|
| 余额变动 | 钱包流水表 |
| 订单状态变化 | 操作日志 |
| 重要管理操作 | audit log |

## 测试与发布（后续阶段）

- Migration 在 CI 中可重复执行
- 供应商 adapter 可 mock，便于单测
- 发布前检查：无硬编码秘密、权限在后端全覆盖

## 文档维护

- 架构或约定变更时，同步更新 `docs/` 与 `PROJECT_RULES.md`
- API 破坏性变更需在 `docs/api.md` 或独立 changelog 中记录

## 参考

- [architecture.md](./architecture.md)
- [database.md](./database.md)
- [permission.md](./permission.md)
- [api.md](./api.md)
