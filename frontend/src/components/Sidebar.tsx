import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  TableProperties,
  BarChart3,
  FileSpreadsheet,
  Users,
  LogOut,
  Shield,
  Layers,
  X,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { user, isAdmin, logout } = useAuth();

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'catalogue', name: 'Product Catalogue', icon: Boxes },
    { id: 'inward', name: 'Stock Inward', icon: ArrowDownToLine, adminOnly: true, badge: 'Inflow' },
    { id: 'outward', name: 'Stock Outward', icon: ArrowUpFromLine, adminOnly: true, badge: 'Outflow' },
    { id: 'adjustment', name: 'Stock Adjustment', icon: SlidersHorizontal, adminOnly: true },
    { id: 'summary', name: 'Stock Summary', icon: TableProperties },
    { id: 'analysis', name: 'Inventory Analysis', icon: BarChart3 },
    { id: 'import-export', name: 'Excel Import / Export', icon: FileSpreadsheet },
    { id: 'users', name: 'User Management', icon: Users, adminOnly: true },
  ];

  const handleNavClick = (id: string) => {
    setCurrentTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="h-18 px-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md shadow-indigo-950/60 ring-1 ring-white/10">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white tracking-tight leading-tight flex items-center gap-2 text-base">
                StockMatrix
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  ERP
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Atlantic Polymers Unit-II</p>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <div className="p-3 space-y-1 overflow-y-auto">
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Core Modules
          </div>

          {navigation.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            const isRestricted = item.adminOnly && !isAdmin;

            if (isRestricted) return null;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40 translate-x-0.5'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && !active && (
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* User Session Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/30">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-800 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              {isAdmin ? (
                <Shield className="w-4 h-4 text-indigo-400" />
              ) : (
                <UserCheck className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.username || 'Operator'}</p>
              <p className="text-[10px] text-slate-400 font-mono capitalize">
                Role: {user?.role || 'Viewer'}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[10px] text-slate-400 text-center font-mono">
          PostgreSQL 15 • SQLAlchemy 2.0
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[#0B0F19] border-r border-slate-800/80 flex-col shrink-0 h-screen sticky top-0 z-20">
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0B0F19] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
