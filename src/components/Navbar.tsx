import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Store,
  User,
  Shield,
  Table,
  Code2,
  LogOut,
  ChevronDown,
  Navigation,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { RoleLevel } from '../types';

interface NavbarProps {
  onOpenSpreadsheet: () => void;
  onOpenGasSetup: () => void;
  activeTab?: 'dashboard' | 'requests' | 'approvals' | 'admin';
  onTabChange?: (tab: 'dashboard' | 'requests' | 'approvals' | 'admin') => void;
  currentTab?: 'dashboard' | 'requests' | 'approvals' | 'admin';
  setCurrentTab?: (tab: 'dashboard' | 'requests' | 'approvals' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSpreadsheet,
  onOpenGasSetup,
  activeTab,
  onTabChange,
  currentTab: propCurrentTab,
  setCurrentTab: propSetCurrentTab,
}) => {
  const currentTab = activeTab || propCurrentTab || 'dashboard';
  const setCurrentTab = onTabChange || propSetCurrentTab || (() => {});
  const { currentUser, logout, switchUser, manpower, requests, approvals, spreadsheetUrl } = useApp();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  if (!currentUser) return null;

  const roleColors: Record<RoleLevel, string> = {
    R1: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    R2: 'bg-blue-50 text-blue-700 border-blue-200',
    R3: 'bg-purple-50 text-purple-700 border-purple-200',
    ADMIN: 'bg-amber-50 text-amber-800 border-amber-200',
  };

  const roleLabels: Record<RoleLevel, string> = {
    R1: 'R1 • Staff',
    R2: 'R2 • Supervisor',
    R3: 'R3 • Manager',
    ADMIN: 'ADMIN',
  };

  // Count pending approvals for supervisor/admin
  const pendingApprovalsCount = approvals.filter((a) => a.action === 'APPROVE').length; // or filter pending requests
  const myPendingApprovals = requests.filter((r) => {
    if (r.status !== 'PENDING APPROVAL') return false;
    if (currentUser.roleLevel === 'ADMIN') return true;
    if (currentUser.roleLevel === 'R3') return true;
    if (currentUser.roleLevel === 'R2') return r.currentApproverNik === currentUser.nik;
    return false;
  }).length;

  const canViewApprovals = currentUser.roleLevel !== 'R1';
  const canViewAdmin = currentUser.roleLevel === 'R3' || currentUser.roleLevel === 'ADMIN';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Logo & Brand */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setCurrentTab('dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 to-indigo-900 flex items-center justify-center text-white shadow-xs">
            <Store className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-base tracking-tight">RetailAbsen</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                Sheets DB
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">Retail Attendance Management System</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* External Google Spreadsheet Link */}
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-300/80 shadow-2xs"
            title="Buka Google Spreadsheet di tab baru"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Buka</span>
            <span>Sheet</span>
          </a>

          {/* Quick Database & Script Buttons */}
          <button
            onClick={onOpenSpreadsheet}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200/80"
            title="Open Google Spreadsheet Database Inspector"
          >
            <Table className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden md:inline">Spreadsheet</span> DB
          </button>

          <button
            onClick={onOpenGasSetup}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
            title="Google Apps Script Backend Code & Setup"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">GAS Code</span>
          </button>

          {/* User Profile & Switcher Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 text-left rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
                {currentUser.employeeName.charAt(0)}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold text-slate-900 leading-tight flex items-center gap-1">
                  <span>{currentUser.employeeName}</span>
                </div>
                <div className="text-[10px] text-slate-500 leading-none">
                  NIK: {currentUser.nik}
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                  roleColors[currentUser.roleLevel]
                }`}
              >
                {currentUser.roleLevel}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown switch accounts */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-900">{currentUser.employeeName}</p>
                  <p className="text-[11px] text-slate-500">
                    {currentUser.position} • {currentUser.department}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="font-mono bg-slate-100 px-1 rounded">NIK: {currentUser.nik}</span>
                    <span>•</span>
                    <span>Homebase: {currentUser.homebaseLocationId}</span>
                  </div>
                  {currentUser.flexibleAttendance && (
                    <div className="mt-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block font-medium">
                      Flexible / Remote Attendance Allowed
                    </div>
                  )}
                </div>

                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Switch Role / Demo Persona
                </div>
                <div className="max-h-52 overflow-y-auto px-1">
                  {manpower.map((m) => (
                    <button
                      key={m.nik}
                      onClick={() => {
                        switchUser(m.nik);
                        setShowUserDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        m.nik === currentUser.nik
                          ? 'bg-slate-100 font-semibold text-slate-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="truncate">
                        <div className="truncate">{m.employeeName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          NIK {m.nik} • {m.position}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          roleColors[m.roleLevel]
                        }`}
                      >
                        {m.roleLevel}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pt-2 mt-1 border-t border-slate-100 px-2">
                  <button
                    onClick={() => {
                      logout();
                      setShowUserDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out NIK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile-First Navigation Tabs */}
      <div className="max-w-5xl mx-auto px-4 flex items-center space-x-1 overflow-x-auto no-scrollbar border-t border-slate-100 bg-slate-50/70">
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`py-2 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            currentTab === 'dashboard'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Attendance Dashboard
        </button>

        <button
          onClick={() => setCurrentTab('requests')}
          className={`py-2 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
            currentTab === 'requests'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>My Requests</span>
        </button>

        {canViewApprovals && (
          <button
            onClick={() => setCurrentTab('approvals')}
            className={`py-2 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
              currentTab === 'approvals'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Team Approvals</span>
            {myPendingApprovals > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                {myPendingApprovals}
              </span>
            )}
          </button>
        )}

        {canViewAdmin && (
          <button
            onClick={() => setCurrentTab('admin')}
            className={`py-2 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
              currentTab === 'admin'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3 h-3 text-amber-600" />
            <span>Management & Admin</span>
          </button>
        )}
      </div>
    </header>
  );
};
