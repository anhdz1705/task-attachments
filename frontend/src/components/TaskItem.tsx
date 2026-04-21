import React, { useState } from 'react';
import { Task, TaskStatus } from '../types.ts';
import { CheckCircle2, Circle, Clock, Paperclip, ExternalLink, Loader2, Upload, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { apiFetch } from '../lib/api.ts';

interface TaskItemProps {
  task: Task;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleStatusChange = async (newStatus: TaskStatus) => {
    setIsUpdating(true);
    try {
      await apiFetch(`/api/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      window.dispatchEvent(new CustomEvent('tasks-changed'));
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiFetch(`/api/tasks/${task.id}/attachment`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      window.dispatchEvent(new CustomEvent('tasks-changed'));
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Upload failed. Check console for details.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async () => {
    // Note: window.confirm might not work in all iframe environments
    setIsDeleting(true);
    try {
      const response = await apiFetch(`/api/tasks/${task.id}/attachment`, {
        method: 'DELETE',
      });
      if (response.ok) {
        window.dispatchEvent(new CustomEvent('tasks-changed'));
      }
    } catch (error: unknown) {
      console.error('Error deleting attachment:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusIcon = () => {
    if (isUpdating) return <Loader2 className="w-4 h-4 animate-spin text-[var(--color-brand)]" />;
    switch (task.status) {
      case 'done': return <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-[var(--color-warning)]" />;
      default: return <Circle className="w-4 h-4 text-gray-300" />;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="geo-card !p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-1">{getStatusIcon()}</div>
          <div>
            <h3 className={`text-sm font-bold ${task.status === 'done' ? 'line-through text-gray-400' : 'text-[#32325D]'}`}>
              {task.title}
            </h3>
            {task.description && (
              <p className="text-[13px] text-[#525F7F] mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            disabled={isUpdating}
            className="text-[10px] uppercase font-bold px-2 py-1 rounded-none border border-[var(--color-border)] bg-[#F6F9FC] outline-none focus:border-[var(--color-brand)] text-[#525F7F]"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F6F9FC]">
        <div className="flex items-center gap-3">
          {task.attachment_url ? (
            <div className="flex items-center gap-2">
              <a
                href={task.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-brand)] hover:opacity-80 transition-opacity uppercase tracking-wider"
              >
                <Paperclip className="w-3 h-3" />
                <span className="max-w-[100px] truncate">{task.attachment_name}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <button
                onClick={handleDeleteAttachment}
                disabled={isDeleting}
                className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-30"
                title="Xoá đính kèm"
              >
                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-gray-300 flex items-center gap-1.5 uppercase font-bold tracking-wider">
              <Paperclip className="w-3 h-3" />
              Trống
            </span>
          )}
        </div>

        <label className={`cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${isUploading ? 'text-gray-300' : 'text-[#525F7F] hover:text-[var(--color-brand)]'} transition-colors`}>
          {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {isUploading ? 'ĐANG TẢI...' : 'ĐÍNH KÈM'}
          <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
        </label>
      </div>

      <div className="text-[9px] text-[#ADB5BD] flex justify-end mt-1 uppercase font-bold tracking-tight">
        {new Date(task.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </motion.div>
  );
};
