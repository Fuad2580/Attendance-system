import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar, TabKey } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { DashboardView } from './components/DashboardView';
import { AttendanceLogView } from './components/AttendanceLogView';
import { RequestsView } from './components/RequestsView';
import { ApprovalsView } from './components/ApprovalsView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { SpreadsheetManagerModal } from './components/SpreadsheetManagerModal';
import { GasSetupModal } from './components/GasSetupModal';
import { RequestType } from './types';
import { Menu, RefreshCw, Bell } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { currentUser, isLiveSyncing, syncFromSpreadsheet, activeZone } = useApp();

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false);
  const [showGasModal, setShowGasModal] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [preselectedRequestType, setPreselectedRequestType] = useState<RequestType | null>(null);

  if (!currentUser) {
    return (
      <>
        <LoginScreen onOpenSpreadsheet={() => setShowSpreadsheetModal(true)} />
        {showSpreadsheetModal && (
          <SpreadsheetManagerModal onClose={() => setShowSpreadsheetModal(false)} />
        )}
      </>
    );
  }

  const handleOpenNewRequest = (type?: RequestType) => {
    if (type) setPreselectedRequestType(type);
    setActiveTab('requests');
  };

  const titles: Record<TabKey, string> = {
    dashboard: 'Dashboard',
    log: 'Attendance Log',
    requests: 'Requests',
    approvals: 'Approvals',
    admin: 'Admin Panel',
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSpreadsheet={() => setShowSpreadsheetModal(true)}
        onOpenGasSetup={() => setShowGasModal(true)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="font-bold text-slate-900 text-base truncate">{titles[activeTab]}</h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3">
              <button
                onClick={() => syncFromSpreadsheet()}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                title="Sinkronkan dari Google Sheets"
              >
                <RefreshCw className={`w-4 h-4 ${isLiveSyncing ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
                <Bell className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 pl-1.5 sm:pl-3 sm:border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                  {currentUser.employeeName.charAt(0)}
                </div>
                <div className="hidden sm:block leading-tight">
                  <p className="text-xs font-semibold text-slate-800">{currentUser.employeeName}</p>
                  <p className="text-[11px] text-slate-400">
                    {currentUser.roleLevel} • {activeZone.code}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              onOpenNewRequest={handleOpenNewRequest}
              onViewAllRequests={() => setActiveTab('requests')}
              onOpenSpreadsheet={() => setShowSpreadsheetModal(true)}
              onOpenGasSetup={() => setShowGasModal(true)}
            />
          )}

          {activeTab === 'log' && <AttendanceLogView />}

          {activeTab === 'requests' && (
            <RequestsView
              initialRequestType={preselectedRequestType}
              onClearInitialRequestType={() => setPreselectedRequestType(null)}
            />
          )}

          {activeTab === 'approvals' && <ApprovalsView />}

          {activeTab === 'admin' && <AdminDashboardView />}
        </main>
      </div>

      {showSpreadsheetModal && (
        <SpreadsheetManagerModal onClose={() => setShowSpreadsheetModal(false)} />
      )}
      {showGasModal && <GasSetupModal onClose={() => setShowGasModal(false)} />}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
