import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { apiFetch } from '../lib/api.ts';

export const TaskForm: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    if (file) formData.append('file', file);

    try {
      const response = await apiFetch('/api/tasks', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setTitle('');
        setDescription('');
        setFile(null);
        // Dispatch custom event for immediate local update
        window.dispatchEvent(new CustomEvent('tasks-changed'));
      }
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="geo-card"
    >
      <h2 className="geo-card-title flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Tạo Việc mới
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] uppercase font-bold text-[var(--color-text-muted)] mb-2 tracking-wider">Tiêu đề</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 bg-[#F6F9FC] border border-[var(--color-border)] focus:border-[var(--color-brand)] outline-none transition-all text-sm"
            placeholder="Nhập tiêu đề công việc..."
            required
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase font-bold text-[var(--color-text-muted)] mb-2 tracking-wider">Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 bg-[#F6F9FC] border border-[var(--color-border)] focus:border-[var(--color-brand)] outline-none transition-all text-sm"
            placeholder="Chi tiết công việc..."
            rows={3}
          />
        </div>

        <div>
           <label className="block text-[11px] uppercase font-bold text-[var(--color-text-muted)] mb-2 tracking-wider">Đính kèm</label>
           <div className="relative group">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="task-file-upload"
              />
              <label 
                htmlFor="task-file-upload"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-dashed border-[var(--color-border)] bg-[#F6F9FC] text-gray-400 text-xs font-bold uppercase tracking-widest cursor-pointer hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-all"
              >
                {file ? file.name : "Chọn file đính kèm..."}
              </label>
           </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="geo-btn-primary w-full flex items-center justify-center gap-2 mt-2"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          LƯU CÔNG VIỆC
        </button>
      </form>
    </motion.div>
  );
};
