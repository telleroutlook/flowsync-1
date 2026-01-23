export type SeedProject = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
};

export type SeedTask = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  wbs?: string;
  createdAt: number;
  startDate?: number;
  dueDate?: number;
  completion?: number;
  assignee?: string;
  isMilestone?: boolean;
  predecessors?: string[];
};

const day = 86_400_000;
const base = new Date('2026-01-01T00:00:00Z').getTime();
const createDate = (offsetDays: number) => base + offsetDays * day;

export const seedProjects: SeedProject[] = [
  { id: 'p3', name: 'Construction Phase 1', description: 'Main Building Construction WBS', icon: '🏗️' },
  { id: 'p1', name: 'Software Development', description: 'Main SaaS product development', icon: '💻' },
  { id: 'p2', name: 'Marketing Campaign', description: 'Q4 Launch Strategies', icon: '🚀' },
];

export const seedTasks: SeedTask[] = [
  {
    id: 't1',
    projectId: 'p3',
    title: 'Project Initiation',
    wbs: '1',
    status: 'DONE',
    priority: 'HIGH',
    createdAt: base,
    startDate: createDate(0),
    dueDate: createDate(0),
    completion: 100,
    isMilestone: true,
    assignee: 'Owner Unit',
  },
  {
    id: 't1.1',
    projectId: 'p3',
    title: 'Approval & Reporting',
    wbs: '1.1',
    status: 'DONE',
    priority: 'HIGH',
    createdAt: base,
    startDate: createDate(0),
    dueDate: createDate(30),
    completion: 100,
    isMilestone: false,
    assignee: 'Owner Unit',
  },
  {
    id: 't1.2',
    projectId: 'p3',
    title: 'Construction Drawings',
    wbs: '1.2',
    status: 'DONE',
    priority: 'HIGH',
    createdAt: base,
    startDate: createDate(15),
    dueDate: createDate(60),
    completion: 90,
    isMilestone: false,
    assignee: 'Design Institute',
  },
  {
    id: 't2',
    projectId: 'p3',
    title: 'Construction Prep',
    wbs: '2',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    createdAt: base,
    startDate: createDate(30),
    dueDate: createDate(54),
    completion: 80,
    isMilestone: false,
    assignee: 'General Contractor',
  },
  {
    id: 't2.1',
    projectId: 'p3',
    title: 'Site Leveling',
    wbs: '2.1',
    status: 'DONE',
    priority: 'MEDIUM',
    createdAt: base,
    startDate: createDate(30),
    dueDate: createDate(40),
    completion: 100,
    isMilestone: false,
    assignee: 'General Contractor',
  },
  {
    id: 't3',
    projectId: 'p3',
    title: 'Foundation Works',
    wbs: '3',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    createdAt: base,
    startDate: createDate(60),
    dueDate: createDate(121),
    completion: 70,
    isMilestone: false,
    assignee: 'General Contractor',
  },
  {
    id: 't4',
    projectId: 'p3',
    title: 'Main Structure',
    wbs: '4',
    status: 'TODO',
    priority: 'HIGH',
    createdAt: base,
    startDate: createDate(120),
    dueDate: createDate(273),
    completion: 0,
    isMilestone: false,
    assignee: 'General Contractor',
  },
  {
    id: 't4.1',
    projectId: 'p3',
    title: 'Structure Cap',
    wbs: '4.1',
    status: 'TODO',
    priority: 'HIGH',
    createdAt: base,
    startDate: createDate(273),
    dueDate: createDate(273),
    completion: 0,
    isMilestone: true,
    assignee: 'General Contractor',
  },
  {
    id: '1',
    projectId: 'p1',
    title: 'Design System Draft',
    wbs: '1.0',
    status: 'DONE',
    priority: 'HIGH',
    createdAt: base - day * 3,
    startDate: base - day * 3,
    dueDate: base - day,
    completion: 100,
    assignee: 'Design Team',
  },
      {
        id: '2',
        projectId: 'p1',
        title: 'Integrate AI API',
        description: 'Set up the AI integration for chat features.',
        status: 'DONE',
        priority: 'HIGH',
        wbs: '1.2',
        startDate: createDate(-3),
        dueDate: createDate(-1),
        completion: 100,
        assignee: 'Alice',
        createdAt: createDate(-3),
      },
];
