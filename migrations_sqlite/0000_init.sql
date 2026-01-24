CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`before` text,
	`after` text,
	`actor` text NOT NULL,
	`reason` text,
	`timestamp` integer NOT NULL,
	`project_id` text,
	`task_id` text,
	`draft_id` text
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`status` text NOT NULL,
	`actions` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`reason` text
);
--> statement-breakpoint
CREATE TABLE `observability_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`wbs` text,
	`created_at` integer NOT NULL,
	`start_date` integer,
	`due_date` integer,
	`completion` integer,
	`assignee` text,
	`is_milestone` integer DEFAULT 0 NOT NULL,
	`predecessors` text,
	`updated_at` integer NOT NULL
);
