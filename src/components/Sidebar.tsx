import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  CheckSquare,
  Settings2,
  Database,
  Code2,
  LogOut,
  X,
} from 'lucide-react';

export type TabKey = 'dashboard' | 'log' | 'requests' | 'approvals' | 'admin';

interface SidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onOpenSpreadsheet: () => void;
  onOpenGasSetup: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenSpreadsheet,
  onOpenGasSetup,
  mobileOpen,
  onCloseMobile,
}) => {
  const { currentUser, logout } = useApp();
  if (!currentUser) return null;

  const isSupervisor = currentUser.roleLevel !== 'R1';
  const isAdmin = currentUser.roleLevel === 'ADMIN' || currentUser.roleLevel === 'R3';

  const items: { key: TabKey; label: string; icon: React.ReactNode; show: boolean }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, show: true },
    { key: 'log', label: 'Attendance Log', icon: <ClipboardList className="w-4 h-4" />, show: true },
    { key: 'requests', label: 'Requests', icon: <FileText className="w-4 h-4" />, show: true },
    { key: 'approvals', label: 'Approvals', icon: <CheckSquare className="w-4 h-4" />, show: isSupervisor },
    { key: 'admin', label: 'Admin Panel', icon: <Settings2 className="w-4 h-4" />, show: isAdmin },
  ];

  const nav = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
            SZ
          </div>
          <span className="font-bold text-slate-900 text-sm">Absensi</span>
        </div>
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {items
          .filter((i) => i.show)
          .map((item) => (
            <button
              key={item.key}
              onClick={() => {
                onTabChange(item.key);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === item.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
      </nav>

      <div className="px-3 pb-4 space-y-1 border-t border-slate-100 pt-3">
        <button
          onClick={onOpenSpreadsheet}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Database className="w-4 h-4" />
          <span>Spreadsheet</span>
        </button>
        <button
          onClick={onOpenGasSetup}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Code2 className="w-4 h-4" />
          <span>GAS Code</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-slate-900/40" onClick={onCloseMobile} />
          <aside className="relative w-64 bg-white h-full shadow-xl">{nav}</aside>
        </div>
      )}
    </>
  );
};
