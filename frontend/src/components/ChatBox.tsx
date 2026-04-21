import React, { useState, useEffect, useRef } from 'react';
import { getSupabase } from '../lib/supabase.ts';
import { Send, MessageSquare } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface BroadcastMessage {
  id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export const ChatBox: React.FC = () => {
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userName, setUserName] = useState<string>(localStorage.getItem('chat-nickname') || '');
  const [isSettingName, setIsSettingName] = useState(!localStorage.getItem('chat-nickname'));
  const [tempName, setTempName] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userName) return;

    const supabase = getSupabase();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel('chat:public', {
      config: { presence: { key: userName } },
    });

    channel
      .on('broadcast', { event: 'message' }, ({ payload }: { payload: BroadcastMessage }) => {
        setMessages(prev => [...prev, payload]);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ online_at: string }>();
        setOnlineUsers(Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userName]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userName || !channelRef.current) return;

    const msg: BroadcastMessage = {
      id: crypto.randomUUID(),
      user_name: userName,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
    };

    setNewMessage('');
    setMessages(prev => [...prev, msg]);

    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: msg,
    });
  };

  const handleSetName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      const name = tempName.trim();
      setUserName(name);
      localStorage.setItem('chat-nickname', name);
      setIsSettingName(false);
    }
  };

  return (
    <div className="w-full bg-white border border-[var(--color-border)] flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-[var(--color-border)] bg-[#F8F9FA] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--color-brand)]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#32325D]">Phòng Chat Chung</span>
          </div>
          {userName && (
            <button
              onClick={() => setIsSettingName(true)}
              className="text-[10px] text-gray-400 hover:text-[var(--color-brand)] font-bold uppercase"
            >
              Đổi tên
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 bg-green-50 rounded-full border border-green-100">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-bold text-green-700 uppercase tracking-tighter">{onlineUsers.length} Online</span>
          </div>
          {onlineUsers.slice(0, 5).map((user, idx) => (
            <span key={idx} className="text-[9px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded italic">
              {user === userName ? 'Ban' : user}
            </span>
          ))}
          {onlineUsers.length > 5 && <span className="text-[9px] text-gray-300">+{onlineUsers.length - 5}</span>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="text-center text-[11px] text-gray-300 uppercase tracking-widest py-8">Chua co tin nhan</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.user_name === userName ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-bold text-gray-400 tracking-tight uppercase">{msg.user_name}</span>
              <span className="text-[9px] text-gray-300">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className={`max-w-[60%] px-3 py-2 text-sm ${
              msg.user_name === userName
                ? 'bg-[var(--color-brand)] text-white'
                : 'bg-[#F6F9FC] text-[#525F7F] border border-[var(--color-border)]'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-[var(--color-border)] bg-gray-50">
        {isSettingName ? (
          <form onSubmit={handleSetName} className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-gray-400 text-center tracking-widest">Nhap ten de bat dau chat</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Biet danh..."
                className="flex-1 px-3 py-2 text-xs border border-[var(--color-border)] focus:border-[var(--color-brand)] outline-none"
                required
              />
              <button type="submit" className="geo-btn-primary !px-3">OK</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Nhap noi dung..."
              className="flex-1 px-3 py-2 text-xs border border-[var(--color-border)] focus:border-[var(--color-brand)] outline-none"
            />
            <button type="submit" className="geo-btn-primary !p-2">
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
