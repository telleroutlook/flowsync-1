# [ARCHIVED] FlowSync Refactoring Plan (AI Agent-Oriented Project Management System)

> **Status**: Completed. The system has been refactored to a data-driven backend architecture. Initially implemented on Cloudflare Workers/D1, it has subsequently been migrated to Node.js/PostgreSQL on SAP BTP.

> Goal: Refactor the current "frontend state + conversational tool calling" prototype into a "data-driven + read-write separated + auditable" AI-native project management system.

## ✅ Current Implementation Status (2026-01-23)
- SoR migrated to D1 (Drizzle + D1).
- Worker implements full read/write API + Draft/Audit + Observability Logs.
- Agent tools have read + plan/apply capabilities.
- Frontend converted to API-driven, providing Draft review entry.
- Constraint engine (dependencies/dates) automatically corrects during draft stage.
- Rollback capability implemented (reverse operation based on audit snapshots).
- Direct write APIs (non-draft) are still retained: `/api/projects` and `/api/tasks` POST/PATCH/DELETE can write directly (audited but not drafted).

## 1. Summary of Current Conclusions (Achieved)
- SoR migrated to backend (D1/Drizzle), supporting multi-client sharing, auditability, and concurrent collaboration.
- Agent has read + plan/apply tools, avoiding "blind writing".
- Business rules pushed down to Worker service layer, reusable and extensible.
- Worker is no longer just an LLM forwarder, but has a business service layer and constraint logic.

## 2. Core Refactoring Goals
- **SoR (Single Source of Truth)**: Task and project data persisted in backend (D1/SQLite).
- **Complete Read/Write Tools**: Agent can query and modify, supporting pagination, filtering, and search.
- **Audit & Draft**: Any Agent modification is traceable, rollback-able, and approvable.
- **Observability**: Record every call, model output, tool execution result, and error.
- **Security & Constraints**: Full input validation, permission control, automatic dependency conflict handling.

## 3. Target Architecture (To-Be)
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

## 4. Phased Implementation (Detailed Plan)

### Phase 0 — Design & Baseline Confirmation (1-2 Days)
- [x] Unify task/project field definitions (WBS, dependencies, milestones, assignees).
- [x] Define system constraints: status transition rules, dependency types, time conflict handling strategies.
- [x] Design API: Read/write interfaces and response format (`{ success, data, error }`).
- [x] Design audit model: Record "who, when, what, what diff".

Deliverables:
- `docs/refactor-plan.md` (this file)
- API Draft & Data Model Draft

### Phase 1 — Read/Write Capability Completion (Minimal Refactor, Retain Frontend State)
Goal: Enable Agent "read" capability, avoiding blind writing.
- [x] New Worker Interfaces: `GET /api/projects` / `GET /api/tasks` (Read API).
- [x] New Agent Tools: `listProjects`, `listTasks`, `searchTasks`.
- [x] Frontend system prompt changed to use API for data fetching instead of local context.
- [x] Add task retrieval strategies: Pagination + Filtering + Keyword Search.

Deliverables:
- Worker Enhanced Read API
- Agent Tool Calling supports Read-Only

### Phase 2 — Data Push Down (Core Refactor)
Goal: Migrate SoR from frontend to backend.
- [x] Introduce D1 (or SQLite) and Drizzle schema.
- [x] Data Migration: Migrate frontend initial data to DB.
- [x] Frontend changed to "Pure Display Layer", all CRUD goes through API.
- [x] Move `applyTaskAction/applyProjectAction` to backend service logic.

Deliverables:
- Complete Task/Project Service Layer in `worker/`
- Strict Contractual Interface between Frontend and Backend

### Phase 3 — Draft + Approval + Rollback
Goal: Make AI modifications "auditable and controllable".
- [x] Introduce Draft Mode:
  - Agent modifications enter Draft first
  - User can "review diffs" before publishing
- [x] Introduce Audit Log:
  - Record diff for every change
  - Change reason, trigger (user/agent/system)
- [x] Support Rollback (Reverse operation based on diff or version snapshot)

Deliverables:
- Draft/Audit API
- Frontend "Change Review" View

### Phase 4 — Constraint System & Intelligent Planning
Goal: Agent understands project constraints and performs "Plan-Execute".
- [x] Introduce Constraint Layer: Resource limits, dependency types, earliest start/latest finish.
- [x] Introduce Plan/Apply Tools:
  - `planChanges` returns proposed actions
  - `applyChanges` executes actions
- [x] Add risk detection and exception prompts (e.g., critical path conflicts)

Deliverables:
- Constraint Engine MVP
- Agent Planning Workflow

## 5. Target API Design (Draft)

### Read Interfaces
- `GET /api/projects`
- `GET /api/projects/:id`
- `GET /api/tasks?projectId=&status=&assignee=&q=&page=&pageSize=`
- `GET /api/tasks/:id`

### Write Interfaces
- `POST /api/projects`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

### Draft/Audit Interfaces
- `POST /api/drafts`
- `GET /api/drafts/:id`
- `POST /api/drafts/:id/apply`
- `GET /api/audit?projectId=&taskId=`

## 6. Data Model (Draft)

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

## 7. Risks & Considerations
- After pushing down frontend logic, UI needs to adapt to API async and error handling.
- Migration period needs to support "Local State -> DB" import or one-time initialization.
- Agent tool calling requires stricter input validation and error explainability.
- If mandatory Draft approval process is needed, direct write APIs should be tightened or disabled.

## 8. Acceptance Criteria
- Agent can fully understand project status through read tools.
- All write operations are traceable and rollback-able.
- Frontend no longer holds core business logic.
- Minimal audit and draft capabilities available.

---

# Detailed Execution List (Enable when starting execution)

## A. Design Phase Refinement
- [x] Define task state machine (TODO -> IN_PROGRESS -> DONE) and allowed rollback rules
- [x] Clarify dependency types (FS/SS/FF/SF) and handling strategies
- [x] Define task field mandatory/optional rules and default values

## B. Worker Side Refinement
- [x] `zod` validation for input and output
- [x] Separate service layer (business rules) and handler layer (HTTP)
- [x] Unify external error format `{ success: false, error: { code, message } }`

## C. Frontend Side Refinement
- [x] Replace local state CRUD with API calls
- [x] Support optimistic UI + Error Rollback
- [x] Provide diff comparison view for Draft (Basic Version)

## D. Agent Side Refinement
- [x] Add "Query first, then execute" behavioral guideline in Prompt
- [x] Call search first when task is unclear, then update
- [x] Add failure reason and repair suggestion output
