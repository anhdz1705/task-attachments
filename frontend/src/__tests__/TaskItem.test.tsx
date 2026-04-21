import React from 'react';
import { render, screen } from '@testing-library/react';
import { TaskItem } from '../components/TaskItem.tsx';
import type { Task } from '../types.ts';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement('div', { className, ...rest }, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../lib/api.ts', () => ({
  apiFetch: vi.fn(),
}));

const baseTask: Task = {
  id: 'task-1',
  title: 'Fix login bug',
  description: null,
  status: 'open',
  attachment_url: null,
  attachment_name: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('TaskItem', () => {
  it('renders the task title', () => {
    render(<TaskItem task={baseTask} />);
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    const task = { ...baseTask, description: 'Steps to reproduce...' };
    render(<TaskItem task={task} />);
    expect(screen.getByText('Steps to reproduce...')).toBeInTheDocument();
  });

  it('does not render description element when description is null', () => {
    render(<TaskItem task={baseTask} />);
    expect(screen.queryByText('Steps to reproduce...')).not.toBeInTheDocument();
  });

  it('renders a status select with the correct current value', () => {
    const task = { ...baseTask, status: 'in_progress' as const };
    render(<TaskItem task={task} />);
    expect(screen.getByRole('combobox')).toHaveValue('in_progress');
  });

  it('shows an attachment link when attachment_url is set', () => {
    const task = {
      ...baseTask,
      attachment_url: 'https://example.com/file.pdf',
      attachment_name: 'report.pdf',
    };
    render(<TaskItem task={task} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com/file.pdf');
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('does not show an attachment link when attachment_url is null', () => {
    render(<TaskItem task={baseTask} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
