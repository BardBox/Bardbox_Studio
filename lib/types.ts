export type PressureLevel = 'overdue' | 'critical' | 'approaching' | 'comfortable' | 'completed';
export type TaskStatus =
  | 'todo' | 'assigned' | 'working_on_it' | 'on_hold'
  | 'submitted' | 'approved' | 'done' | 'blocked'
  | 'adjusted_before' | 'adjusted_after';

export type ConflictResolution = 'pending' | 'before' | 'after' | 'reassign';

export interface LeaveConflictTask {
  id: number;
  leave_request_id: number;
  task_id: number;
  ai_suggestion: 'before' | 'after' | 'reassign' | null;
  ai_reasoning: string | null;
  resolution: ConflictResolution;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  // joined
  task?: PipelineTask;
  assignee_name?: string | null;
}
export type TaskType = 'design' | 'post';
export type TaskPriority = 'low' | 'medium' | 'high' | 'emergency';
export type UserRole = 'designer' | 'smo' | 'manager' | 'admin' | 'ceo' | 'hr' | 'developer';
export type ContentSource = 'sheets' | 'in_app' | 'import';
export type LeaveStatus = 'pending' | 'approved' | 'denied';

export interface PipelineTask {
  task_id: number;
  task_type: TaskType;
  task_status: TaskStatus;
  priority: TaskPriority;
  is_emergency: boolean;
  original_deadline: string | null;
  rescheduled_reason: string | null;
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
  row_is_emergency: boolean;
  assignee_name: string | null;
  assignee_role: string | null;
  assignee_specialty: 'video_editor' | 'graphic_designer' | null;
  smo_id: string | null;
  smo_name: string | null;
  designer_id: string | null;
  designer_name: string | null;
  designer_specialty: 'video_editor' | 'graphic_designer' | null;
  hours_until_deadline: number;
  pressure_level: PressureLevel;
}

export interface TeamMember {
  id: string;
  full_name: string;
  role: UserRole;
  max_concurrent_tasks: number;
  todo_count: number;
  working_on_it_count: number;
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
  avatar_url?: string | null;
  employee_id?: string | null;
  designation?: string | null;
  date_of_joining?: string | null;
  employment_type?: string | null;
  date_of_birth?: string | null;
  emergency_contact?: string | null;
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
  logo_url?: string | null;
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
