CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"actor" text NOT NULL,
	"reason" text,
	"timestamp" bigint NOT NULL,
	"project_id" text,
	"task_id" text,
	"draft_id" text
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"status" text NOT NULL,
	"actions" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	"created_by" text NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "observability_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"wbs" text,
	"created_at" bigint NOT NULL,
	"start_date" bigint,
	"due_date" bigint,
	"completion" bigint,
	"assignee" text,
	"is_milestone" boolean DEFAULT false NOT NULL,
	"predecessors" jsonb,
	"updated_at" bigint NOT NULL
);
