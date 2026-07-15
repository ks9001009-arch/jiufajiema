# Provider Adapter 技术设计文档

> 状态：设计稿，待人工审核  
> 依据：现有代码 + 架构只读审计  
> 约束：V1 DATA MODEL FROZEN / additive-only / Adapter 不碰核心状态 / 未知 Adapter fail closed / 本阶段不建 Provider 专属表

**实施门禁**：第十二节待决策项未人工确认前，不得进入 Phase 0/1 编码；不得修改业务代码、不得执行 migration、不得调用真实 Provider API。

---

## 一、设计目标与非目标

### 目标（本阶段设计解决什么）

1. 定义统一 `ProviderAdapter` 抽象，使未来真实上游只通过 Adapter 出入，核心服务不解析供应商原始协议。
2. 明确 Registry / Factory / ManualAdapter / 错误模型，保证未知 adapter **fail closed**。
3. 设计 Webhook 与 Polling **共用**的短信归一化入口，复用现有短信成功资金/状态闭环。
4. 划清「网络调用在事务外」「Order/Wallet/PhoneResource/Sms 状态变更在单事务内」的边界。
5. 给出与现有代码的集成点与分阶段路径，保证可渐进落地且可回滚。

### 非目标（本阶段明确不解决）

1. 不修改任何业务实现代码、不执行 migration、不提交以 Adapter 为名的仓促进度（本文件仅为设计落盘）。
2. 不改变现有订单创建语义（仍为本地选择号码 → `WAIT_SMS` → freeze；见 `OrdersService.create`，`apps/api/src/orders/orders.service.ts`）。
3. 不新增 `ProviderOrderBinding`、`ProviderInboundEvent`、`providerResourceId` 等表/字段。
4. 不设计真实 Provider 专属字段或具体协议字段映射。
5. 不实现真实 HTTP 客户端、不调用真实 Provider API。
6. 不推倒 `OrdersService` / `SmsService` / `WalletLedgerService`。
7. 不把 `TIMEOUT` 升格为独立 `OrderStatus`（继续复用 `CANCELLED` + `cancelReason='TIMEOUT'`，见 `OrdersService.timeoutOrder`）。

---

## 二、模块目录设计（建议树，待确认后创建）

```text
apps/api/src/providers/
  adapters/
    provider-adapter.interface.ts      # ProviderAdapter 接口
    provider-capabilities.ts           # ProviderCapabilities 类型与常量
    provider-types.ts                  # 标准化 DTO / 归一化结果
    provider-errors.ts                 # ProviderOperation / Category / AdapterError
    provider-adapter.registry.ts       # Registry：注册与按 code 查找
    provider-adapter.factory.ts        # Factory：读 Provider + 校验 + 返回上下文
    manual/
      manual.adapter.ts                # ManualAdapter 实现
      manual.adapter.constants.ts      # code = 'manual'
    ingress/
      provider-sms-ingress.service.ts  # Webhook/Polling 共用短信入口
      provider-sms-ingress.types.ts    # accept() 输入输出
    adapters.module.ts                 # Nest 装配：注册 ManualAdapter 等

  providers.module.ts                  # 现有 CRUD；未来 import AdaptersModule
  providers.service.ts                 # 现有 CRUD（保持不变语义）
  ...
```

| 文件 | 职责 |
|------|------|
| `provider-adapter.interface.ts` | Adapter 方法契约；禁止 `any` |
| `provider-types.ts` | 标准化 Request/Result；金额用 Decimal String |
| `provider-capabilities.ts` | 能力开关；调用方先查能力再调方法 |
| `provider-errors.ts` | 统一错误与 HTTP/日志映射原则 |
| `provider-adapter.registry.ts` | 进程内 map；重复 code 启动失败；未知 fail closed |
| `provider-adapter.factory.ts` | 按 `providerId` 解析适配器与 config |
| `manual.adapter.ts` | 无网络；支撑现状手工流；不支持能力明确报错 |
| `provider-sms-ingress.service.ts` | 归一化事件 → 统一完成短信成功闭环 |
| `adapters.module.ts` | `onModuleInit` 注册内置 adapter；导出 Factory/Ingress |

核心业务服务（Order/Sms/Wallet）**不**放入 `adapters/`；Adapter **永不**注入这些服务去直接写库。

---

## 三、ProviderAdapter Interface

### 方法形态选择（结论）

采用 **「capabilities + optional 方法」**：

- `getCapabilities()` / `readonly code` / `validateConfig()` / `mapError()` **必选**。
- 上游能力方法（`allocateNumber`、`pollMessages`、`verifyWebhook`、`parseWebhook`、`cancelOrder`、`releaseNumber`、`queryBalance`）为 **optional**。
- 调用方规则：先读 capabilities；capabilities 声称支持但方法缺失 → `CONFIG` 类错误；capabilities 不支持却被调用 → `UNSUPPORTED`（不可重试）。
- **不**要求“所有方法都存在并返回 unsupported”，避免伪实现膨胀；**不**用默认 Manual 回填未知 adapter。

说明：optional 与 fail closed 不冲突——fail closed 作用在 **Registry 解析 adapter code**，不是作用在「某方法是否支持」。

### 接口草案

```typescript
/** Decimal String，禁止 JS Number。对齐 DECIMAL_AMOUNT_PATTERN / wallet 金额字符串约定。 */
export type DecimalString = string;

export type ProviderAdapterCode = string;

export interface ProviderAdapter {
  readonly code: ProviderAdapterCode;

  getCapabilities(): ProviderCapabilities;

  validateConfig(config: unknown): ProviderConfigValidationResult;

  /**
   * 将任意上游异常/非 2xx/协议错误归一化为 ProviderAdapterError。
   * 禁止把原始 response body 放进返回给核心层的字段。
   */
  mapError(error: unknown, operation: ProviderOperation): ProviderAdapterError;

  allocateNumber?(
    ctx: ProviderContext,
    request: AllocateNumberRequest,
  ): Promise<AllocateNumberResult>;

  pollMessages?(
    ctx: ProviderContext,
    request: PollMessagesRequest,
  ): Promise<NormalizedProviderSms[]>;

  verifyWebhook?(
    ctx: ProviderContext,
    request: ProviderWebhookRequest,
  ): Promise<void>;

  parseWebhook?(
    ctx: ProviderContext,
    request: ProviderWebhookRequest,
  ): Promise<NormalizedProviderEvent[]>;

  cancelOrder?(
    ctx: ProviderContext,
    request: CancelOrderRequest,
  ): Promise<void>;

  releaseNumber?(
    ctx: ProviderContext,
    request: ReleaseNumberRequest,
  ): Promise<void>;

  queryBalance?(
    ctx: ProviderContext,
  ): Promise<ProviderBalanceResult>;
}
```

### 逐方法说明

| 方法 | 作用 | Manual | 备注 |
|------|------|--------|------|
| `code` | 与 `Provider.adapter`（`packages/database/prisma/schema.prisma`）字符串精确匹配 | `'manual'` | 大小写敏感；创建时存什么用什么 |
| `getCapabilities()` | 声明支持的能力集合 | 全 `false` | 调用前门禁 |
| `validateConfig` | 校验 `Provider.config` Json | 仅接受 `null/undefined/{}` | 真实 provider 私有 schema |
| `allocateNumber` | 向上游占号/取号 | **不实现** | 本阶段不改变 `OrdersService.create` 语义，调用仅为预留 |
| `pollMessages` | 拉取短信 | **不实现** | 结果必须是 `NormalizedProviderSms[]` |
| `verifyWebhook` | 验签/鉴权 | **不实现** | 失败即丢弃，不得落核心状态 |
| `parseWebhook` | 原始 payload → 归一化事件 | **不实现** | 禁止泄露 raw body 给核心 |
| `cancelOrder` | 通知上游取消 | **不实现** | 本地取消仍走现有事务；是否先调上游见第十二节 |
| `releaseNumber` | 上游释放号码 | **不实现** | 与本地 `LOCKED→AVAILABLE` 分离 |
| `queryBalance` | 查询上游余额（运维） | **不实现** | 与公司钱包无关；金额 Decimal String |
| `mapError` | 统一错误出口 | 映射 unsupported/config | 核心层只吃 `ProviderAdapterError` |

关于 Manual 的「手工短信」：手工成功路径仍是 HTTP `POST /orders/:id/sms` → `SmsService.createForOrder`（`apps/api/src/sms/sms.service.ts`），**不**经过 Adapter 网络。ManualAdapter 用 capabilities 标明「无上游能力」，避免被误调。

---

## 四、标准化 DTO / Type

约定：金额字段均为 `DecimalString`；时间均为 `Date`（边界处再序列化 ISO）。

| 类型 | 必填 | 可选 | 未来可能持久化？ |
|------|------|------|------------------|
| **ProviderContext** | `companyId`, `providerId`, `adapterCode`, `config` | `actorUserId` | `config` 已在 Provider；不新增 |
| **AllocateNumberRequest** | `serviceCode`, `country` | `orderId`, `maxPrice` | `orderId`→Order 已有；外部单号待确认后再 additive |
| **AllocateNumberResult** | `phone`, `country` | `providerExternalId`, `providerResourceId`, `expiresAt`, `rawCost` | 外部 ID：触发条件见第八节 |
| **ProviderOrderReference** | `orderId` | `providerExternalId` | 外部 ID 同上 |
| **PollMessagesRequest** | — | `orderId`, `phone`, `since`, `limit` | 否（请求态） |
| **NormalizedProviderSms** | `orderId`, `receivedAt` | `code`, `content`, `providerMessageId`, `phone` | `providerMessageId` 幂等关键 |
| **ProviderWebhookRequest** | `headers`, `rawBody` | `query`, `providerId`（路由注入） | raw 仅 Adapter 内可见 |
| **NormalizedProviderEvent** | `type`, `occurredAt` | `orderId`, `sms`, `providerExternalId`, `providerMessageId` | 事件表触发条件见第八节 |
| **CancelOrderRequest** | `orderId` | `providerExternalId`, `reason` | 否 |
| **ReleaseNumberRequest** | `phone` 或 `providerResourceId` 二者至少一 | `orderId` | 否 |
| **ProviderBalanceResult** | `currency`, `available` | `frozen` | 否（查询结果） |
| **ProviderCapabilities** | 全部 boolean（见下） | — | 否 |
| **ProviderConfigValidationResult** | `ok: boolean` | `errors: string[]` | 否 |

```typescript
export interface ProviderContext {
  companyId: string;
  providerId: string;
  adapterCode: string;
  /** 来自 Provider.config；内容不向核心业务透传解析细节 */
  config: unknown;
  actorUserId?: string | null;
}

export interface AllocateNumberRequest {
  serviceCode: string;
  country: string;
  orderId?: string;
  /** Decimal String */
  maxPrice?: string;
}

export interface AllocateNumberResult {
  phone: string;
  country: string;
  providerExternalId?: string;
  providerResourceId?: string;
  expiresAt?: Date;
  /** Decimal String；上游报价，不自动等于 Order.amount */
  rawCost?: string;
}

export interface ProviderOrderReference {
  orderId: string;
  providerExternalId?: string;
}

export interface PollMessagesRequest {
  orderId?: string;
  phone?: string;
  since?: Date;
  limit?: number;
}

export interface NormalizedProviderSms {
  orderId: string;
  receivedAt: Date;
  code?: string;
  content?: string;
  providerMessageId?: string;
  phone?: string;
}

export interface ProviderWebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string | Buffer;
  query?: Record<string, string | string[] | undefined>;
  providerId?: string;
}

export type NormalizedProviderEventType =
  | 'sms'
  | 'order_status'
  | 'unknown';

export interface NormalizedProviderEvent {
  type: NormalizedProviderEventType;
  occurredAt: Date;
  orderId?: string;
  sms?: NormalizedProviderSms;
  providerExternalId?: string;
  providerMessageId?: string;
}

export interface CancelOrderRequest {
  orderId: string;
  providerExternalId?: string;
  reason?: string;
}

export interface ReleaseNumberRequest {
  phone?: string;
  providerResourceId?: string;
  orderId?: string;
}

export interface ProviderBalanceResult {
  currency: string;
  /** Decimal String */
  available: string;
  /** Decimal String */
  frozen?: string;
}

export interface ProviderCapabilities {
  allocateNumber: boolean;
  pollMessages: boolean;
  webhook: boolean;
  cancelOrder: boolean;
  releaseNumber: boolean;
  queryBalance: boolean;
}

export interface ProviderConfigValidationResult {
  ok: boolean;
  /** 可对运营展示的校验信息；不得含 secret */
  errors?: string[];
}
```

**禁止**：标准化类型含向核心层透传的原始上游响应字段；原始 payload 止于 Adapter 边界。

---

## 五、Registry 与 Factory

### ProviderAdapterRegistry

| 负责 | 不负责 |
|------|--------|
| 注册内置/模块内 Adapter 实例 | 读数据库、读 Provider.status |
| 按 `code` 精确查找 | 解析 config、做 HTTP |
| 启动期重复 code 检测 | 多租户；多租户在 Factory + companyId |

**注册流程**：`AdaptersModule.onModuleInit` → `registry.register(manualAdapter)` → 未来再 register 真实 adapter。

**重复 code**：启动失败（throw），禁止静默覆盖。

**未知 code**：`get(code)` 抛 `ProviderAdapterError`，`category=CONFIG`，`code=ADAPTER_NOT_FOUND`；**禁止**回退 `manual`。

### ProviderAdapterFactory

流程（与现有 `ProvidersService.findOne` 对齐，但需 **内部** 读取 schema 已有的 `config`；当前 CRUD API 未暴露 `config` —— 见第十节）：

1. `prisma.provider.findUnique({ where: { id: providerId } })`（需包含 `adapter`, `status`, `config`, `companyId`）。
2. 不存在 → `NOT_FOUND`。
3. `status !== ACTIVE` → `CONFIG` / `PROVIDER_DISABLED`（不可重试）。
4. `registry.get(provider.adapter)` —— 未知 fail closed。
5. `adapter.validateConfig(provider.config)` —— 失败不可重试。
6. 返回 `AdapterResolution { adapter, context: ProviderContext }`。

**缓存**：本阶段 **不缓存** 按 Provider 维度的解析结果（Registry 内 Adapter 实现为进程单例；`config` 变更应立即生效）。若未来缓存，必须以 `provider.updatedAt` 或版本作失效键。

**多租户**：`ProviderContext.companyId` 必须来自 DB 行，调用方传入的 `companyId` 必须与之一致，否则 `INVALID_REQUEST`。不允许跨公司用 A 公司 `providerId` 解析出 Adapter 去操作 B 公司订单。

---

## 六、ManualAdapter

- `code = 'manual'`
- 不发任何网络请求
- **不**伪造上游成功（allocate/poll/webhook 均不“假装成功”）
- 支撑现状：运营本地选号创建订单 + `POST .../sms`；这些路径 **不调用** ManualAdapter 上游方法
- 未知 adapter **不得**解析为 ManualAdapter

| 方法 | 行为 |
|------|------|
| `getCapabilities` | 全部 `false` |
| `validateConfig` | `null/undefined/{}` → ok；其它 → 失败（manual 不需要配置） |
| `allocateNumber` 等 optional | **不定义**；若被强制调用则由 Factory 拦截为 `UNSUPPORTED` |
| `mapError` | 包装为安全错误 |

---

## 七、统一错误模型

```typescript
export type ProviderOperation =
  | 'VALIDATE_CONFIG'
  | 'RESOLVE_ADAPTER'
  | 'ALLOCATE_NUMBER'
  | 'POLL_MESSAGES'
  | 'VERIFY_WEBHOOK'
  | 'PARSE_WEBHOOK'
  | 'CANCEL_ORDER'
  | 'RELEASE_NUMBER'
  | 'QUERY_BALANCE'
  | 'INGRESS_SMS';

export type ProviderErrorCategory =
  | 'UNSUPPORTED'
  | 'CONFIG'
  | 'AUTH'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'UPSTREAM'
  | 'UNKNOWN';

export interface ProviderAdapterError {
  code: string;                 // 稳定机读码，如 ADAPTER_NOT_FOUND
  category: ProviderErrorCategory;
  operation: ProviderOperation;
  providerCode: string;
  retryable: boolean;
  safeMessage: string;          // 可返回客户端
  internalMessage?: string;     // 仅日志
  upstreamCode?: string;        // 上游错误码，脱敏后可日志
}
```

| Category | retryable | Polling 重试 | 人工介入 | 可否直接改订单终态 |
|----------|-----------|--------------|----------|--------------------|
| UNSUPPORTED / CONFIG / AUTH / INVALID_REQUEST | 否 | 否 | 是（配置/权限） | **否** |
| NOT_FOUND | 否 | 否（按场景） | 可能 | **否** |
| CONFLICT | 否 | 否 | 可能 | **否**（由领域入口决定） |
| RATE_LIMIT / TIMEOUT / UPSTREAM | 是 | 是 | 连续失败后是 | **否** |
| UNKNOWN | 默认否 | 谨慎 | 是 | **否** |

**原则**：Provider 错误 **绝不**直接 `order.update`；终态只通过现有领域闭环：

- 成功：短信完成入口（今日 `SmsService.createForOrder`，`apps/api/src/sms/sms.service.ts`）
- 失败/取消：`OrdersService.updateStatus` / `OrdersService.timeoutOrder`

**HTTP 映射（建议）**：CONFIG/AUTH→400/401/403；NOT_FOUND→404；CONFLICT→409；RATE_LIMIT→429；TIMEOUT/UPSTREAM→502/503；其余 500。响应只含 `safeMessage`。

**日志脱敏**：禁止记录 token、签名密钥、`config` 全文、完整 webhook rawBody；可记 `providerId`、`adapterCode`、`operation`、`category`、`upstreamCode`、`orderId`。

---

## 八、Webhook 与 Polling 共用入口

### `ProviderSmsIngressService.accept(input)`

**输入（阶段内）**：

```typescript
interface ProviderSmsIngressInput {
  source: 'webhook' | 'polling' | 'manual_bridge'; // manual_bridge 仅当未来统一入口时用
  companyId: string;
  providerId: string;
  orderId: string;
  code?: string;
  content?: string;
  receivedAt: Date;
  /** 可选：真实 Provider 消息幂等键；当前无 DB 列，仅参与内存/日志与未来迁移触发判断 */
  providerMessageId?: string;
}

type ProviderSmsIngressResult =
  | { status: 'completed' }
  | { status: 'ignored_terminal'; orderStatus: string }
  | { status: 'rejected'; error: ProviderAdapterError };
```

**处理步骤（设计）**：

1. Factory 解析 Provider（status + adapter）；Webhook/Polling 路径已在 Adapter 边界完成 verify/parse。
2. 在 **单事务** 内：`SELECT Order FOR UPDATE`（补齐今日 SMS 路径缺口）。
3. 校验 `companyId`、`providerId` 匹配；状态必须 `WAIT_SMS`。
4. 终态 → 幂等返回 `ignored_terminal`（不二次 capture）。
5. code/content 至少一项（对齐 `CreateSmsDto`，`apps/api/src/sms/dto/create-sms.dto.ts`）。
6. 调用与 `SmsService.createForOrder` **同一套** 完成逻辑：
   - `WalletLedgerService.capture`（幂等键：`order:{orderId}:capture`，见 `buildOrderWalletIdempotencyKey`，`apps/api/src/wallets/order-currency.util.ts`）
   - PhoneResource `LOCKED→USED`（`updateMany` CAS）
   - Order → `SUCCESS`
   - Sms.create `RECEIVED`
   - AuditLog `sms.create` + `order.status`
7. 与 timeout 并发：双方都应锁 Order 行；一方成功后另一方见非 `WAIT_SMS` 后退出。

### 当前无 Provider event ID 字段时的幂等策略

- **资金层**：已有 capture 幂等键 → 重复成功不会双扣。
- **订单层**：`FOR UPDATE` + 状态机 → 第二笔在终态短路。
- **短信层（现状）**：无 `providerMessageId` 唯一约束；同一订单两笔不同内容在 SUCCESS 后会被拒；并发双插入仍依赖锁。
- **接口仍保留 `providerMessageId?`**：供真实接入前传，**本阶段不写库**。

### 最小 additive migration 触发条件（不是现在就建表）

仅当 **首个真实 Provider** 且满足任一条件时，再提案 additive migration（待确认后执行）：

1. 上游保证稳定 `providerMessageId`，且会发生 **至少一次重投**（Webhook at-least-once）；或
2. Polling/Webhook **双通道并发** 需要跨进程去重；或
3. 需要审计「同一消息处理结果」而无法用 Order 终态表达。

届时再讨论列还是侧表；**本设计不定案建表方案**。

### 特殊场景

| 场景 | 行为 |
|------|------|
| 重复短信（订单已 SUCCESS） | 忽略，幂等成功响应（HTTP 层可 200/409 策略待确认） |
| 订单 FAILED/CANCELLED | 忽略或 `ignored_terminal`；**不**自动复活 |
| 找不到 Order / 订单不属于该 Provider | `NOT_FOUND` / `INVALID_REQUEST`；不改任何状态 |
| 未知 Adapter | Factory 已 fail closed，进不了 accept |

---

## 九、事务与外部调用边界

### 1. 手工短信成功（现状，作为目标内核）

```text
Client → SmsController/OrderSmsController
  → (事务外) 读取 Order
  → BEGIN
       [建议未来] Order FOR UPDATE
       capture (WalletAccount FOR UPDATE + WalletTransaction)
       Phone LOCKED→USED
       Order→SUCCESS
       Sms create
       AuditLogs
  → COMMIT
```

事务内无网络。

### 2. Webhook 短信成功

```text
HTTP Webhook
  → (事务外) Factory.resolve → Adapter.verifyWebhook → Adapter.parseWebhook
  → ProviderSmsIngressService.accept(normalized)
       → BEGIN + Order FOR UPDATE + 与手工相同的完成闭环
       → COMMIT
```

原始 body 不出 Adapter。

### 3. Polling 短信成功

```text
Job Worker (事务外)
  → Factory.resolve → Adapter.pollMessages
  → for each NormalizedProviderSms: accept(...)
       → 各自独立事务完成闭环
```

### 4. Provider 取号（预留；本阶段不改 create 语义）

```text
[未来，未经确认不实施]
  (事务外) allocateNumber
  成功 → (事务内) 本地 PhoneResource/Order/freeze
  外部成功本地失败 → Adapter.releaseNumber/cancel 补偿（事务外）
  本地成功不应在事务内再调网络
```

今日 `OrdersService.create`：本地锁已有库存号 + freeze，无上游。

### 5. Provider 取消（预留）

```text
[未来]
  本地 timeout/updateStatus(CANCELLED) 与上游 cancelOrder 的先后顺序 → 待确认（第十二节）
  网络始终事务外；本地 release+解锁 在现有事务内
```

### 6. Timeout 与短信同时发生

```text
T1 timeoutOrder: BEGIN; Order FOR UPDATE; 见 WAIT_SMS; release; unlock phone; CANCELLED; COMMIT
T2 sms accept:   BEGIN; Order FOR UPDATE; 见 CANCELLED; return ignored_terminal; COMMIT
或反过来：SMS 先 SUCCESS，timeout 见 not_wait_sms（现有 OrdersService.timeoutOrder 已支持）
```

今日缺口：`SmsService.createForOrder` / `OrdersService.updateStatus` **尚无** Order `FOR UPDATE`；Phase 3 补齐前存在竞态风险。

---

## 十、与现有代码的集成点

| 集成点 | 保持不变 | 未来提取/挂钩 | 不能直接改 | 风险 |
|--------|----------|---------------|------------|------|
| `OrdersService.create` | `WAIT_SMS`、锁号、freeze、审计、事务后 schedule timeout | 未经确认前不调 `allocateNumber` | 创建语义、金额来源 | 过早接上游会造成孤儿号 |
| `OrdersService.updateStatus` | SUCCESS/FAILED/CANCELLED 副作用 | 补 Order 行锁；CANCEL 后可选 cancelOrder（事务外） | 终态集合、钱包幂等键 | 与 SMS 竞态 |
| `OrdersService.timeoutOrder` | CANCELLED+TIMEOUT、FOR UPDATE、release | 终态后取消 Bull job；可选上游释放 | 超时语义 | 与 SMS 竞态已有锁保护 |
| `SmsService.createForOrder` | 完成闭环字段语义 | 抽到 OrderSmsCompletion / Ingress 复用 | capture 幂等键语义 | 无 Order 锁 |
| `WalletLedgerService` | 唯一余额入口、写 WalletTransaction | Adapter 禁止直接调用 | mutation 模式 | 若旁路更新余额违约束 |
| `ProvidersService` | CRUD adapter 字符串 | 内部读 `config`；API 暴露 config 需脱敏（additive API，非必改表） | 不把 config 明文回全量列表 | config 泄露 |
| `PhoneResourcesService` | 本地库存 CRUD | 人工改 LOCKED 风险治理 | 不让 Adapter 改状态 | 状态漂移 |
| Jobs Module | timeout queue+scan | 新增 Polling Worker 独立队列 | 不把 polling 混进 timeoutOrder | 多实例重复 poll |
| `AppModule` | 模块列表可增量 | `import AdaptersModule` | 不替换 OrdersModule | 循环依赖需谨慎 |

---

## 十一、实施阶段拆分

### Phase 0：补测试与并发基线

- **范围**：扩展/补充 `verify-order-timeout` / wallet 脚本或 API 测试，覆盖 SMS vs timeout、双 SMS。
- **数据库**：否
- **验收**：已知竞态行为被文档化或测试固定
- **回滚**：删测试即可
- **禁止**：改业务语义、接真实 API
- **门禁**：第十二节相关决策未确认前不开始本 Phase

### Phase 1：纯类型与接口

- **范围**：仅类型文件（按第二节目录）
- **数据库**：否
- **验收**：类型可编译引用；无运行行为变化
- **回滚**：删类型目录
- **禁止**：注入 AppModule 改路径

### Phase 2：Registry、Factory、ManualAdapter

- **范围**：Registry/Factory/Manual + AdaptersModule 注册；可加只读 resolve API 或内部方法供测试
- **数据库**：否
- **验收**：`manual` 可解析；未知 code 失败；重复注册启动失败；不改订单 API
- **回滚**：不注册 Module 即可
- **禁止**：改 `OrdersService.create`；未知回退 manual

### Phase 3：统一短信完成领域入口

- **范围**：抽取 completion；`createForOrder` 委托；Ingress.accept 复用；Order `FOR UPDATE`
- **数据库**：否
- **验收**：手工短信行为与现网一致；与 timeout 并发安全
- **回滚**：委托改回内联（困难则 feature flag）
- **禁止**：Webhook/Polling 业务流量；改钱包键

### Phase 4：Webhook 架构骨架

- **范围**：Controller + verify/parse（仍只有 Manual 则路由拒绝非能力 provider）+ accept
- **数据库**：否（无 event 表）
- **验收**：验签失败不落库；无能力 provider 失败；不改 V1 创建
- **回滚**：卸路由
- **禁止**：真实供应商协议；存 raw secret 明文日志

### Phase 5：Polling 架构骨架

- **范围**：BullMQ/扫描式 worker；调 `pollMessages`；写入走 accept
- **数据库**：否
- **验收**：manual/capabilities=false 不轮询；错误分类驱动重试
- **回滚**：停 worker
- **禁止**：与 timeout 共用处理器逻辑复制完成闭环

### Phase 6：首个真实 Provider

- **范围**：新 Adapter 类；config 校验；webhook 和/或 polling；**仅在触发条件满足时** 提案 additive migration
- **数据库**：仅经确认的 additive；默认先尝试无表接入
- **验收**：端到端沙箱；核心事务无网络；失败不乱改终态
- **回滚**：禁用 Provider.status / 去掉 registry 注册
- **禁止**：推倒 V1；改 OrderStatus 枚举语义；Adapter 直接写 Prisma 核心模型

---

## 十二、待确认决策（门禁清单）

以下问题未确认前，**不得进入 Phase 0/1 编码**。

| # | 问题 | 现状依据 | 状态 |
|---|------|----------|------|
| 1 | 一个订单是否允许多条短信？ | SUCCESS 后拒绝第二笔（`SmsService.createForOrder`） | 待确认 |
| 2 | `PENDING` 是否用于 Provider 异步下单？ | Schema 有、创建直写 `WAIT_SMS`（`OrdersService.create`） | 待确认 |
| 3 | 上游 `cancelOrder` 失败时，本地是否仍允许 CANCELLED/TIMEOUT？ | 本地取消不调上游 | 待确认 |
| 4 | Webhook 与 Polling 是否可对同一 Provider 同时启用？ | 尚无二者实现 | 待确认 |
| 5 | Provider 凭据存哪里？加密/KMS？ | `Provider.config` Json 已有但 API 未暴露（`ProvidersService`） | 待确认 |
| 6 | `Order.amount` 定价来源？ | 来自请求 DTO，非 `PhoneResource.cost` | 待确认 |
| 7 | PhoneResource 是本地库存还是上游实时号码映射？ | 今日本地库存 CAS 锁号 | 待确认 |
| 8 | 禁用 Provider/Service 是否应硬拦截下单？ | `validateCreateRelations` 未查 status | 待确认 |
| 9 | Ingress 对已终态重复投递的 HTTP 状态码？ | 200 幂等 vs 409 | 待确认 |
| 10 | 生产是否已应用超时字段 migration？ | 迁移文件在仓内，运行态未验证 | 待确认 |

---

## 审核检查清单

- [ ] 同意 capabilities + optional 方法策略
- [ ] 同意未知 adapter fail closed、禁止回退 manual
- [ ] 同意本阶段不建 Provider 专属表，仅定义迁移触发条件
- [ ] 同意不改 `OrdersService.create` 语义直至明确确认
- [ ] 同意 Phase 拆分与集成边界
- [ ] 第十二节决策已逐项确认（通过后才允许 Phase 0）

---

## 相关代码索引

| 用途 | 路径 |
|------|------|
| Schema Provider/Order/Sms | `packages/database/prisma/schema.prisma` |
| 订单创建/超时/改状态 | `apps/api/src/orders/orders.service.ts` |
| 短信成功闭环 | `apps/api/src/sms/sms.service.ts` |
| Provider CRUD | `apps/api/src/providers/providers.service.ts` |
| 钱包账本 | `apps/api/src/wallets/wallet-ledger.service.ts` |
| 钱包幂等键 | `apps/api/src/wallets/order-currency.util.ts` |
| 超时队列 | `apps/api/src/jobs/order-timeout-queue.service.ts` |
| 超时扫描 | `apps/api/src/jobs/order-timeout-scan.service.ts` |
| 系统架构总览 | `docs/architecture.md` |
