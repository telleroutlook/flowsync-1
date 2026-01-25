CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" ("username");
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" ("token_hash");
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" bigint NOT NULL,
	"created_by" text,
	"is_public" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "workspace_members_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "workspace_id" text;
--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "workspace_id" text;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "workspace_id" text;
--> statement-breakpoint
INSERT INTO "workspaces" ("id", "name", "description", "created_at", "created_by", "is_public")
VALUES ('public', 'Public Workspace', 'Default workspace for guests', 0, NULL, true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "projects" SET "workspace_id" = 'public' WHERE "workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "drafts" SET "workspace_id" = 'public' WHERE "workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "audit_logs" SET "workspace_id" = 'public' WHERE "workspace_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "drafts" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "workspace_id" SET NOT NULL;
