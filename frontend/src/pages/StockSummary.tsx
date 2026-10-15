import React, { useState, useEffect } from 'react';
import {
  TableProperties,
  Search,
  Filter,
  Download,
  CheckCircle,
  AlertTriangle,
  PackageX,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  Boxes,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import api from '../api/client';
import { StockSummaryItem } from '../types';

export const StockSummary: React.FC = () => {
  const [items, setItems] = useState<StockSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockStatus, setStockStatus] = useState('ALL');
  const [categories, setCategories] = useState<string[]>([]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      if (stockStatus !== 'ALL') params.stock_status = stockStatus;

      const res = await api.get('/inventory/summary', { params });
      setItems(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await api.get('/products/filters');
        setCategories(res.data.categories || []);
      } catch (e) {}
    };
    fetchCats();
  }, []);

  // Instant live search: updates just after typing / releasing keypad button (100ms debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSummary();
    }, 100);
    return () => clearTimeout(timer);
  }, [search, category, stockStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSummary();
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    try {
      const params = new URLSearchParams();
      params.append('report_type', 'stock_summary');
      params.append('export_format', format);
      if (category) params.append('category', category);

      const res = await api.get(`/analysis/export?${params.toString()}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Stock_Summary_${new Date().toISOString().slice(0, 10)}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Export failed');
    }
  };

  // Compute aggregate totals with strict numeric conversion
  const totalStock = items.reduce((sum, it) => sum + (Number(it.current_quantity) || 0), 0);
  const totalInward = items.reduce((sum, it) => sum + (Number(it.total_inward) || 0), 0);
  const totalOutward = items.reduce((sum, it) => sum + (Number(it.total_outward) || 0), 0);
  const totalAdjustment = items.reduce((sum, it) => sum + (Number(it.total_adjustment) || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
            <TableProperties className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Stock Summary Report
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Complete inventory balance ledger showing inward, outward, adjustments, and closing stock across all SKUs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm shadow-emerald-600/25 transition-all cursor-pointer"
            title="Download full summary in Microsoft Excel format"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 shadow-xs transition-all cursor-pointer"
            title="Download report as CSV file"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Metric Cards (Fully Colored with Distinct Gradient Palettes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inward Received — Blue */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg transition-all border border-blue-500/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">
                Total Inward Received
              </span>
              <div className="p-2 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                {Math.round(totalInward).toLocaleString()}
              </p>
              <span className="text-xs font-semibold text-blue-100">Pcs</span>
            </div>
          </div>
          <p className="text-[11px] text-blue-100 mt-2 font-medium">Cumulative supply intake</p>
        </div>

        {/* Total Outward Dispatched — Rose */}
        <div className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg transition-all border border-rose-500/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-100 uppercase tracking-wider">
                Total Outward Dispatched
              </span>
              <div className="p-2 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                {Math.round(totalOutward).toLocaleString()}
              </p>
              <span className="text-xs font-semibold text-rose-100">Pcs</span>
            </div>
          </div>
          <p className="text-[11px] text-rose-100 mt-2 font-medium">Cumulative orders dispatched</p>
        </div>

        {/* Net Adjustments — Purple */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg transition-all border border-purple-500/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-100 uppercase tracking-wider">
                Net Adjustments
              </span>
              <div className="p-2 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20">
                <Sliders className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                {totalAdjustment > 0 ? `+${Math.round(totalAdjustment).toLocaleString()}` : Math.round(totalAdjustment).toLocaleString()}
              </p>
              <span className="text-xs font-semibold text-purple-100">Pcs</span>
            </div>
          </div>
          <p className="text-[11px] text-purple-100 mt-2 font-medium">Reconciled physical count delta</p>
        </div>

        {/* Total Closing Stock — Emerald */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg transition-all border border-emerald-500/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
                Total Closing Stock
              </span>
              <div className="p-2 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                {Math.round(totalStock).toLocaleString()}
              </p>
              <span className="text-xs font-semibold text-emerald-100">Pcs ({items.length} SKUs)</span>
            </div>
          </div>
          <p className="text-[11px] text-emerald-100 mt-2 font-medium">Live warehouse balance</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Instant search across SKU, variant name, dimensions..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <select
            value={stockStatus}
            onChange={(e) => setStockStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="NORMAL">Normal Stock</option>
            <option value="LOW_STOCK">Low Stock Alert</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Stock Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">SKU Code</th>
                <th className="py-3 px-4">Product Variant & Specifications</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Inwards</th>
                <th className="py-3 px-4 text-right">Outwards</th>
                <th className="py-3 px-4 text-right">Adjustments</th>
                <th className="py-3 px-4 text-right">Closing Balance</th>
                <th className="py-3 px-4 text-center">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    <div className="inline-block w-7 h-7 border-3 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin"></div>
                    <p className="mt-2 text-xs font-semibold text-slate-500">Loading live stock summary...</p>
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((it) => {
                  const currQty = Number(it.current_quantity) || 0;
                  const minStock = Number(it.minimum_stock) || 0;
                  const adj = Number(it.total_adjustment) || 0;

                  return (
                    <tr key={it.product_id} className="hover:bg-slate-50/80 transition-colors">
                      {/* SKU */}
                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-indigo-700">
                        <span className="bg-indigo-50/70 border border-indigo-100 px-2 py-0.5 rounded-md inline-block">
                          {it.sku}
                        </span>
                      </td>

                      {/* Name & Specs */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block text-xs sm:text-sm">
                          {it.name}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {it.thickness && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200/50">
                              {it.thickness}
                            </span>
                          )}
                          {it.dimensions && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                              {it.dimensions}
                            </span>
                          )}
                          {it.colour_finish && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200/50">
                              {it.colour_finish}
                            </span>
                          )}
                          {it.length && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                              {it.length}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium inline-block">
                          {it.category}
                        </span>
                      </td>

                      {/* Inwards */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-blue-700">
                        {Number(it.total_inward).toLocaleString()}
                      </td>

                      {/* Outwards */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-rose-700">
                        {Number(it.total_outward).toLocaleString()}
                      </td>

                      {/* Adjustments */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums">
                        <span className={
                          adj > 0 ? 'text-purple-700' : adj < 0 ? 'text-rose-700' : 'text-slate-400'
                        }>
                          {adj > 0 ? `+${adj.toLocaleString()}` : adj.toLocaleString()}
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-sm sm:text-base tabular-nums">
                        <span
                          className={
                            currQty <= 0
                              ? 'text-rose-700'
                              : currQty <= minStock
                              ? 'text-amber-700'
                              : 'text-slate-900'
                          }
                        >
                          {currQty.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1 font-normal font-sans">
                          {it.unit || 'Pcs'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {it.stock_status === 'NORMAL' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Normal
                          </span>
                        )}
                        {it.stock_status === 'LOW_STOCK' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Low Stock
                          </span>
                        )}
                        {it.stock_status === 'OUT_OF_STOCK' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                            <PackageX className="w-3.5 h-3.5 text-rose-600" /> Out of Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 text-sm">
                    No matching stock summary records found.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Reconciliation Totals Footer */}
            {items.length > 0 && (
              <tfoot className="bg-slate-50/95 border-t-2 border-slate-200 text-xs sm:text-sm font-bold text-slate-900">
                <tr>
                  <td colSpan={3} className="py-3.5 px-4 uppercase tracking-wider text-slate-600 font-extrabold text-xs">
                    Total In Scope ({items.length} SKUs)
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-blue-700 tabular-nums">
                    {Math.round(totalInward).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-rose-700 tabular-nums">
                    {Math.round(totalOutward).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-purple-700 tabular-nums">
                    {totalAdjustment > 0 ? `+${Math.round(totalAdjustment).toLocaleString()}` : Math.round(totalAdjustment).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm sm:text-base tabular-nums">
                    {Math.round(totalStock).toLocaleString()} <span className="text-xs font-normal text-slate-500">Pcs</span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-medium">
                    100% Balanced
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
