import React, { useState, useEffect } from 'react';
import {
  Boxes,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  PackageX,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  FileSpreadsheet,
  Download,
  Layers,
  ChevronRight,
  RefreshCw,
  BarChart3,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import api from '../api/client';
import { DashboardData } from '../types';
import { useAuth } from '../context/AuthContext';

interface DashboardProps {
  setCurrentTab: (tab: string) => void;
}

const CATEGORY_COLORS = ['#4F46E5', '#2563EB', '#0D9488', '#7C3AED', '#D97706', '#E11D48'];

export const Dashboard: React.FC<DashboardProps> = ({ setCurrentTab }) => {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/analysis/dashboard');
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleExport = async (type: string, format: string) => {
    try {
      const res = await api.get(`/analysis/export?report_type=${type}&export_format=${format}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Inventory_${type}_${new Date().toISOString().slice(0, 10)}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to download report export.');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Aggregating live PostgreSQL inventory metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-base">Unable to load inventory metrics</h3>
          </div>
          <p className="text-sm mt-1 text-rose-700">{error}</p>
          <button
            onClick={fetchDashboard}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { kpis, stock_by_category, top_skus, inward_vs_outward_time } = data;

  return (
    <div className="space-y-6">
      {/* Welcome Banner & Quick Action Buttons */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Warehouse Operations Overview
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time physical stock balances, cumulative movements, and automated safety stock monitoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <>
              <button
                onClick={() => setCurrentTab('inward')}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>Stock Inward</span>
              </button>
              <button
                onClick={() => setCurrentTab('outward')}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <ArrowUpFromLine className="w-4 h-4" />
                <span>Stock Outward</span>
              </button>
              <button
                onClick={() => setCurrentTab('adjustment')}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Adjustment</span>
              </button>
            </>
          )}

          <button
            onClick={() => handleExport('stock_summary', 'xlsx')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export XLSX</span>
          </button>
        </div>
      </div>

      {/* 6 Metric Cards Grid with Distinct Full Color Systems */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Active SKUs — Indigo */}
        <div
          onClick={() => setCurrentTab('catalogue')}
          className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-indigo-500/40 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-100">Active SKUs</span>
              <div className="w-9 h-9 rounded-xl bg-white/20 text-white backdrop-blur-xs flex items-center justify-center group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
              {kpis.active_skus}
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/20 flex items-center justify-between text-[11px] text-indigo-100">
            <span>Catalogue Total</span>
            <span className="text-white font-semibold flex items-center group-hover:translate-x-0.5 transition-transform">
              View <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* 2. Total Stock Units — Blue */}
        <div
          onClick={() => setCurrentTab('summary')}
          className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-blue-500/40 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Total Stock</span>
              <div className="w-9 h-9 rounded-xl bg-white/20 text-white backdrop-blur-xs flex items-center justify-center group-hover:scale-105 transition-transform">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                {Math.round(kpis.total_stock_quantity).toLocaleString()}
              </p>
              <span className="text-xs font-semibold text-blue-100">{kpis.primary_unit}</span>
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/20 flex items-center justify-between text-[11px] text-blue-100">
            <span>Physical Balance</span>
            <span className="text-white font-semibold flex items-center group-hover:translate-x-0.5 transition-transform">
              Summary <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* 3. Inward Received — Teal */}
        <div
          onClick={() => setCurrentTab('inward')}
          className="bg-gradient-to-br from-teal-600 to-teal-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-teal-500/40 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-100">Total Inward</span>
              <div className="w-9 h-9 rounded-xl bg-white/20 text-white backdrop-blur-xs flex items-center justify-center group-hover:scale-105 transition-transform">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                {Math.round(kpis.total_inward).toLocaleString()}
              </p>
              <span className="text-xs font-semibold text-teal-100">{kpis.primary_unit}</span>
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/20 flex items-center justify-between text-[11px] text-teal-100">
            <span>Inflow Cumulative</span>
            <span className="text-white font-semibold flex items-center group-hover:translate-x-0.5 transition-transform">
              Receipts <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* 4. Outward Dispatched — Purple */}
        <div
          onClick={() => setCurrentTab('outward')}
          className="bg-gradient-to-br from-purple-600 to-purple-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-purple-500/40 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-100">Total Outward</span>
              <div className="w-9 h-9 rounded-xl bg-white/20 text-white backdrop-blur-xs flex items-center justify-center group-hover:scale-105 transition-transform">
                <ArrowUpFromLine className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                {Math.round(kpis.total_outward).toLocaleString()}
              </p>
              <span className="text-xs font-semibold text-purple-100">{kpis.primary_unit}</span>
            </div>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/20 flex items-center justify-between text-[11px] text-purple-100">
            <span>Outflow Fulfillments</span>
            <span className="text-white font-semibold flex items-center group-hover:translate-x-0.5 transition-transform">
              Dispatches <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* 5. Low-Stock Alert — Amber */}
        <div
          onClick={() => setCurrentTab('analysis')}
          className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-amber-400/40 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-100">Low Stock</span>
              <div className="w-9 h-9 rounded-xl bg-white/20 text-white backdrop-blur-xs flex items-center justify-center group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
              {kpis.low_stock_count}
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/20 flex items-center justify-between text-[11px] text-amber-100">
            <span>At / Below Reorder</span>
            <span className="text-white font-semibold flex items-center group-hover:translate-x-0.5 transition-transform">
              Alerts <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* 6. Out-of-Stock Alert — Rose */}
        <div
          onClick={() => setCurrentTab('analysis')}
          className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-rose-500/40 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-100">Out of Stock</span>
              <div className="w-9 h-9 rounded-xl bg-white/20 text-white backdrop-blur-xs flex items-center justify-center group-hover:scale-105 transition-transform">
                <PackageX className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
              {kpis.out_of_stock_count}
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-white/20 flex items-center justify-between text-[11px] text-rose-100">
            <span>Zero / Negative Qty</span>
            <span className="text-white font-semibold flex items-center group-hover:translate-x-0.5 transition-transform">
              Critical <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Primary Analytics Section: Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Stock Balance by Category</h3>
              <p className="text-xs text-slate-500">Physical units breakdown across major manufacturing product groups</p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {stock_by_category.length} Categories
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stock_by_category} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="category"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickFormatter={(v) => `${v.toLocaleString()}`}
                />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString()} Pcs`, 'Closing Stock']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '0.75rem',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="total_quantity" radius={[6, 6, 0, 0]}>
                  {stock_by_category.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inward vs Outward Movement Flow Timeline */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Inward vs Outward Trend</h3>
              <p className="text-xs text-slate-500">Monthly receipt velocity vs dispatch fulfilment volume</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span> Inward
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> Outward
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            {inward_vs_outward_time && inward_vs_outward_time.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inward_vs_outward_time} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="inwardGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="outwardGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickFormatter={(v) => `${v.toLocaleString()}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '0.75rem',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="inward"
                    name="Inward Qty"
                    stroke="#0D9488"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#inwardGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="outward"
                    name="Outward Qty"
                    stroke="#7C3AED"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#outwardGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No monthly transactions recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top SKUs by Available Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">Highest Volume SKUs (Top 10)</h3>
            <p className="text-xs text-slate-500">Products holding the largest physical on-hand inventory volumes</p>
          </div>
          <button
            onClick={() => setCurrentTab('summary')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center cursor-pointer"
          >
            <span>View Full Inventory Ledger</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">SKU Code</th>
                <th className="py-3 px-4">Product Variant Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Closing Quantity</th>
                <th className="py-3 px-4 text-center">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {top_skus && top_skus.length > 0 ? (
                top_skus.map((sku, index) => (
                  <tr key={sku.sku} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-400">#{index + 1}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {sku.sku}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{sku.name}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {sku.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sm text-slate-900 tabular-nums">
                      {Math.round(sku.quantity).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-slate-500">{sku.unit}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No SKU data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
