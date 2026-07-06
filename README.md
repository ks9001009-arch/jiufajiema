# 玖发接码平台

从零构建的接码团队管理平台，面向团队运营、订单管理、供应商对接与权限控制等场景。

## 项目状态

当前处于 **地基阶段**：已配置 Monorepo 基础结构，各子包尚未初始化，未安装业务依赖。

## 目录结构

```
apps/
  web/          # 前端应用（展示与交互）
  api/          # 后端 API 服务

packages/
  database/     # 数据库模型与 migration
  shared/       # 跨端共享类型与工具

docs/           # 架构与设计文档
docker/         # 容器化配置
```

## 开发规则

所有开发必须遵守 [PROJECT_RULES.md](./PROJECT_RULES.md) 中的强制性约束。

详细设计见 `docs/` 目录：

| 文档 | 说明 |
|------|------|
| [architecture.md](./docs/architecture.md) | 系统架构 |
| [database.md](./docs/database.md) | 数据库设计原则 |
| [permission.md](./docs/permission.md) | 权限模型 |
| [api.md](./docs/api.md) | API 设计规范 |
| [development-rules.md](./docs/development-rules.md) | 开发流程与约定 |

## 下一步

1. 选定技术栈并初始化各子包
2. 配置开发环境与 Docker
3. 按「数据库模型 → 后端接口 → 前端页面」顺序实现首个业务模块
