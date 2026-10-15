import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertTriangle, Menu, Shield, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onRefresh, onMenuClick }) => {
  const { user, isAdmin } = useAuth();
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.get('/health');
        if (res.data.status === 'healthy') {
          setDbStatus('connected');
        } else {
          setDbStatus('error');
        }
      } catch (e) {
        setDbStatus('error');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 truncate hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* PostgreSQL 15 Connection Pill */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            dbStatus === 'connected'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : dbStatus === 'checking'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
          title="Direct PostgreSQL 15 Database Dialect"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              dbStatus === 'connected'
                ? 'bg-emerald-500 animate-pulse'
                : dbStatus === 'checking'
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
          />
          <span className="font-mono text-[11px] font-semibold hidden md:inline">PostgreSQL 15</span>
          <span className="text-[11px]">
            {dbStatus === 'connected' ? 'Connected' : dbStatus === 'checking' ? 'Connecting...' : 'Offline'}
          </span>
        </div>

        {/* User Role Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="hidden md:block text-left">
            <span className="text-xs font-semibold text-slate-800 block leading-tight">{user?.username}</span>
            <span className="text-[10px] text-slate-500 font-medium uppercase font-mono">
              {user?.role === 'admin' ? 'Administrator' : 'Viewer'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
