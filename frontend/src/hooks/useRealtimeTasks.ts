import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase.ts';
import { apiFetch } from '../lib/api.ts';
import { Task } from '../types.ts';

export function useRealtimeTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const response = await apiFetch('/api/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      setTasks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    const handleLocalChange = () => {
      console.log('Local change detected, refetching...');
      fetchTasks();
    };

    window.addEventListener('tasks-changed', handleLocalChange);

    let channel: RealtimeChannel | undefined;

    try {
      const supabase = getSupabase();
      // Subscribe to changes in 'tasks' table
      channel = supabase
        .channel('tasks-all')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          (payload) => {
            console.log('Change received!', payload);
            fetchTasks();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Supabase not configured for realtime:', err);
    }

    return () => {
      window.removeEventListener('tasks-changed', handleLocalChange);
      if (channel) {
        try {
          getSupabase().removeChannel(channel);
        } catch (_e) { /* ignore cleanup errors */ }
      }
    };
  }, []);

  return { tasks, loading, error, refetch: fetchTasks };
}
