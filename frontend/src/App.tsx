import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Catalogue } from './pages/Catalogue';
import { InwardStock } from './pages/InwardStock';
import { OutwardStock } from './pages/OutwardStock';
import { StockAdjustment } from './pages/StockAdjustment';
import { StockSummary } from './pages/StockSummary';
import { InventoryAnalysis } from './pages/InventoryAnalysis';
import { ExcelImportExport } from './pages/ExcelImportExport';
import { UserManagement } from './pages/UserManagement';

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Operational Inventory Dashboard', subtitle: 'Live warehouse metrics, flow velocity, and stock health overview' },
  catalogue: { title: 'Product & Variant Catalogue', subtitle: 'SKU attributes, dimensional thickness, finishes, and safety reorder thresholds' },
  inward: { title: 'Stock Inward (Receipts)', subtitle: 'Record verified incoming consignments, supplier goods, and lot arrivals' },
  outward: { title: 'Stock Outward (Dispatches)', subtitle: 'Order dispatch fulfillment with real-time negative balance protection' },
  adjustment: { title: 'Stock Adjustment & Audit', subtitle: 'Authorized balance corrections with mandatory regulatory audit justification' },
  summary: { title: 'Stock Summary Report', subtitle: 'Real-time multi-variant inventory balances, inward/outward totals, and threshold health' },
  analysis: { title: 'Inventory Analytics & Reports', subtitle: 'Interactive workspace with period comparison, movement ledger, and reconciliation audit' },
  'import-export': { title: 'Excel Import & Reconciliation', subtitle: 'Automated workbook parsing, mathematical parity reconciliation, and exports' },
  users: { title: 'User & Access Governance', subtitle: 'Enterprise Role-Based Access Control (Administrator vs Viewer privileges)' },
};

const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-600 font-medium">Initializing Enterprise Inventory Engine...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const tabInfo = TAB_TITLES[currentTab] || { title: 'Inventory Management', subtitle: '' };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard setCurrentTab={setCurrentTab} />;
      case 'catalogue':
        return <Catalogue />;
      case 'inward':
        return <InwardStock />;
      case 'outward':
        return <OutwardStock />;
      case 'adjustment':
        return <StockAdjustment />;
      case 'summary':
        return <StockSummary />;
      case 'analysis':
        return <InventoryAnalysis />;
      case 'import-export':
        return <ExcelImportExport />;
      case 'users':
        return <UserManagement />;
      default:
        return <Dashboard setCurrentTab={setCurrentTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={tabInfo.title}
          subtitle={tabInfo.subtitle}
          onMenuClick={() => setIsMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};

export default App;
