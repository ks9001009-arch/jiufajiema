# API 设计规范

## 总体约定

- API 服务位于 `apps/api`，按 **模块** 拆分路由与业务，单文件、单函数遵守 [PROJECT_RULES.md](../PROJECT_RULES.md) 行数限制。
- 请求/响应类型与错误码枚举放在 `packages/shared`，前后端共用。

## REST 风格（建议）

| 约定 | 说明 |
|------|------|
| 路径 | 名词复数、层级表达资源关系，如 `/teams/{id}/orders` |
| 方法 | GET 查询、POST 创建、PATCH 部分更新、DELETE 删除（慎用） |
| 状态码 | 2xx 成功；4xx 客户端错误；5xx 服务端错误 |
| 分页 | 统一 `page` / `pageSize` 或 cursor 参数，响应含 `total` 或 `nextCursor` |

## 响应结构（建议）

```json
{
  "data": {},
  "meta": {}
}
```

错误响应：

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "人类可读说明"
  }
}
```

- `code` 使用 **枚举常量**，禁止仅返回中文描述作为程序判断依据。

## 权限与安全

- 所有受保护路由经统一鉴权中间件处理。
- 敏感配置（供应商密钥等）不出现在响应中。
- 重要写操作记录 audit log。

## 供应商对接

- **禁止** 在业务模块内直接调用第三方 HTTP 客户端。
- 统一通过 **supplier adapter** 层封装：入参/出参标准化、错误映射、重试与超时策略集中管理。

## 异步与 Jobs

- 轮询供应商、批量对账、报表生成等 **不得** 在请求线程长时间阻塞。
- 接口仅触发任务或查询任务状态；实际执行在 `jobs` 中完成。

## 模块边界

- 单个页面不应驱动对多个无关模块 API 的随意组合；由后端提供聚合接口或明确的前端编排边界（仍以后端校验为准）。

## 参考

- [architecture.md](./architecture.md)
- [permission.md](./permission.md)
- [development-rules.md](./development-rules.md)
