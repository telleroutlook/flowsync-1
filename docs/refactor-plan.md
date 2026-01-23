# FlowSync 重构计划（面向 AI Agent 的项目管理系统）

> 目标：把当前“前端状态 + 对话式工具调用”的原型，重构为“数据驱动 + 读写分离 + 可审计”的 AI 原生项目管理系统。

## ✅ 当前实现状态（2026-01-23）
- SoR 已迁移至 D1（Drizzle + D1）。
- Worker 已实现完整读写 API + Draft/Audit + 观测日志。
- Agent 工具已具备 read + plan/apply。
- 前端已改为 API 驱动，并提供 Draft 审阅入口。
- 约束引擎（依赖/日期）已在草案阶段自动修正。
- 回滚能力已实现（基于审计快照的反向操作）。
- 当前仍保留直写 API（非草案）：`/api/projects` 与 `/api/tasks` 的 POST/PATCH/DELETE 可直接写入（已审计但不经过 Draft）。

## 1. 当前结论摘要（已达成）
- SoR 已迁移到后端（D1/Drizzle），支持多端共享、可审计、可并发协作。
- Agent 已具备 read + plan/apply 工具，避免“盲写”。
- 业务规则下沉至 Worker service 层，可复用与扩展。
- Worker 不再仅做 LLM 转发，已具备业务服务层与约束逻辑。

## 2. 重构核心目标
- **SoR（Single Source of Truth）**：任务与项目数据在后端持久化（D1/SQLite）。
- **读写工具完备**：Agent 可查可改，支持分页、过滤与搜索。
- **审计与草案**：任何 Agent 修改都可追踪、可回滚、可审批。
- **可观测性**：记录每次调用、模型输出、工具执行结果与错误。
- **安全与约束**：输入全量校验、权限控制、依赖冲突自动处理。

## 3. 目标架构（To-Be）
```
UI (React/Vite)
  -> API (Hono/Cloudflare Worker)
     -> D1 Database (Projects, Tasks, Audit, Drafts)
     -> LLM Service (AI)

Agent Tooling
  -> list/get/search (read)
  -> create/update/delete (write)
  -> plan/apply (draft-first)
```

## 4. 分阶段实施（Detailed Plan）

### Phase 0 — 设计与基线确认（1-2 天）
- [x] 统一任务/项目字段定义（WBS、依赖、里程碑、责任人）。
- [x] 定义系统约束：状态流转规则、依赖类型、时间冲突处理策略。
- [x] 设计 API：读写接口与响应格式（`{ success, data, error }`）。
- [x] 设计审计模型：记录“谁、何时、做了什么、差异是什么”。

交付物：
- `docs/refactor-plan.md`（本文件）
- API 草案 & 数据模型草案

### Phase 1 — 读写能力补齐（最小重构，保留前端状态）
目标：让 Agent “能读”，避免盲写。
- [x] 新增 Worker 接口：`GET /api/projects` / `GET /api/tasks`（读 API）。
- [x] 新增 Agent 工具：`listProjects`, `listTasks`, `searchTasks`。
- [x] 前端系统提示改为使用 API 获取数据，而非本地拼 context。
- [x] 增加任务检索策略：分页 + 过滤 + 关键词搜索。

交付物：
- Worker 增强版 read API
- Agent 工具调用支持 read-only

### Phase 2 — 数据下沉（核心重构）
目标：将 SoR 从前端迁移到后端。
- [x] 引入 D1（或 SQLite）与 Drizzle schema。
- [x] 数据迁移：把前端初始数据迁移到 DB。
- [x] 前端改为“纯展示层”，所有 CRUD 走 API。
- [x] 将 `applyTaskAction/applyProjectAction` 移到后端服务逻辑。

交付物：
- `worker/` 中完整的 Task/Project 服务层
- 前端与后端严格契约化接口

### Phase 3 — 草案 + 审批 + 回滚
目标：让 AI 修改变得“可审计、可控”。
- [x] 引入 Draft 模式：
  - Agent 修改先进入 Draft
  - 用户可“审阅差异”再发布
- [x] 引入 Audit Log：
  - 每次变更记录 diff
  - 变更原因、触发者（user/agent/system）
- [x] 支持回滚（基于 diff 逆向操作或版本快照）

交付物：
- Draft/Audit API
- 前端“变更审阅”视图

### Phase 4 — 约束系统与智能规划
目标：Agent 能理解项目约束并进行“计划-执行”。
- [x] 引入约束层：资源限制、依赖类型、最早开始/最晚结束。
- [x] 引入 Plan/Apply 工具：
  - `planChanges` 返回拟执行动作
  - `applyChanges` 真正执行
- [x] 增加风险检测与异常提示（如关键路径冲突）

交付物：
- 约束引擎 MVP
- Agent 规划工作流

## 5. 目标 API 设计（草案）

### 读接口
- `GET /api/projects`
- `GET /api/projects/:id`
- `GET /api/tasks?projectId=&status=&assignee=&q=&page=&pageSize=`
- `GET /api/tasks/:id`

### 写接口
- `POST /api/projects`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

### 草案/审计接口
- `POST /api/drafts`
- `GET /api/drafts/:id`
- `POST /api/drafts/:id/apply`
- `GET /api/audit?projectId=&taskId=`

## 6. 数据模型（草案）

### Project
- id, name, description, icon, createdAt

### Task
- id, projectId, title, description, status, priority
- wbs, startDate, dueDate, completion, assignee
- isMilestone, predecessors, createdAt

### AuditLog
- id, entityType, entityId
- action, before, after, actor, timestamp, reason

### Draft
- id, projectId, actions[], createdAt, createdBy, status

## 7. 风险与注意事项
- 前端逻辑下沉后，UI 需适配 API 的异步与错误处理。
- 迁移期需支持“本地状态 -> DB”的导入或一次性初始化。
- Agent 工具调用需要更加严格的输入校验与错误可解释性。
- 若需要强制 Draft 审批流程，应收紧或禁用直写 API。

## 8. 验收标准
- Agent 通过读工具能完整理解项目现状。
- 所有写操作可追溯、可回滚。
- 前端不再持有核心业务逻辑。
- 具备最小的审计与草案能力。

---

# 细化执行清单（建议开始执行时启用）

## A. 设计阶段细化
- [x] 定义任务状态机（TODO -> IN_PROGRESS -> DONE）以及允许的回退规则
- [x] 明确依赖类型（FS/SS/FF/SF）与处理策略
- [x] 定义任务字段的必填/可选规则与默认值

## B. Worker 侧细化
- [x] `zod` 校验入参与出参
- [x] 分离 service 层（业务规则）与 handler 层（HTTP）
- [x] 对外统一错误格式 `{ success: false, error: { code, message } }`

## C. 前端侧细化
- [x] 替换本地 state CRUD 为 API 调用
- [x] 支持 optimistic UI + 错误回滚
- [x] 对 Draft 提供差异对比视图（基础版）

## D. Agent 侧细化
- [x] Prompt 中加入“优先查询、后执行”的行为准则
- [x] 当任务不明确时，先调用 search，再调用 update
- [x] 增加失败原因与修复建议输出
