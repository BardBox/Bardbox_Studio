export type PressureLevel = 'overdue' | 'critical' | 'approaching' | 'comfortable' | 'completed';
export type TaskStatus = 'todo' | 'in_progress' | 'submitted' | 'approved' | 'done' | 'blocked';
export type TaskType = 'design' | 'post';
export type UserRole = 'designer' | 'smo' | 'manager' | 'admin' | 'ceo' | 'hr' | 'developer';
export type ContentSource = 'sheets' | 'in_app' | 'import';
export type LeaveStatus = 'pending' | 'approved' | 'denied';

export interface PipelineTask {
  task_id: number;
  task_type: TaskType;
  task_status: TaskStatus;
  internal_deadline: string;
  assignee_id: string;
  manually_assigned: boolean;
  completed_at: string | null;
  design_url: string | null;
  rejection_notes: string | null;
  content_row_id: number;
  client_name: string | null;
  platform: string;
  content_type: string;
  brief: string | null;
  caption: string | null;
  posting_date: string;
  posting_time: string;
  row_status: string;
  assignee_name: string | null;
  assignee_role: string | null;
  hours_until_deadline: number;
  pressure_level: PressureLevel;
}

export interface TeamMember {
  id: string;
  full_name: string;
  role: UserRole;
  max_concurrent_tasks: number;
  todo_count: number;
  in_progress_count: number;
  submitted_count: number;
  blocked_count: number;
  overdue_count: number;
  critical_count: number;
  completed_this_week: number;
  active_total: number;
}

export interface PipelineSummary {
  overdue: number;
  critical: number;
  approaching: number;
  comfortable: number;
  blocked: number;
  completed_this_week: number;
  posts_next_7_days: number;
  posts_due_today: number;
}

export interface ThroughputRow {
  week_start: string;
  role: string;
  completed: number;
}

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  max_concurrent_tasks: number;
  whatsapp_number?: string | null;
  email?: string | null;
  is_active?: boolean;
}

export interface LeaveRequest {
  id: number;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  // joined
  full_name?: string;
  role?: UserRole;
}

export interface TeamAvailability {
  user_id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  leave_id: number | null;
  start_date: string | null;
  end_date: string | null;
  reason: string | null;
  leave_status: LeaveStatus | null;
  is_on_leave_today: boolean;
}

export interface ClientHealth {
  client_name: string | null;
  total_tasks: number;
  done: number;
  in_flight: number;
  pending_review: number;
  overdue: number;
  completion_pct: number | null;
}

export type TaskRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TaskRequest {
  id: number;
  requested_by: string;
  client_name: string;
  platform: string;
  content_type: string;
  posting_date: string;
  caption: string | null;
  notes: string | null;
  status: TaskRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  task_id: number | null;
  created_at: string;
  // joined
  requester_name?: string;
  requester_role?: UserRole;
}

export interface Client {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface ContentRow {
  id: number;
  sheet_row_id: string | null;
  client_name: string | null;
  platform: string;
  content_type: string;
  brief: string | null;
  caption: string | null;
  hashtags: string | null;
  reference_urls: string[];
  posting_date: string;
  posting_time: string;
  status: string;
  source: ContentSource;
  created_by: string | null;
  created_at: string;
}
