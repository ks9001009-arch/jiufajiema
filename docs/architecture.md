# 系统架构

## 概述

接码团队管理平台采用 **Monorepo** 布局，前后端分离，共享类型与数据库层独立为 package，便于模块化演进与统一约束。

## 目录职责

| 路径 | 职责 |
|------|------|
| `apps/web` | 用户界面：展示、表单、交互；不包含核心业务规则 |
| `apps/api` | HTTP API、权限校验、业务编排、任务投递 |
| `packages/database` | Schema、Migration、数据访问抽象 |
| `packages/shared` | 枚举、DTO、常量定义（前后端共用） |
| `docker` | 本地与部署用容器配置 |

## 分层原则

```
┌─────────────────────────────────────┐
│           apps/web                  │  展示层
├─────────────────────────────────────┤
│           apps/api                  │  应用层（接口、权限、编排）
│    ┌──────────┬──────────┐          │
│    │ modules  │   jobs   │          │
│    └──────────┴──────────┘          │
├─────────────────────────────────────┤
│    packages/database                │  数据层
├─────────────────────────────────────┤
│    Provider Adapter (api 内)        │  外部供应商协议边界
└─────────────────────────────────────┘
```

- **前端**：调用 API，渲染状态；状态文案来自后端或 `shared` 枚举，禁止散落业务字符串。
- **后端**：按模块拆分；供应商调用统一经 **Provider Adapter**；长耗时逻辑进 **jobs**。详细设计见 [provider-adapter-design.md](./provider-adapter-design.md)。
- **数据库**：变更仅通过 **migration**；余额走 **钱包流水**；订单状态变更写 **操作日志**；重要操作写 **audit log**。

## 横切关注点

| 关注点 | 约定 |
|--------|------|
| 权限 | 后端为唯一可信源，见 [permission.md](./permission.md) |
| 配置 | 价格、密钥、钱包地址、权限规则不得硬编码 |
| 状态 | 使用枚举（`packages/shared`），禁止魔法字符串 |
| 审计 | 订单状态变化、重要操作均需可追溯日志 |

## 新功能开发顺序

1. 数据库模型与 migration（`packages/database`）
2. 后端接口与模块（`apps/api`）
3. 前端页面（`apps/web`）

详见 [development-rules.md](./development-rules.md) 与根目录 [PROJECT_RULES.md](../PROJECT_RULES.md)。
