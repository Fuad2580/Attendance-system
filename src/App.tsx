import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { DashboardView } from './components/DashboardView';
import { RequestsView } from './components/RequestsView';
import { ApprovalsView } from './components/ApprovalsView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { SpreadsheetManagerModal } from './components/SpreadsheetManagerModal';
import { GasSetupModal } from './components/GasSetupModal';
import { RequestType } from './types';

const MainLayout: React.FC = () => {
  const { currentUser } = useApp();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'approvals' | 'admin'>('dashboard');
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false);
  const [showGasModal, setShowGasModal] = useState(false);
  const [preselectedRequestType, setPreselectedRequestType] = useState<RequestType | null>(null);

  // If user not authenticated, show NIK Login Screen
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
    if (type) {
      setPreselectedRequestType(type);
    }
    setActiveTab('requests');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* Responsive Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSpreadsheet={() => setShowSpreadsheetModal(true)}
        onOpenGasSetup={() => setShowGasModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            onOpenNewRequest={handleOpenNewRequest}
            onViewAllRequests={() => setActiveTab('requests')}
            onOpenSpreadsheet={() => setShowSpreadsheetModal(true)}
          />
        )}

        {activeTab === 'requests' && (
          <RequestsView
            initialRequestType={preselectedRequestType}
            onClearInitialRequestType={() => setPreselectedRequestType(null)}
          />
        )}

        {activeTab === 'approvals' && <ApprovalsView />}

        {activeTab === 'admin' && <AdminDashboardView />}
      </main>

      {/* Google Spreadsheet Database Manager Modal */}
      {showSpreadsheetModal && (
        <SpreadsheetManagerModal onClose={() => setShowSpreadsheetModal(false)} />
      )}

      {/* Google Apps Script Deployment Modal */}
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
