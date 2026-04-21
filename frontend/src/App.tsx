import { useState } from 'react';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import { ChatBox } from './components/ChatBox';
import { Database, AlertTriangle, LayoutDashboard, MessageSquare } from 'lucide-react';

type ActiveMenu = 'dashboard' | 'chat';

export default function App() {
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('dashboard');

  const isConfigured = 
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_ANON_KEY;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-[var(--color-border)] flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-[var(--color-brand)]" />
          <span className="font-extrabold text-[18px] text-[var(--color-brand)] tracking-[-0.5px]">CORE.SYSTEM</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-[#525F7F]">
          <span className="font-semibold">Project Lab 1</span>
          <div className="w-8 h-8 bg-[#DEE2E6] rounded-full"></div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 bg-white border-r border-[var(--color-border)] p-6 hidden md:flex flex-col gap-3">
          <div
            className={`geo-nav-item cursor-pointer flex items-center gap-2 ${activeMenu === 'dashboard' ? 'geo-nav-item-active' : ''}`}
            onClick={() => setActiveMenu('dashboard')}
          >
            <LayoutDashboard className="w-4 h-4" />
            Bảng điều khiển
          </div>
          <div
            className={`geo-nav-item cursor-pointer flex items-center gap-2 ${activeMenu === 'chat' ? 'geo-nav-item-active' : ''}`}
            onClick={() => setActiveMenu('chat')}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          {!isConfigured && (
            <div className="mb-8">
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-none flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-amber-900 font-semibold mb-1 uppercase text-xs tracking-wider">Config Required</h3>
                  <p className="text-amber-700 text-sm">Set credentials in Secrets or .env</p>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4">
                <TaskForm />
              </div>
              <div className="lg:col-span-8">
                <TaskList />
              </div>
            </div>
          )}

          {activeMenu === 'chat' && (
            <div className="h-[calc(100vh-8rem)]">
              <ChatBox />
            </div>
          )}
        </main>
      </div>

      <footer className="h-8 bg-white border-t border-[var(--color-border)] flex items-center justify-center text-[11px] text-[#ADB5BD] uppercase tracking-[1px] shrink-0">
        Hệ thống quản lý doanh nghiệp &copy; 2026 | Phiên bản 1.0.0
      </footer>
    </div>
  );
}

