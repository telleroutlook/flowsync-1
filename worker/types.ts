import type { DrizzleDB } from './db';
import type { UserRecord, WorkspaceMembershipRecord, WorkspaceRecord } from './services/types';

export type { DrizzleDB };

export type Variables = {
  db: DrizzleDB;
  user: UserRecord | null;
  workspace: WorkspaceRecord | null;
  workspaceMembership: WorkspaceMembershipRecord | null;
};

export type Bindings = {
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
};
