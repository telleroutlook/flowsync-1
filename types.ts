export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  icon?: string; // Emoji or simple string char
}

export interface Task {
  id: string;
  projectId: string; // Link to project
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  
  // WBS & Scheduling
  wbs?: string; // e.g., "1.1", "2.0"
  createdAt: number;
  startDate?: number; // Planned Start
  dueDate?: number; // Planned Finish / Deadline
  
  // Progress & Responsibility
  completion?: number; // 0 to 100
  assignee?: string; // Responsible Unit / Person
  isMilestone?: boolean; 
  predecessors?: string[]; // IDs or WBS codes of previous tasks
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  isThinking?: boolean;
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

// Gemini Tool Arguments
export interface TaskActionArgs {
  action: 'create' | 'move' | 'delete' | 'update' | 'resolve-dependency-conflicts';
  title?: string;
  description?: string;
  status?: string; 
  priority?: string; 
  id?: string; 
  oldTitle?: string; 
  projectId?: string;
  
  // New Fields
  wbs?: string;
  startDate?: string;
  dueDate?: string;
  completion?: number;
  assignee?: string;
  isMilestone?: boolean;
}

export interface ProjectActionArgs {
  action: 'create' | 'select' | 'delete' | 'update';
  name?: string; // Name of project to create or find
  description?: string;
  oldName?: string; // To find for update/delete/select if fuzzy match needed
}
