import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskForm } from '../components/TaskForm.tsx';

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

import { apiFetch } from '../lib/api.ts';
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TaskForm', () => {
  it('renders the title input', () => {
    render(<TaskForm />);
    expect(screen.getByPlaceholderText(/tiêu đề/i)).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<TaskForm />);
    expect(screen.getByRole('button', { name: /lưu công việc/i })).toBeInTheDocument();
  });

  it('does not call apiFetch when submitted with empty title', async () => {
    render(<TaskForm />);
    fireEvent.submit(screen.getByRole('button', { name: /lưu công việc/i }).closest('form')!);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('calls apiFetch with POST when title is provided', async () => {
    mockApiFetch.mockResolvedValue({ ok: true });

    render(<TaskForm />);
    await userEvent.type(screen.getByPlaceholderText(/tiêu đề/i), 'My new task');
    fireEvent.submit(screen.getByPlaceholderText(/tiêu đề/i).closest('form')!);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/tasks',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
