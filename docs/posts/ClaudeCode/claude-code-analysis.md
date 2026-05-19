---
title: Claude Code 主工作流深度解析
date: 2026-05-16
description: 基于源码逆向分析的 Claude Code CLI 主工作流架构解析
---

# Claude Code 主工作流深度解析

> 基于源码逆向分析，版本：Claude Code CLI (Bun 运行时)

---

## 目录

1. [架构概览](#1-架构概览)
2. [启动路径：从 CLI 入口到 REPL](#2-启动路径从-cli-入口到-repl)
3. [QueryEngine：对话会话管理器](#3-queryengine对话会话管理器)
4. [核心查询循环：queryLoop 深度剖析](#4-核心查询循环queryloop-深度剖析)
5. [模型调用与流式处理](#5-模型调用与流式处理)
6. [工具编排与执行](#6-工具编排与执行)
7. [上下文压缩体系](#7-上下文压缩体系)
8. [错误恢复与韧性设计](#8-错误恢复与韧性设计)
9. [停止钩子与后处理](#9-停止钩子与后处理)
10. [总结](#10-总结)

---

## 1. 架构概览

Claude Code 是一个基于 **Bun** 运行时的 TypeScript 终端应用。项目采用 `"type": "module"` 模块系统，使用 Ink 框架渲染终端 UI（React 风格的声明式组件）。

### 核心分层

```
┌──────────────────────────────────────────────┐
│  CLI 入口层 (entrypoints/)                     │
│  bootstrap-entry.ts → cli.tsx → main.tsx       │
├──────────────────────────────────────────────┤
│  UI 层 (screens/, components/, ink/)           │
│  REPL.tsx — Ink 终端交互界面                    │
├──────────────────────────────────────────────┤
│  会话管理层 (QueryEngine.ts)                    │
│  对话状态、权限、文件缓存、SDK 适配               │
├──────────────────────────────────────────────┤
│  核心查询循环 (query.ts — queryLoop)            │
│  消息组装 → 模型调用 → 流式处理 → 工具执行        │
│  → 停止钩子 → 循环决策                          │
├──────────────────────────────────────────────┤
│  服务层 (services/)                             │
│  API 客户端 | 上下文压缩 | 工具编排 | MCP        │
├──────────────────────────────────────────────┤
│  工具实现层 (tools/)                            │
│  Bash, Read, Write, Edit, Agent, Task...       │
└──────────────────────────────────────────────┘
```

关键设计决策：
- **异步生成器贯穿全链路**：从 `query()` 到 `queryLoop()` 到 `runTools()` 全部使用 `AsyncGenerator`，使流式数据可以逐条 yield 给 UI 层渲染，无需缓冲整轮响应。
- **依赖注入**：`query/deps.ts` 定义了 `QueryDeps` 接口，将 API 调用、压缩、UUID 生成等副作用注入循环，便于测试。
- **Feature Flag 驱动**：大量实验性功能（流式工具执行、上下文折叠、历史 Snip 等）通过 `bun:bundle` 的 `feature()` 宏实现编译期死代码消除。

---

## 2. 启动路径：从 CLI 入口到 REPL

### 2.1 引导入口 (`bootstrap-entry.ts`)

```typescript
// 实际入口：调用内联宏后动态加载 CLI
ensureBootstrapMacro();
import('./entrypoints/cli.tsx');
```

`ensureBootstrapMacro()` 在构建时内联编译时常量（如 `MACRO.VERSION`）。所有后续导入都是**动态的**，确保 `--version` 等快速路径零依赖加载。

### 2.2 CLI 分发 (`entrypoints/cli.tsx`)

`main()` 函数是一个**纯分发路由器**——根据 CLI 参数选择执行路径：

| 参数 | 路径 | 加载策略 |
|------|------|---------|
| `--version` / `-v` | 打印版本退出 | **零导入** |
| `--dump-system-prompt` | 输出系统提示词 | ant-only，feature-gate 裁剪 |
| `--claude-in-chrome-mcp` | Chrome MCP 服务器 | 动态导入 MCP 模块 |
| `daemon` / `ps` / `logs` / `attach` | 后台会话管理 | 动态导入对应模块 |
| 无特殊标志 | **完整交互 CLI** | → `src/main.tsx` 的 `main()` |

进入交互模式前，`startCapturingEarlyInput()` 会预先缓冲标准输入，避免用户在启动过程中输入的内容丢失。

### 2.3 完整初始化 (`main.tsx` 的 `main()`)

这是启动过程中最重的环节，执行顺序大致为：

1. **`init()`** — 共享初始化：配置系统、环境变量、CA 证书、优雅关闭、OAuth 令牌、代理/mTLS、HTTP Agent 池、临时目录
2. **信任对话框** — 权限模式选择（default / acceptEdits / plan / bypass）
3. **MCP 服务器配置** — 加载并连接已配置的 MCP 服务器
4. **Agent 定义加载** — 从 `.claude/agents/` 目录加载自定义 Agent
5. **插件系统初始化**
6. **系统/用户上下文构建** — 通过 `context.ts` 收集 git 状态、CLAUDE.md 文件、平台信息
7. **命令和工具注册**
8. **REPL 启动** — `launchRepl()` 动态导入 `App` 和 `REPL` 组件，通过 Ink 渲染终端 UI

---

## 3. QueryEngine：对话会话管理器

`QueryEngine` (`src/QueryEngine.ts`) 是一个**会话级别**的状态容器。一个 `QueryEngine` 实例对应一次完整对话（可包含多轮 turn）。

### 核心职责

```typescript
export class QueryEngine {
  private mutableMessages: Message[]      // 完整消息历史
  private abortController: AbortController // 中断控制
  private permissionDenials: SDKPermissionDenial[] // 权限拒绝追踪
  private totalUsage: NonNullableUsage     // 累计 token 用量
  private readFileState: FileStateCache    // 文件读取缓存
  private discoveredSkillNames: Set<string> // 技能发现追踪
}
```

### submitMessage：每轮 turn 的入口

`submitMessage()` 是公共 API——SDK 调用者和 REPL 都通过它发起一轮对话。它的工作流程：

1. **包装 `canUseTool`**：在权限检查外层增加拒绝追踪，用于 SDK 的 `permission_denials` 事件
2. **解析模型配置**：用户指定模型、思考配置、回退模型
3. **构建 `ToolUseContext`**：工具定义集合、权限上下文、中断控制器、文件状态缓存、Agent 定义
4. **获取系统提示词**：异步拉取系统提示词分片（支持缓存）
5. **加载记忆/附件**：MEMORY.md、项目记忆、CLAUDE.md 注入
6. **处理孤立权限**：跨会话恢复的权限确认
7. **调用 `query()`**：核心异步生成器，进入查询循环
8. **后处理**：更新用量统计、刷新会话存储、记录转录日志

### 设计亮点

- **文件状态缓存** (`readFileState`)：跨多轮 turn 维护，`Read`/`Write`/`Edit` 工具执行后更新。避免幻觉性的重复读取；记忆系统用它去重。
- **SDK 兼容层**：`submitMessage` 产出 `SDKMessage` 流，兼容 Agent SDK 协议，同时服务于终端 REPL。

---

## 4. 核心查询循环：queryLoop 深度剖析

`queryLoop()` (`src/query.ts`，约 1600 行) 是整个系统的心脏。它是一个 `while(true)` 循环的异步生成器，每轮迭代代表与模型的一次往返交互。

### 4.1 循环状态机

```typescript
type State = {
  messages: Message[]                    // 当前消息历史
  toolUseContext: ToolUseContext         // 工具上下文（每轮可能更新）
  autoCompactTracking: ... | undefined   // 自动压缩跟踪
  maxOutputTokensRecoveryCount: number  // 输出 token 恢复计数
  hasAttemptedReactiveCompact: boolean  // 是否已尝试反应式压缩
  pendingToolUseSummary: ...             // 上一轮的工具摘要（异步生成中）
  stopHookActive: boolean               // Stop 钩子是否激活
  turnCount: number                     // 当前 turn 计数
  transition: Continue | undefined      // 上一轮的继续原因（用于测试断言）
}
```

状态通过不可变更新传递——每个 `continue` 站点构造一个新的 `State` 对象，避免副作用泄漏。

### 4.2 单次迭代的完整流程

```
┌─────────────────────────────────────────┐
│ 1. 构建 QueryConfig（不可变快照）          │
│    会话 ID、运行时 feature gates          │
├─────────────────────────────────────────┤
│ 2. 记忆预取（fire-and-forget）             │
│    startRelevantMemoryPrefetch()          │
├─────────────────────────────────────────┤
│ 3. 技能发现预取（fire-and-forget）         │
│    startSkillDiscoveryPrefetch()          │
├─────────────────────────────────────────┤
│ 4. 消息准备管道                           │
│    ├─ getMessagesAfterCompactBoundary()   │
│    ├─ applyToolResultBudget()            │
│    ├─ snipCompactIfNeeded()  (可选)       │
│    ├─ microcompact()                     │
│    ├─ applyCollapsesIfNeeded() (可选)     │
│    └─ autocompact()                      │
├─────────────────────────────────────────┤
│ 5. 令牌阻塞检查                           │
│    若超出硬限制且压缩关闭 → 提前返回         │
├─────────────────────────────────────────┤
│ 6. 模型调用 (deps.callModel)              │
│    ├─ 组装系统提示词 + 用户上下文           │
│    ├─ 流式请求 Anthropic API              │
│    ├─ 流式工具执行 (StreamingToolExecutor) │
│    └─ 错误处理 (rate-limit, overload...)  │
├─────────────────────────────────────────┤
│ 7. 流式后处理                             │
│    ├─ 延迟的 microcompact 边界消息         │
│    ├─ 中断处理 + 合成 tool_result          │
│    ├─ 工具摘要产出                         │
│    └─ 错误恢复 (prompt-too-long, etc.)    │
├─────────────────────────────────────────┤
│ 8. 工具执行 (如有 tool_use)                │
│    ├─ 分区：并发安全 vs 串行               │
│    ├─ StreamingToolExecutor 剩余结果       │
│    ├─ 附件注入（通知、命令队列）             │
│    ├─ 记忆预取消费                         │
│    └─ 技能发现注入                         │
├─────────────────────────────────────────┤
│ 9. 停止钩子 (无 tool_use 时)               │
│    ├─ executeStopHooks()                  │
│    ├─ TaskCompleted / TeammateIdle hooks  │
│    └─ 阻塞性错误 → continue               │
├─────────────────────────────────────────┤
│ 10. 决策                                  │
│     ├─ needsFollowUp? → continue          │
│     ├─ 停止钩子阻塞? → continue            │
│     ├─ Token 预算未耗尽? → continue        │
│     └─ 否则 → return Terminal             │
└─────────────────────────────────────────┘
```

### 4.3 关键 Continue 路径

循环有 **7 个 continue 站点**，每个都有明确的 `transition` 原因：

| Transition | 触发条件 |
|---|---|
| `model_fallback` | 模型过载切换到回退模型 |
| `collapse_drain_retry` | 上下文折叠释放空间后重试 |
| `reactive_compact_retry` | 反应式压缩后重试 |
| `max_output_tokens_escalate` | 提升 max_output_tokens 重试 |
| `max_output_tokens_recovery` | 注入恢复消息继续 |
| `stop_hook_blocking` | Stop 钩子注入消息继续 |
| `token_budget_continuation` | Token 预算未耗尽继续 |

---

## 5. 模型调用与流式处理

### 5.1 API 客户端 (`services/api/claude.ts`)

`queryModelWithStreaming()` 封装了与 Anthropic API 的流式通信：

- **系统提示词**：通过 `splitSysPromptPrefix()` 将系统提示词分为可缓存的 prefix 和动态 suffix
- **工具定义**：`toolToAPISchema()` 将内部 Tool 对象转换为 API schema，支持 Beta 功能如 `type` 字段（`bash_20250123` 等）
- **Thinking 配置**：`budget_tokens`、`effort` 等思考参数
- **Task Budget**：Beta 功能 `task_budgets-2026-03-13`，在 API 层面限制整个 agentic turn 的输出总量
- **错误分类**：`categorizeRetryableAPIError()` 区分可重试错误（429 rate limit、503 overload）和不可重试错误（401 auth）

### 5.2 StreamingToolExecutor (`services/tools/StreamingToolExecutor.ts`)

这是实验性功能（通过 `streamingToolExecution` feature gate 控制）。核心思想是：

> 模型在流式输出 tool_use 块时，不必等待整个响应完成，就可以**并发启动工具执行**。

```
模型流式输出:
  text: "Let me check..." 
  tool_use: { name: "Read", id: "tool_01" }  ← 立即提交执行
  text: "And also..." 
  tool_use: { name: "Bash", id: "tool_02" }  ← 立即提交执行
  [流式结束]

同时:
  StreamingToolExecutor
    ├─ tool_01: Read → 执行中...
    └─ tool_02: Bash → 执行中...
```

关键行为：
- **`addTool()`**：当流式块到达时，立即将工具提交给执行器
- **`getCompletedResults()`**：在流式循环内轮询已完成的结果，随模型响应一起 yield 给 UI
- **`getRemainingResults()`**：流式结束后，等待所有剩余工具完成
- **`discard()`**：在模型回退时丢弃所有未完成结果，防止孤立的 tool_result

### 5.3 流式循环中的消息处理

```typescript
for await (const message of deps.callModel({...})) {
  // 1. 回填可观察输入 (backfillObservableInput)
  // 2. 扣留可恢复错误 (prompt-too-long, max-output-tokens)
  // 3. 正常的 assistant/tool_use 消息 yield 给 UI
  // 4. 收集 assistantMessages（用于后续工具执行）
  // 5. 收集 toolUseBlocks（设置 needsFollowUp）
  // 6. 提交给 StreamingToolExecutor
  // 7. 轮询已完成的流式工具结果
}
```

---

## 6. 工具编排与执行

### 6.1 工具分区 (`toolOrchestration.ts`)

`runTools()` 将工具调用分为**并发安全**和**串行**两个批次：

```typescript
export async function* runTools(toolUseMessages, ...) {
  for (const { isConcurrencySafe, blocks } of partitionToolCalls(...)) {
    if (isConcurrencySafe) {
      // 只读工具（Read、Grep、Glob 等）→ 并发执行
      yield* runToolsConcurrently(blocks, ...)
    } else {
      // 写工具（Write、Edit、Bash 等）→ 串行执行
      yield* runToolsSerially(blocks, ...)
    }
  }
}
```

并发控制由环境变量 `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`（默认 10）限制。

### 6.2 单工具执行 (`toolExecution.ts`)

每个工具的完整执行路径：

```
┌─────────────────────────────────┐
│ 1. findToolByName()             │
│    从工具注册表查找工具实现        │
├─────────────────────────────────┤
│ 2. Zod Schema 验证               │
│    验证 tool_use 输入参数         │
├─────────────────────────────────┤
│ 3. canUseTool() 权限检查         │
│    ├─ 用户批准 UI (非交互模式跳过) │
│    ├─ Permission denied → 生成    │
│    │   错误 tool_result + 钩子     │
│    └─ Permission granted → 继续   │
├─────────────────────────────────┤
│ 4. tool.call() 实际执行          │
│    ├─ 进度回调 (进度消息)          │
│    ├─ PreToolUse hooks           │
│    └─ 返回 tool_result            │
├─────────────────────────────────┤
│ 5. 上下文更新                     │
│    └─ 文件状态缓存更新             │
└─────────────────────────────────┘
```

### 6.3 工具注册表 (`tools.ts`)

所有工具通过 `getTools()` 集中注册。工具实现位于 `src/tools/`，每个工具一个子目录：

| 工具 | 目录 |
|------|------|
| BashTool | `tools/BashTool/` |
| FileReadTool | `tools/FileReadTool/` |
| FileWriteTool | `tools/FileWriteTool/` |
| FileEditTool | `tools/FileEditTool/` |
| AgentTool | `tools/AgentTool/` |
| TaskTool | `tools/TaskTool/` |
| ... | ... |

---

## 7. 上下文压缩体系

Claude Code 实现了**多层压缩策略**，从轻量到重量级递进：

### 7.1 Tool Result Budget (`applyToolResultBudget`)

最轻量的压缩。对每个工具结果的字节数设限，超额内容替换为截断提示。选项 `maxResultSizeChars` 控制每个工具的阈值。

### 7.2 Snip 压缩 (`snipCompact.ts`)

历史消息截断。将对话中过旧的消息替换为边界标记，释放 token 空间。仅保留受保护的"尾部"（最近的 N 条消息）。

### 7.3 微压缩 (`microCompact.ts`)

针对工具结果的缓存压缩。利用 Anthropic API 的 prompt caching 机制——将重复出现的工具结果替换为缓存引用，减少每次请求的 input token 消耗。可实现**缓存编辑**：修改已缓存的内容块而无需重新发送。

### 7.4 上下文折叠 (`contextCollapse/index.ts`)

实验性功能。将历史上下文的可折叠部分替换为摘要，但保留比自动压缩更细粒度的原始信息。折叠是**读时投影**——原始消息保留在 REPL 历史中，仅发送给 API 的消息视图被折叠。

### 7.5 自动压缩 (`autoCompact.ts`)

最重量级的压缩。当 token 计数超过阈值时触发：

1. **触发条件**：`calculateTokenWarningState()` 检测 token 用量接近模型上下文窗口上限
2. **压缩过程**：使用 Haiku 模型（低成本、低延迟）对历史对话进行摘要
3. **结果组装**：`buildPostCompactMessages()` 将摘要 + 保留的关键消息（附件、钩子结果）合并为新的消息列表
4. **连续失败断路器**：如果自动压缩连续失败，停止重试以避免 API 费用螺旋

### 7.6 反应式压缩 (`reactiveCompact.ts`)

当自动压缩未阻止 `prompt_too_long` 错误时触发。这是**API 错误驱动的压缩**——收到 413 错误后才执行，比主动压缩更激进。

压缩执行的顺序：

```
Tool Result Budget → Snip → Microcompact → Context Collapse → Autocompact
                                                                    ↓ (失败)
                                                           Reactive Compact
```

---

## 8. 错误恢复与韧性设计

`queryLoop` 的流式处理循环内建了多层错误恢复机制：

### 8.1 模型回退 (Fallback)

```
模型过载 (FallbackTriggeredError)
  → 清除当前 assistantMessages
  → 为已有的 tool_use 合成 tool_result (is_error)
  → 切换到 fallbackModel
  → 继续当前迭代（全新的 API 请求）
```

关键细节：回退前调用 `stripSignatureBlocks()` 移除 thinking 签名块，因为不同模型的 thinking 格式不兼容。

### 8.2 Prompt Too Long 恢复链

```
API 返回 prompt_too_long
  → 流式循环内部扣留 (withhold)，不暴露给 SDK
  → 尝试 1: 上下文折叠排水 (collapse drain)
      ├─ 成功 → continue (transition: collapse_drain_retry)
      └─ 失败 ↓
  → 尝试 2: 反应式压缩 (reactive compact)
      ├─ 成功 → continue (transition: reactive_compact_retry)
      └─ 失败 → 暴露错误，executeStopFailureHooks(), 终止
```

### 8.3 Max Output Tokens 恢复

```
API 返回 max_output_tokens
  → 流式循环内部扣留
  → 尝试 1: 提升 max_output_tokens 到 64k (ESCLATED_MAX_TOKENS)
      ├─ 首次且未手动设置 → continue (transition: max_output_tokens_escalate)
      └─ 已尝试或禁用了 ↓
  → 尝试 2: 多轮恢复 (最多 3 次)
      ├─ 注入 "Output token limit hit..." 恢复消息 → continue
      └─ 耗尽 → 暴露错误，终止
```

### 8.4 中断处理

```
用户中断 (abortController.abort())
  → 流式工具执行器：为 queued/in-progress 工具生成合成 tool_result
  → 非流式执行器：yieldMissingToolResultBlocks()
  → chicago MCP: 清理计算机使用状态
  → 返回 { reason: 'aborted_streaming' | 'aborted_tools' }
```

---

## 9. 停止钩子与后处理

当模型返回的响应不包含 tool_use（`needsFollowUp === false`）时，`handleStopHooks()` 接管流程。

### 9.1 钩子执行顺序

```typescript
export async function* handleStopHooks(...) {
  // 1. 模板任务分类 (TEMPLATES feature gate)
  //    检查是否需要触发预定义模板任务

  // 2. Stop hooks 执行
  //    用户配置的 Stop 钩子脚本
  //    ├─ 非阻塞: 并行执行，不影响决策
  //    └─ 阻塞: 注入消息 → 循环 continue

  // 3. TaskCompleted hooks (teammate 子任务完成)
  //    └─ 注入任务摘要消息

  // 4. TeammateIdle hooks (队友空闲通知)
  //    └─ 注入空闲提示消息

  // 5. 记忆提取 (EXTRACT_MEMORIES feature gate)
  //    后台异步提取对话中的记忆点

  // 6. 提示建议 (PromptSuggestion)
  //    后台生成下一个推荐提示

  // 7. 自动 Dream (autoDream)
  //    后台异步探索和预加载
}
```

### 9.2 设计考量

- **Fire-and-forget 用于非关键路径**：`executePostSamplingHooks()` 在模型响应后立即触发，不阻塞工具执行。记忆提取、提示建议等同样不阻塞主循环。
- **阻塞钩子的安全阀**：如果 Stop 钩子注入的消息导致 API 错误（如 413），循环不会无限重试——`hasAttemptedReactiveCompact` 跨越 continue 保留，防止死亡螺旋。
- **API 错误时跳过**：如果最后一个消息是 API 错误（rate limit、认证失败等），跳过 Stop 钩子——此时模型没有产生有效输出，执行钩子会导致重复错误。

---

## 10. 总结

Claude Code 的主工作流可以抽象为以下数据流：

```
用户输入
  │
  ▼
processUserInput()          ← 解析斜杠命令、粘贴、@提及
  │
  ▼
QueryEngine.submitMessage() ← 会话管理、权限包装、上下文准备
  │
  ▼
query() → queryLoop()       ← 核心循环（异步生成器）
  │
  ├─→ 消息准备管道           ← 多层压缩
  ├─→ model call            ← 流式 API + 流式工具执行
  ├─→ 错误恢复              ← 回退/压缩/令牌提升
  ├─→ 工具执行              ← 并发安全分区
  ├─→ 附件注入              ← 记忆/技能/通知
  └─→ 停止钩子              ← Stop/Task/Teammate hooks
  │
  ▼
REPL / SDK Consumer         ← 增量渲染每条消息
```

几个值得关注的架构决策：

1. **异步生成器全链路**：允许在模型仍在流式输出时就开始渲染结果和执行工具，用户感知延迟显著降低。
2. **编译期功能裁剪**：`bun:bundle` 的 `feature()` 宏使实验性功能在外部构建中完全消失，无运行时开销。
3. **多层压缩阶梯**：从字节级截断到语义级摘要的递进压缩，在保留上下文质量和控制 token 成本之间取得平衡。
4. **错误恢复的状态机设计**：每个 `continue` 路径携带明确的 `transition` 原因，使复杂恢复逻辑可测试、可追踪。
5. **工具执行的分区策略**：将只读和写入操作分离为并发/串行批次，在安全性和性能之间取得折衷。

---

*本文基于 Claude Code 源码逆向分析撰写，重点关注主工作流的数据流和控制流。分支命令（如 `/compact`、`/clear`、`/resume` 等）、具体的工具实现细节、以及 UI 渲染层不在本文讨论范围内。*
