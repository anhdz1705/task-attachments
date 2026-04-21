export type TaskStatus = 'open' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
}

export interface UpdateTaskStatusDto {
  status: TaskStatus;
}
