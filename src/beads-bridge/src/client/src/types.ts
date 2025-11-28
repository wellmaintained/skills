export type IssueStatus = 'open' | 'in_progress' | 'blocked' | 'closed';

export interface DashboardMetrics {
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  open: number;
}

export interface DashboardLabel {
  id: string;
  name: string;
}

export interface DashboardAssignee {
  id: string;
  login: string;
}

export interface DashboardIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  url: string;
  labels: DashboardLabel[];
  assignees: DashboardAssignee[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export interface DashboardEdge {
  id: string;
  source: string;
  target: string;
}

export interface IssueResponse {
  issueId: string;
  metrics: DashboardMetrics;
  issues: DashboardIssue[];
  edges: DashboardEdge[];
  rootId: string;
  lastUpdate: string;
}

export interface BeadsIssueResponse {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: number;
  issue_type: string;
  labels: string[];
  assignee?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSubtaskPayload {
  title: string;
  type: string;
  priority: number;
  description?: string;
  status?: IssueStatus;
}
