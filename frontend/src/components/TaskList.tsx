import React from 'react';
import { useRealtimeTasks } from '../hooks/useRealtimeTasks.ts';
import { TaskItem } from './TaskItem.tsx';
import { AnimatePresence } from 'motion/react';
import { ListTodo, Loader2, AlertCircle } from 'lucide-react';

export const TaskList: React.FC = () => {
  const { tasks, loading, error } = useRealtimeTasks();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin mb-2" />
        <p className="font-medium">Loading tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 p-6 rounded-2xl flex flex-col items-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-red-900 font-semibold mb-1">Failed to load tasks</h3>
        <p className="text-red-700 text-sm mb-4">{error}</p>
        <p className="text-xs text-red-600">Please check your Supabase configuration in .env</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="geo-card-title !mb-0 flex items-center gap-2">
          <ListTodo className="w-4 h-4" />
          DANH SÁCH - CÔNG VIỆC ({tasks.length})
        </h2>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-20 bg-white border border-[var(--color-border)] border-dashed">
          <p className="text-[13px] text-gray-400 font-bold uppercase tracking-widest">Không có dữ liệu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
