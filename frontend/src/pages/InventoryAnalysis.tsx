import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
  AlertTriangle,
  PackageX,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Download,
  Search,
  RefreshCw,
  X,
  Layers,
  CheckCircle2,
  AlertCircle,
  Info,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Calendar,
  Eye,
  Activity,
  ArrowUpDown,
  RotateCcw,
  Percent,
  PieChart as PieIcon,
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart as RechartsPie,
  Pie,
  Cell
} from 'recharts';
import { api } from '../api/client';

// Quick Preset Options
type DatePreset =
  | 'today'
  | 'last-7'
  | 'last-30'
  | 'last-90'
  | 'this-month'
  | 'prev-month'
  | 'this-quarter'
  | 'ytd'
  | 'custom'
  | 'all';

interface WorkspaceKPI {
  current: number;
  previous: number;
  diff_abs: number;
  diff_pct: number;
  unit: string;
  title: string;
  subtitle: string;
  color_theme: string;
}

export const InventoryAnalysis: React.FC = () => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'visuals' | 'movement-table' | 'reconciliation' | 'low-stock'>('visuals');

  // Filter State
  const [preset, setPreset] = useState<DatePreset>('last-30');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [comparePeriod, setComparePeriod] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedThickness, setSelectedThickness] = useState<string>('');
  const [selectedFinish, setSelectedFinish] = useState<string>('');
  const [selectedDimension, setSelectedDimension] = useState<string>('');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('ALL');
  const [movementStatusFilter, setMovementStatusFilter] = useState<string>('ALL');
  const [slowThreshold, setSlowThreshold] = useState<number>(5.0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);

  // Filter Options
  const [filterOptions, setFilterOptions] = useState<{
    categories: string[];
    finishes: string[];
    thicknesses: string[];
    dimensions: string[];
    lengths: string[];
  }>({
    categories: [],
    finishes: [],
    thicknesses: [],
    dimensions: [],
    lengths: []
  });

  // Workspace Data
  const [workspace, setWorkspace] = useState<any>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState<boolean>(true);
  const [trendInterval, setTrendInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [inOutViewMode, setInOutViewMode] = useState<'category' | 'time'>('category');

  // Movement Ledger Table State
  const [tableItems, setTableItems] = useState<any[]>([]);
  const [tableSummary, setTableSummary] = useState<any>(null);
  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [tablePage, setTablePage] = useState<number>(1);
  const [tablePageSize, setTablePageSize] = useState<number>(25);
  const [tableTotalPages, setTableTotalPages] = useState<number>(1);
  const [tableTotalRecords, setTableTotalRecords] = useState<number>(0);
  const [tableSortBy, setTableSortBy] = useState<string>('period_outward');
  const [tableSortOrder, setTableSortOrder] = useState<'asc' | 'desc'>('desc');

  // Product Movement Detail Modal
  const [selectedProductDetail, setSelectedProductDetail] = useState<any | null>(null);
  const [detailMovements, setDetailMovements] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Export Modal
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportReportType, setExportReportType] = useState<string>('product_movement');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [exporting, setExporting] = useState<boolean>(false);

  // Today ISO String for date clamping
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Format Date from Presets
  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    setDateValidationError(null);
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (p === 'today') {
      const cur = formatDate(now);
      setFromDate(cur);
      setToDate(cur);
    } else if (p === 'last-7') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      setFromDate(formatDate(past));
      setToDate(formatDate(now));
    } else if (p === 'last-30') {
      const past = new Date(now);
      past.setDate(past.getDate() - 29);
      setFromDate(formatDate(past));
      setToDate(formatDate(now));
    } else if (p === 'last-90') {
      const past = new Date(now);
      past.setDate(past.getDate() - 89);
      setFromDate(formatDate(past));
      setToDate(formatDate(now));
    } else if (p === 'this-month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(formatDate(firstDay));
      setToDate(formatDate(now));
    } else if (p === 'prev-month') {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(formatDate(firstDayPrev));
      setToDate(formatDate(lastDayPrev));
    } else if (p === 'this-quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const firstDayQ = new Date(now.getFullYear(), qMonth, 1);
      setFromDate(formatDate(firstDayQ));
      setToDate(formatDate(now));
    } else if (p === 'ytd') {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      setFromDate(formatDate(firstDayYear));
      setToDate(formatDate(now));
    } else if (p === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  // Initial Load: Filter Options & Default 30-Day Preset
  useEffect(() => {
    applyPreset('last-30');
    const fetchOptions = async () => {
      try {
        if (api.getAnalysisFilterOptions) {
          const res = await api.getAnalysisFilterOptions();
          setFilterOptions(res.data);
        } else {
          const res = await api.get('/products/filters');
          setFilterOptions({
            categories: res.data?.categories || [],
            finishes: res.data?.finishes || [],
            thicknesses: res.data?.thicknesses || [],
            dimensions: res.data?.dimensions || [],
            lengths: res.data?.lengths || []
          });
        }
      } catch (e) {
        console.error('Failed to load filter options:', e);
      }
    };
    fetchOptions();
  }, []);

  // Fetch Workspace Analytics Data
  const fetchWorkspaceData = async () => {
    if (fromDate && toDate && fromDate > toDate) {
      setDateValidationError('From Date cannot be later than To Date.');
      return;
    }
    if (fromDate && fromDate > todayStr) {
      setDateValidationError('From Date cannot be in the future.');
      return;
    }
    if (toDate && toDate > todayStr) {
      setDateValidationError('To Date cannot be in the future.');
      return;
    }
    setDateValidationError(null);
    setWorkspaceLoading(true);

    try {
      const params: any = {
        compare_period: comparePeriod,
        trend_interval: trendInterval,
        slow_threshold: slowThreshold
      };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedThickness) params.thickness = selectedThickness;
      if (selectedFinish) params.colour_finish = selectedFinish;
      if (selectedDimension) params.dimensions = selectedDimension;
      if (stockStatusFilter !== 'ALL') params.stock_status = stockStatusFilter;
      if (movementStatusFilter !== 'ALL') params.movement_status = movementStatusFilter;

      const res = await api.getAnalyticsWorkspace(params);
      setWorkspace(res.data);
    } catch (err: any) {
      console.error('Error fetching workspace:', err);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  // Fetch Table Data
  const fetchTableData = async () => {
    setTableLoading(true);
    try {
      const params: any = {
        page: tablePage,
        page_size: tablePageSize,
        sort_by: tableSortBy,
        sort_order: tableSortOrder,
        slow_threshold: slowThreshold
      };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedThickness) params.thickness = selectedThickness;
      if (selectedFinish) params.colour_finish = selectedFinish;
      if (selectedDimension) params.dimensions = selectedDimension;
      if (tableSearch.trim()) params.search = tableSearch.trim();
      if (stockStatusFilter !== 'ALL') params.stock_status = stockStatusFilter;
      if (movementStatusFilter !== 'ALL') params.movement_status = movementStatusFilter;

      const res = await api.getProductMovementTable(params);
      setTableItems(res.data?.items || []);
      setTableSummary(res.data?.summary || null);
      setTableTotalRecords(res.data?.total || 0);
      setTableTotalPages(res.data?.total_pages || 1);
    } catch (err: any) {
      console.error('Error fetching movement table:', err);
    } finally {
      setTableLoading(false);
    }
  };

  // Trigger Data Refresh on Filter Dependencies
  useEffect(() => {
    fetchWorkspaceData();
  }, [
    fromDate,
    toDate,
    comparePeriod,
    selectedCategory,
    selectedThickness,
    selectedFinish,
    selectedDimension,
    stockStatusFilter,
    movementStatusFilter,
    trendInterval,
    slowThreshold
  ]);

  useEffect(() => {
    fetchTableData();
  }, [
    fromDate,
    toDate,
    selectedCategory,
    selectedThickness,
    selectedFinish,
    selectedDimension,
    stockStatusFilter,
    movementStatusFilter,
    tablePage,
    tablePageSize,
    tableSortBy,
    tableSortOrder,
    slowThreshold
  ]);

  // Debounced Table Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setTablePage(1);
      fetchTableData();
    }, 250);
    return () => clearTimeout(timer);
  }, [tableSearch]);

  // Open Product Movement Modal
  const handleOpenProductDetail = async (prod: any) => {
    setSelectedProductDetail(prod);
    setDetailLoading(true);
    try {
      const res = await api.getProductDatedMovement(prod.id);
      setDetailMovements(res.data?.transactions || []);
    } catch (e) {
      console.error(e);
      setDetailMovements([]);
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle Export Execution
  const handleExecuteExport = async () => {
    setExporting(true);
    try {
      const params: any = {
        report_type: exportReportType,
        export_format: exportFormat
      };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedThickness) params.thickness = selectedThickness;
      if (selectedFinish) params.colour_finish = selectedFinish;
      if (selectedDimension) params.dimensions = selectedDimension;
      if (stockStatusFilter !== 'ALL') params.stock_status = stockStatusFilter;
      if (movementStatusFilter !== 'ALL') params.movement_status = movementStatusFilter;

      const res = await api.exportAnalysisReport(params);
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${exportReportType}_${fromDate || 'all'}_to_${toDate || 'all'}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setExportModalOpen(false);
    } catch (e) {
      alert('Export generation failed. Please review your filter parameters.');
    } finally {
      setExporting(false);
    }
  };

  // Reset Filters to System Default
  const handleResetFilters = () => {
    applyPreset('last-30');
    setSelectedCategory('');
    setSelectedThickness('');
    setSelectedFinish('');
    setSelectedDimension('');
    setStockStatusFilter('ALL');
    setMovementStatusFilter('ALL');
    setTableSearch('');
    setComparePeriod(true);
    setTablePage(1);
    setDateValidationError(null);
  };

  // Handle Actionable Insight Click
  const handleInsightAction = (actionType: string, actionTarget: any) => {
    if (actionType === 'FILTER_STATUS') {
      setStockStatusFilter(actionTarget);
      setActiveTab('movement-table');
    } else if (actionType === 'FILTER_MOVEMENT') {
      setMovementStatusFilter(actionTarget);
      setActiveTab('movement-table');
    } else if (actionType === 'FILTER_CATEGORY') {
      setSelectedCategory(actionTarget);
      setActiveTab('movement-table');
    } else if (actionType === 'SEARCH_SKU') {
      setTableSearch(actionTarget);
      setActiveTab('movement-table');
    }
  };

  // Format Helper for Dates consistently in DD MMM YYYY
  const formatDateTime = (raw?: string | null) => {
    if (!raw) return '—';
    try {
      const cleaned = typeof raw === 'string' ? raw.replace(' ', 'T') : raw;
      const d = new Date(cleaned);
      if (isNaN(d.getTime())) return '—';
      return (
        d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) +
        ' ' +
        d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      );
    } catch {
      return '—';
    }
  };

  // Accessible Chart Colors
  const CHART_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

  const kpis = workspace?.kpis;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-xs">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Inventory Analytics & Reports
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Real-time SQL Ledger
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
              Period-over-period flow dynamics, SKU movement velocity, stock health distribution, and mathematical reconciliation audit.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setExportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Reports</span>
          </button>
          <button
            onClick={fetchWorkspaceData}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${workspaceLoading ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleResetFilters}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Reset all filters to default"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Central Date-Range Controller & Multi-Attribute Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Quick Date Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-slate-100 text-xs font-semibold">
          <span className="text-slate-400 uppercase tracking-wider text-[11px] mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Date Presets:
          </span>
          {[
            { id: 'today', label: 'Today' },
            { id: 'last-7', label: 'Last 7 Days' },
            { id: 'last-30', label: 'Last 30 Days' },
            { id: 'last-90', label: 'Last 90 Days' },
            { id: 'this-month', label: 'This Month' },
            { id: 'prev-month', label: 'Previous Month' },
            { id: 'this-quarter', label: 'This Quarter' },
            { id: 'ytd', label: 'Year to Date' },
            { id: 'custom', label: 'Custom Range' },
            { id: 'all', label: 'All Available History' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'custom') {
                  setPreset('custom');
                } else {
                  applyPreset(item.id as DatePreset);
                }
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                preset === item.id
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Primary Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          {/* From Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              From Date
            </label>
            <input
              type="date"
              max={todayStr}
              value={fromDate}
              onChange={(e) => {
                setPreset('custom');
                setFromDate(e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              To Date
            </label>
            <input
              type="date"
              max={todayStr}
              value={toDate}
              onChange={(e) => {
                setPreset('custom');
                setToDate(e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              {filterOptions.categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Stock Status
            </label>
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="NORMAL">Healthy / Normal Stock</option>
              <option value="LOW_STOCK">Low Stock Buffer Breach</option>
              <option value="OUT_OF_STOCK">Out of Stock (Zero/Negative)</option>
            </select>
          </div>

          {/* Movement Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Movement Status
            </label>
            <select
              value={movementStatusFilter}
              onChange={(e) => setMovementStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Movement Types</option>
              <option value="MOVING">Moving in Period</option>
              <option value="SLOW">Slow-Moving Inventory</option>
              <option value="NO_MOVEMENT">No Movement / Dormant</option>
            </select>
          </div>

          {/* Compare Toggle & Filter Expansion */}
          <div className="flex items-center justify-between pb-1">
            <div>
              <span className="block text-[11px] font-bold text-slate-700 uppercase">
                Compare Prior
              </span>
              <span className="text-[10px] text-slate-400 font-medium block">
                Equal prior days
              </span>
            </div>
            <button
              type="button"
              onClick={() => setComparePeriod(!comparePeriod)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                comparePeriod ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  comparePeriod ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Advanced Variant Attribute Filters Toggle */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{showAdvancedFilters ? 'Hide Variant Filters' : 'Show Variant Specifications (Thickness, Finish, Dimensions)'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchWorkspaceData();
                fetchTableData();
              }}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Apply Filters</span>
            </button>
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        </div>

        {/* Collapsible Variant Attributes Filter Row */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in duration-150">
            {/* Thickness */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Thickness</label>
              <select
                value={selectedThickness}
                onChange={(e) => setSelectedThickness(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="">All Thicknesses</option>
                {filterOptions.thicknesses.map((th) => (
                  <option key={th} value={th}>{th}</option>
                ))}
              </select>
            </div>

            {/* Colour / Finish */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Colour / Finish</label>
              <select
                value={selectedFinish}
                onChange={(e) => setSelectedFinish(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="">All Finishes</option>
                {filterOptions.finishes.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Dimensions */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Dimensions</label>
              <select
                value={selectedDimension}
                onChange={(e) => setSelectedDimension(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="">All Dimensions</option>
                {filterOptions.dimensions.map((dim) => (
                  <option key={dim} value={dim}>{dim}</option>
                ))}
              </select>
            </div>

            {/* Slow Moving Threshold */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Slow-Move Max Dispatches: {slowThreshold} Pcs
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={slowThreshold}
                onChange={(e) => setSlowThreshold(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        )}

        {/* Validation Alert */}
        {dateValidationError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{dateValidationError}</span>
          </div>
        )}

        {/* Active Period & Scope Indicator Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Selected Analysis Period:</span>
            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md">
              {workspace?.period?.display_label || 'All Available History'}
            </span>
            <span className="text-slate-400">({workspace?.period?.days || 0} days analyzed)</span>
          </div>
          {comparePeriod && workspace?.comparison_period?.enabled && (
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <span>Compared against:</span>
              <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {workspace?.comparison_period?.display_label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Analytical KPI Cards (8 Distinct Metric Types with Tailored Full Color Systems) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Current Stock (Blue) */}
        <div
          onClick={() => setActiveTab('movement-table')}
          className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-blue-500/40 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">
              1. Total Current Stock
            </span>
            <div className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20 group-hover:scale-105 transition-transform">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                {workspaceLoading ? '...' : kpis ? Number(kpis.total_current_stock.current).toLocaleString() : '0'}
              </span>
              <span className="text-xs font-semibold text-blue-100">Pcs</span>
            </div>
            <p className="text-[11px] text-blue-100/90 mt-1 font-medium">Live warehouse on-hand balance (present snapshot)</p>
          </div>
        </div>

        {/* KPI 2: Total Inward (Teal) */}
        <div
          onClick={() => setActiveTab('visuals')}
          className="bg-gradient-to-br from-teal-600 to-teal-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-teal-500/40 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-100 uppercase tracking-wider">
              2. Total Inward
            </span>
            <div className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20 group-hover:scale-105 transition-transform">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                {workspaceLoading ? '...' : kpis ? `+${Number(kpis.total_inward.current).toLocaleString()}` : '+0'}
              </span>
              <span className="text-xs font-semibold text-teal-100">Pcs</span>
            </div>
            {comparePeriod && kpis?.total_inward && (
              <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
                <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[11px]">
                  {kpis.total_inward.diff_pct >= 0 ? `+${kpis.total_inward.diff_pct}%` : `${kpis.total_inward.diff_pct}%`}
                </span>
                <span className="text-teal-100 text-[10px] font-normal">vs previous period</span>
              </div>
            )}
          </div>
        </div>

        {/* KPI 3: Total Outward (Purple) */}
        <div
          onClick={() => setActiveTab('visuals')}
          className="bg-gradient-to-br from-purple-600 to-purple-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-purple-500/40 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-100 uppercase tracking-wider">
              3. Total Outward
            </span>
            <div className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20 group-hover:scale-105 transition-transform">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                {workspaceLoading ? '...' : kpis ? `-${Number(kpis.total_outward.current).toLocaleString()}` : '-0'}
              </span>
              <span className="text-xs font-semibold text-purple-100">Pcs</span>
            </div>
            {comparePeriod && kpis?.total_outward && (
              <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
                <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[11px]">
                  {kpis.total_outward.diff_pct >= 0 ? `+${kpis.total_outward.diff_pct}%` : `${kpis.total_outward.diff_pct}%`}
                </span>
                <span className="text-purple-100 text-[10px] font-normal">vs previous period</span>
              </div>
            )}
          </div>
        </div>

        {/* KPI 4: Net Stock Movement (Indigo) */}
        <div
          onClick={() => setActiveTab('movement-table')}
          className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-indigo-500/40 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider">
              4. Net Stock Movement
            </span>
            <div className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20 group-hover:scale-105 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                {workspaceLoading ? '...' : kpis ? (kpis.net_movement.current >= 0 ? `+${Number(kpis.net_movement.current).toLocaleString()}` : Number(kpis.net_movement.current).toLocaleString()) : '0'}
              </span>
              <span className="text-xs font-semibold text-indigo-100">Pcs</span>
            </div>
            <p className="text-[11px] text-indigo-100/90 mt-1 font-medium">Inward - Outward + Adjustments</p>
          </div>
        </div>

        {/* KPI 5: Low-Stock Products (Amber) */}
        <div
          onClick={() => {
            setStockStatusFilter('LOW_STOCK');
            setActiveTab('movement-table');
          }}
          className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-amber-400/40 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-100 uppercase tracking-wider">
              5. Low-Stock Products
            </span>
            <div className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                {workspaceLoading ? '...' : kpis ? Number(kpis.low_stock_count.current).toLocaleString() : '0'}
              </span>
              <span className="text-xs font-semibold text-amber-100">SKUs</span>
            </div>
            <p className="text-[11px] text-amber-100/90 mt-1 font-medium">Operating below minimum safety threshold</p>
          </div>
        </div>

        {/* KPI 6: Out-of-Stock Products (Rose) */}
        <div
          onClick={() => {
            setStockStatusFilter('OUT_OF_STOCK');
            setActiveTab('movement-table');
          }}
          className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-rose-500/40 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-100 uppercase tracking-wider">
              6. Out-of-Stock Products
            </span>
            <div className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20 group-hover:scale-105 transition-transform">
              <PackageX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                {workspaceLoading ? '...' : kpis ? Number(kpis.out_of_stock_count.current).toLocaleString() : '0'}
              </span>
              <span className="text-xs font-semibold text-rose-100">SKUs</span>
            </div>
            <p className="text-[11px] text-rose-100/90 mt-1 font-medium">Depleted zero or negative balance</p>
          </div>
        </div>

        {/* KPI 7: Moving Products (Emerald) */}
        <div
          onClick={() => {
            setMovementStatusFilter('MOVING');
            setActiveTab('movement-table');
          }}
          className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-emerald-500/40 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
              7. Moving Products
            </span>
            <div className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                {workspaceLoading ? '...' : kpis ? Number(kpis.moving_products.current).toLocaleString() : '0'}
              </span>
              <span className="text-xs font-semibold text-emerald-100">SKUs</span>
            </div>
            <p className="text-[11px] text-emerald-100/90 mt-1 font-medium">Active inward/outward transactions in period</p>
          </div>
        </div>

        {/* KPI 8: No-Movement Products (Slate) */}
        <div
          onClick={() => {
            setMovementStatusFilter('NO_MOVEMENT');
            setActiveTab('movement-table');
          }}
          className="bg-gradient-to-br from-slate-700 to-slate-800 text-white p-5 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-slate-600/40 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              8. No-Movement Products
            </span>
            <div className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-xs border border-white/20 group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                {workspaceLoading ? '...' : kpis ? Number(kpis.no_movement_products.current).toLocaleString() : '0'}
              </span>
              <span className="text-xs font-semibold text-slate-200">SKUs</span>
            </div>
            <p className="text-[11px] text-slate-200/90 mt-1 font-medium">Zero activity in selected date window</p>
          </div>
        </div>
      </div>

      {/* 4. Actionable Deterministic Insights & Operational Alerts */}
      {workspace?.insights && workspace.insights.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Operational Inventory Insights & Intelligent Actions</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              Traceable Deterministic Rules
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {workspace.insights.map((ins: any) => {
              const isCrit = ins.level === 'critical';
              const isWarn = ins.level === 'warning';

              return (
                <div
                  key={ins.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                    isCrit
                      ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                      : isWarn
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                      : 'bg-indigo-50/50 border-indigo-100 text-indigo-950'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          isCrit
                            ? 'bg-rose-200/70 text-rose-800'
                            : isWarn
                            ? 'bg-amber-200/70 text-amber-800'
                            : 'bg-indigo-200/70 text-indigo-800'
                        }`}
                      >
                        {ins.badge}
                      </span>
                      {isCrit ? (
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                      ) : isWarn ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Info className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <h3 className="text-xs font-bold">{ins.title}</h3>
                    <p className="text-[11px] opacity-85 mt-1 leading-relaxed">
                      {ins.description}
                    </p>
                  </div>

                  {ins.action_type !== 'NONE' && (
                    <button
                      onClick={() => handleInsightAction(ins.action_type, ins.action_target)}
                      className="mt-3 text-[11px] font-bold text-left hover:underline flex items-center gap-1 cursor-pointer pt-2 border-t border-black/5"
                    >
                      <span>Filter & Inspect Details →</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Modern Workspace Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('visuals')}
          className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'visuals'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <span>Interactive Visual Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('movement-table')}
          className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'movement-table'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4 text-teal-600" />
          <span>Product Movement Analysis Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'reconciliation'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Stock Reconciliation & Parity Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('low-stock')}
          className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'low-stock'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Safety Buffer & Reorder Alerts</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INTERACTIVE VISUAL ANALYTICS & CHARTS */}
      {/* ========================================================================= */}
      {activeTab === 'visuals' && (
        <div className="space-y-6">
          {/* Chart Section A & B: Movement Trend & Inward vs Outward */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart A: Stock Movement Trend (Inward, Outward, Net) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Stock Movement Trend</h3>
                  <p className="text-xs text-slate-500">Inward receipts, outward dispatches, and net flow</p>
                </div>
                {/* Granularity switch */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold self-start sm:self-auto">
                  {(['daily', 'weekly', 'monthly'] as const).map((interval) => (
                    <button
                      key={interval}
                      onClick={() => setTrendInterval(interval)}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        trendInterval === interval
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {interval.charAt(0).toUpperCase() + interval.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-72 w-full">
                {workspace?.movement_trend && workspace.movement_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={workspace.movement_trend}>
                      <defs>
                        <linearGradient id="colorInward" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorOutward" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#9333ea" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#9333ea" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Area type="monotone" dataKey="inward" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorInward)" name="Inward (Received)" />
                      <Area type="monotone" dataKey="outward" stroke="#9333ea" strokeWidth={2} fillOpacity={1} fill="url(#colorOutward)" name="Outward (Dispatched)" />
                      <Area type="monotone" dataKey="net" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorNet)" name="Net Movement" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
                    <Activity className="w-8 h-8 text-slate-300 mb-2" />
                    <span className="text-xs font-bold text-slate-700">No Transactions in Selected Period</span>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      No stock movement transactions were recorded for the current filter criteria between {workspace?.period?.display_label}.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Chart B: Inward vs Outward Comparison (Toggle by Category OR Time Period) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Inward vs Outward Comparison</h3>
                  <p className="text-xs text-slate-500">Volume intake versus dispatches</p>
                </div>
                {/* Grouping switch */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold self-start sm:self-auto">
                  <button
                    onClick={() => setInOutViewMode('category')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      inOutViewMode === 'category'
                        ? 'bg-white text-indigo-700 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    By Category
                  </button>
                  <button
                    onClick={() => setInOutViewMode('time')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      inOutViewMode === 'time'
                        ? 'bg-white text-indigo-700 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    By Time Period
                  </button>
                </div>
              </div>

              <div className="h-72 w-full">
                {inOutViewMode === 'category' ? (
                  workspace?.category_distribution && workspace.category_distribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={workspace.category_distribution}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="category" tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Bar dataKey="total_inward" fill="#0d9488" radius={[4, 4, 0, 0]} name="Inward Intake" />
                        <Bar dataKey="total_outward" fill="#9333ea" radius={[4, 4, 0, 0]} name="Outward Dispatches" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      No category intake/issue comparison data available.
                    </div>
                  )
                ) : (
                  workspace?.movement_trend && workspace.movement_trend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={workspace.movement_trend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Bar dataKey="inward" fill="#0d9488" radius={[4, 4, 0, 0]} name="Inward Intake" />
                        <Bar dataKey="outward" fill="#9333ea" radius={[4, 4, 0, 0]} name="Outward Dispatches" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      No timeline movement data recorded for selected period.
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Chart Section C & D: Top Products (Outward & Inward) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 10 Fast-Moving Products (Outward) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Top 10 Products by Outward Movement</h3>
                  <p className="text-xs text-slate-500">Highest volume dispatches during selected period</p>
                </div>
                <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                  Demand Velocity
                </span>
              </div>

              <div className="space-y-2 mt-4">
                {workspace?.top_outward && workspace.top_outward.length > 0 ? (
                  workspace.top_outward.map((item: any, idx: number) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenProductDetail(item)}
                      className="p-2.5 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/30 transition-all cursor-pointer flex items-center justify-between text-xs group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-indigo-700 text-[11px]">{item.sku}</span>
                            {item.dimensions && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-mono">
                                {item.dimensions}
                              </span>
                            )}
                          </div>
                          <span className="text-slate-700 font-semibold truncate max-w-[210px] block mt-0.5">{item.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-purple-700 text-sm tabular-nums block">
                          -{item.quantity.toLocaleString()} {item.unit}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {item.share_pct}% of dispatches
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No outward dispatches recorded in this date range.
                  </div>
                )}
              </div>
            </div>

            {/* Top 10 Inward Products (Replenishment) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Top 10 Products by Inward Movement</h3>
                  <p className="text-xs text-slate-500">Highest volume intake and replenishments</p>
                </div>
                <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                  Replenishment
                </span>
              </div>

              <div className="space-y-2 mt-4">
                {workspace?.top_inward && workspace.top_inward.length > 0 ? (
                  workspace.top_inward.map((item: any, idx: number) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenProductDetail(item)}
                      className="p-2.5 rounded-xl border border-slate-100 hover:border-teal-200 hover:bg-teal-50/30 transition-all cursor-pointer flex items-center justify-between text-xs group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-indigo-700 text-[11px]">{item.sku}</span>
                            {item.dimensions && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-mono">
                                {item.dimensions}
                              </span>
                            )}
                          </div>
                          <span className="text-slate-700 font-semibold truncate max-w-[210px] block mt-0.5">{item.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-teal-700 text-sm tabular-nums block">
                          +{item.quantity.toLocaleString()} {item.unit}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {item.share_pct}% of intake
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No inward receipts recorded in this date range.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chart Section E, F, G, H: Category, Health, Slow-Moving, Stock Concentration */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category Distribution (Doughnut Chart with Drill-down) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Inventory Distribution by Category</h3>
                <p className="text-xs text-slate-500">Physical share of current warehouse stock</p>
              </div>

              <div className="h-52 w-full my-2">
                {workspace?.category_distribution && workspace.category_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={workspace.category_distribution}
                        dataKey="total_stock"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={75}
                        paddingAngle={3}
                        onClick={(data) => {
                          if (data && data.category) {
                            setSelectedCategory(data.category);
                          }
                        }}
                      >
                        {workspace.category_distribution.map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No category data available.
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto pr-1">
                {workspace?.category_distribution?.map((c: any, i: number) => (
                  <button
                    key={c.category}
                    onClick={() => setSelectedCategory(c.category)}
                    className="w-full flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer border-b border-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="font-semibold text-slate-700">{c.category}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {c.total_stock.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">({c.share_pct}%)</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory Health Distribution */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Inventory Health Distribution</h3>
                <p className="text-xs text-slate-500">Configured safety buffer threshold classification</p>
              </div>

              <div className="space-y-3 my-auto py-3">
                {/* Healthy */}
                <div
                  onClick={() => {
                    setStockStatusFilter('NORMAL');
                    setActiveTab('movement-table');
                  }}
                  className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center font-bold backdrop-blur-xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Healthy Stock</span>
                      <span className="text-[11px] text-emerald-100">Above minimum buffer</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black font-mono text-white tabular-nums block">
                      {workspace?.health_distribution?.healthy ?? 0} SKUs
                    </span>
                    <span className="text-[10px] text-emerald-100 font-semibold">
                      {workspace?.health_distribution?.healthy_pct ?? 0}%
                    </span>
                  </div>
                </div>

                {/* Low Stock */}
                <div
                  onClick={() => {
                    setStockStatusFilter('LOW_STOCK');
                    setActiveTab('movement-table');
                  }}
                  className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center font-bold backdrop-blur-xs">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Low Stock Alert</span>
                      <span className="text-[11px] text-amber-100">Needs replenishment</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black font-mono text-white tabular-nums block">
                      {workspace?.health_distribution?.low_stock ?? 0} SKUs
                    </span>
                    <span className="text-[10px] text-amber-100 font-semibold">
                      {workspace?.health_distribution?.low_stock_pct ?? 0}%
                    </span>
                  </div>
                </div>

                {/* Out of Stock */}
                <div
                  onClick={() => {
                    setStockStatusFilter('OUT_OF_STOCK');
                    setActiveTab('movement-table');
                  }}
                  className="p-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center font-bold backdrop-blur-xs">
                      <PackageX className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Out of Stock</span>
                      <span className="text-[11px] text-rose-100">Depleted balance</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black font-mono text-white tabular-nums block">
                      {workspace?.health_distribution?.out_of_stock ?? 0} SKUs
                    </span>
                    <span className="text-[10px] text-rose-100 font-semibold">
                      {workspace?.health_distribution?.out_of_stock_pct ?? 0}%
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 font-medium text-center">
                Strictly calculated from configured minimum buffer limits.
              </p>
            </div>

            {/* Slow-Moving & Dormant Inventory */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Slow-Moving & Dormant Inventory</h3>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    ≤ {slowThreshold} Pcs Outward
                  </span>
                </div>
                <p className="text-xs text-slate-500">Holding stock with minimal/zero dispatches in period</p>
              </div>

              <div className="space-y-2 mt-3 max-h-72 overflow-y-auto pr-1">
                {workspace?.slow_moving && workspace.slow_moving.length > 0 ? (
                  workspace.slow_moving.map((item: any) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenProductDetail(item)}
                      className="p-2.5 rounded-xl border border-slate-100 hover:border-slate-300 transition-all cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-indigo-700 block text-[11px]">{item.sku}</span>
                        <span className="text-slate-700 font-semibold truncate max-w-[170px] block">{item.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {item.days_since_last_movement !== null ? `Last moved: ${item.days_since_last_movement} days ago` : 'No historical movement'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-900 text-xs tabular-nums block">
                          {item.current_stock.toLocaleString()} {item.unit}
                        </span>
                        <span className="text-[10px] text-amber-700 font-semibold">
                          {item.outward_qty} Dispatched
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    All inventory products are moving actively above threshold.
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 text-right">
                <button
                  onClick={() => {
                    setMovementStatusFilter('SLOW');
                    setActiveTab('movement-table');
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  View All Slow / Dormant SKUs →
                </button>
              </div>
            </div>
          </div>

          {/* Section H: Stock Concentration (Pareto Volume Share) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-indigo-600" />
                  <span>Stock Concentration Analysis (Pareto Volume Share)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Products accounting for the largest share of live physical inventory quantity.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md self-start sm:self-auto">
                Physical Units (No financial pricing assumptions)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {workspace?.stock_concentration && workspace.stock_concentration.length > 0 ? (
                workspace.stock_concentration.map((item: any, idx: number) => (
                  <div
                    key={item.id}
                    onClick={() => handleOpenProductDetail(item)}
                    className="p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-bold text-indigo-700">{item.sku}</span>
                        <span className="text-slate-400 text-[10px] font-bold">#{idx + 1} Concentration</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-800 line-clamp-1 block">{item.name}</span>
                      <span className="text-[10px] text-slate-500">{item.category}</span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-bold text-slate-900">
                          {item.current_stock.toLocaleString()} {item.unit}
                        </span>
                        <span className="font-mono font-bold text-indigo-700">
                          {item.share_pct}% share
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, item.share_pct * 3)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                        <span>Cumulative volume share:</span>
                        <span className="font-mono font-semibold text-slate-600">{item.cumulative_share_pct}%</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 py-8 text-center text-slate-400 text-xs">
                  No stock concentration data available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DETAILED PRODUCT MOVEMENT ANALYSIS TABLE */}
      {/* ========================================================================= */}
      {activeTab === 'movement-table' && (
        <div className="space-y-4">
          {/* Table Header & Search Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search across SKU, variant name, dimensions, finish, thickness..."
                className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Rows per page:</span>
              <select
                value={tablePageSize}
                onChange={(e) => {
                  setTablePageSize(Number(e.target.value));
                  setTablePage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <button
                onClick={() => {
                  setExportReportType('product_movement');
                  setExportModalOpen(true);
                }}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Filtered Table</span>
              </button>
            </div>
          </div>

          {/* Analytical Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 backdrop-blur-xs">
                  <tr>
                    <th
                      onClick={() => {
                        setTableSortBy('sku');
                        setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc');
                      }}
                      className="py-3 px-4 cursor-pointer hover:text-indigo-600"
                    >
                      <div className="flex items-center gap-1">
                        <span>SKU Code</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setTableSortBy('name');
                        setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc');
                      }}
                      className="py-3 px-4 cursor-pointer hover:text-indigo-600"
                    >
                      <div className="flex items-center gap-1">
                        <span>Variant Specifications</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Category</th>
                    <th
                      onClick={() => {
                        setTableSortBy('opening_stock');
                        setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc');
                      }}
                      className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Opening Stock</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setTableSortBy('period_inward');
                        setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc');
                      }}
                      className="py-3 px-4 text-right cursor-pointer hover:text-teal-700"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Inward (+)</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setTableSortBy('period_outward');
                        setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc');
                      }}
                      className="py-3 px-4 text-right cursor-pointer hover:text-purple-700"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Outward (-)</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setTableSortBy('period_net');
                        setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc');
                      }}
                      className="py-3 px-4 text-right cursor-pointer hover:text-indigo-700"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Period Net</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setTableSortBy('closing_stock');
                        setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc');
                      }}
                      className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Closing Stock</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setTableSortBy('current_stock');
                        setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc');
                      }}
                      className="py-3 px-4 text-right cursor-pointer hover:text-blue-700"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Live Stock</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">Velocity</th>
                    <th className="py-3 px-4 text-center">Audit</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 font-medium">
                  {tableLoading ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-400">
                        <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-2 text-xs font-semibold">Calculating audited movement ledger...</p>
                      </td>
                    </tr>
                  ) : tableItems.length > 0 ? (
                    tableItems.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* SKU */}
                        <td className="py-3 px-4 font-mono font-bold text-xs text-indigo-700">
                          <span className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md inline-block">
                            {it.sku}
                          </span>
                        </td>

                        {/* Name & specs */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 block text-xs sm:text-sm">
                            {it.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {it.dimensions && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                                {it.dimensions}
                              </span>
                            )}
                            {it.colour_finish && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200/50">
                                {it.colour_finish}
                              </span>
                            )}
                            {it.thickness && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700">
                                {it.thickness}
                              </span>
                            )}
                            {it.length && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700">
                                {it.length}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                            {it.category}
                          </span>
                        </td>

                        {/* Opening */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-600 tabular-nums">
                          {Number(it.opening_stock).toLocaleString()}
                        </td>

                        {/* Inward */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-teal-700 tabular-nums">
                          +{Number(it.period_inward).toLocaleString()}
                        </td>

                        {/* Outward */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-purple-700 tabular-nums">
                          -{Number(it.period_outward).toLocaleString()}
                        </td>

                        {/* Period Net */}
                        <td className="py-3 px-4 text-right font-mono font-black tabular-nums">
                          <span className={it.period_net >= 0 ? 'text-indigo-700' : 'text-rose-700'}>
                            {it.period_net >= 0 ? `+${it.period_net.toLocaleString()}` : it.period_net.toLocaleString()}
                          </span>
                        </td>

                        {/* Historical Closing */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 tabular-nums">
                          {Number(it.closing_stock).toLocaleString()}
                        </td>

                        {/* Live Current Stock */}
                        <td className="py-3 px-4 text-right font-mono font-black tabular-nums">
                          <span
                            className={
                              it.stock_status === 'OUT_OF_STOCK'
                                ? 'text-rose-700'
                                : it.stock_status === 'LOW_STOCK'
                                ? 'text-amber-700'
                                : 'text-blue-700'
                            }
                          >
                            {Number(it.current_stock).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1 font-normal font-sans">
                            {it.unit}
                          </span>
                        </td>

                        {/* Movement Status Badge */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border ${
                              it.movement_status === 'MOVING'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : it.movement_status === 'SLOW_MOVING'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {it.movement_status === 'MOVING' ? 'MOVING' : it.movement_status === 'SLOW_MOVING' ? 'SLOW' : 'NO MOVEMENT'}
                          </span>
                        </td>

                        {/* Action: Open Transaction Timeline */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenProductDetail(it)}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                            title="View audited transaction history for this SKU"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-400 text-xs">
                        No product movement records match the current filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Table Summary Footer */}
                {tableSummary && tableItems.length > 0 && (
                  <tfoot className="bg-slate-50/95 border-t-2 border-slate-200 text-xs font-bold text-slate-900">
                    <tr>
                      <td colSpan={3} className="py-3 px-4 uppercase tracking-wider text-slate-600 font-extrabold">
                        Total In Scope ({tableSummary.matched_skus} SKUs)
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 tabular-nums">
                        {Math.round(tableSummary.total_opening).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-teal-700 tabular-nums">
                        +{Math.round(tableSummary.total_inward).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-purple-700 tabular-nums">
                        -{Math.round(tableSummary.total_outward).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-indigo-700 tabular-nums">
                        {tableSummary.total_net >= 0 ? `+${Math.round(tableSummary.total_net).toLocaleString()}` : Math.round(tableSummary.total_net).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 tabular-nums">
                        {Math.round(tableSummary.total_closing).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-blue-700 tabular-nums">
                        {Math.round(tableSummary.total_current).toLocaleString()}
                      </td>
                      <td colSpan={2} className="py-3 px-4 text-center text-slate-400 font-medium">
                        Audited
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-medium">
                Showing {tableItems.length > 0 ? (tablePage - 1) * tablePageSize + 1 : 0} to{' '}
                {Math.min(tablePage * tablePageSize, tableTotalRecords)} of {tableTotalRecords} SKUs
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={tablePage <= 1}
                  onClick={() => setTablePage(tablePage - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Previous
                </button>
                <span className="font-mono font-bold text-slate-700 px-2">
                  Page {tablePage} of {tableTotalPages}
                </span>
                <button
                  disabled={tablePage >= tableTotalPages}
                  onClick={() => setTablePage(tablePage + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STOCK RECONCILIATION & DATA QUALITY AUDIT */}
      {/* ========================================================================= */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${
                  workspace?.reconciliation?.status === 'RECONCILED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Mathematical Stock Reconciliation & Parity Audit
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verification Formula: Opening Stock + Period Inward - Period Outward + Net Adjustments = Closing Stock
                  </p>
                </div>
              </div>

              <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider self-start sm:self-auto ${
                workspace?.reconciliation?.status === 'RECONCILED'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-100 text-rose-800 border border-rose-200'
              }`}>
                {workspace?.reconciliation?.status || 'AUDITING'}
              </span>
            </div>

            {/* Audit Status Cards (Fully Colored with Distinct Gradients) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white shadow-sm border border-slate-600/40">
                <span className="text-[11px] font-bold text-slate-300 uppercase block">Total Database Balance</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">
                  {workspace?.reconciliation?.total_database_stock?.toLocaleString() || '0'} Pcs
                </span>
                <span className="text-[11px] text-slate-300 mt-1 block">Sum of InventoryBalance table</span>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-800 text-white shadow-sm border border-indigo-600/40">
                <span className="text-[11px] font-bold text-indigo-200 uppercase block">Total Category Stock</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">
                  {workspace?.reconciliation?.total_category_stock?.toLocaleString() || '0'} Pcs
                </span>
                <span className="text-[11px] text-indigo-200 mt-1 block">Summed across all categories</span>
              </div>

              <div className={`p-4 rounded-xl shadow-sm border ${
                (workspace?.reconciliation?.discrepancy || 0) === 0
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-emerald-500/40'
                  : 'bg-gradient-to-br from-rose-600 to-rose-700 text-white border-rose-500/40'
              }`}>
                <span className="text-[11px] font-bold text-white/90 uppercase block">Formula Parity Discrepancy</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">
                  {workspace?.reconciliation?.discrepancy ?? 0} Pcs
                </span>
                <span className="text-[11px] text-white/80 mt-1 block">Category to DB variance</span>
              </div>

              <div className={`p-4 rounded-xl shadow-sm border ${
                (workspace?.reconciliation?.negative_stock_count || 0) === 0
                  ? 'bg-gradient-to-br from-teal-700 to-teal-800 text-white border-teal-600/40'
                  : 'bg-gradient-to-br from-rose-600 to-rose-700 text-white border-rose-500/40'
              }`}>
                <span className="text-[11px] font-bold text-white/90 uppercase block">Negative Balance Rows</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">
                  {workspace?.reconciliation?.negative_stock_count ?? 0}
                </span>
                <span className="text-[11px] text-white/80 mt-1 block">SKUs with negative balance</span>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-50/80 border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-slate-800 block">Audit Summary:</span>
              <p className="text-slate-600 leading-relaxed">
                {workspace?.reconciliation?.summary}
              </p>
              <div className="flex flex-wrap items-center gap-6 pt-2 text-slate-500 font-medium">
                <span>Products Audited: <strong>{workspace?.reconciliation?.products_audited || 0}</strong></span>
                <span>Duplicate Transactions: <strong>{workspace?.reconciliation?.duplicate_tx_count || 0}</strong></span>
                <span>Unreferenced Transactions: <strong>{workspace?.reconciliation?.unreferenced_tx_count || 0}</strong></span>
                <span>Period Analyzed: <strong>{workspace?.period?.display_label}</strong></span>
              </div>
            </div>

            {/* Itemized Discrepancy Table if any */}
            {workspace?.reconciliation?.discrepancy_items && workspace.reconciliation.discrepancy_items.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Itemized Mathematical Variances ({workspace.reconciliation.discrepancy_items.length} SKUs Flagged)</span>
                </h4>
                <div className="border border-rose-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-rose-50 text-rose-800 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3 text-right">Opening</th>
                        <th className="py-2.5 px-3 text-right">Inward</th>
                        <th className="py-2.5 px-3 text-right">Outward</th>
                        <th className="py-2.5 px-3 text-right">Expected Close</th>
                        <th className="py-2.5 px-3 text-right">Recorded Close</th>
                        <th className="py-2.5 px-3 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100">
                      {workspace.reconciliation.discrepancy_items.map((disc: any) => (
                        <tr key={disc.product_id} className="hover:bg-rose-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-rose-900">{disc.sku}</td>
                          <td className="py-2 px-3 text-slate-700">{disc.name}</td>
                          <td className="py-2 px-3 text-right font-mono">{disc.opening_stock}</td>
                          <td className="py-2 px-3 text-right font-mono text-teal-700">+{disc.inward}</td>
                          <td className="py-2 px-3 text-right font-mono text-purple-700">-{disc.outward}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">{disc.expected_closing}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">{disc.actual_closing}</td>
                          <td className="py-2 px-3 text-right font-mono font-black text-rose-600">{disc.variance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SAFETY BUFFER & REORDER DEFICIT ALERTS */}
      {/* ========================================================================= */}
      {activeTab === 'low-stock' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Safety Stock & Procurement Reorder Schedule
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Products where on-hand quantity has breached configured minimum safety buffers.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">SKU Code</th>
                    <th className="py-3 px-4">Product Variant</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Available Stock</th>
                    <th className="py-3 px-4 text-right">Minimum Safety Buffer</th>
                    <th className="py-3 px-4 text-right">Procurement Deficit</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {tableItems.filter(it => it.stock_status !== 'NORMAL').length > 0 ? (
                    tableItems
                      .filter(it => it.stock_status !== 'NORMAL')
                      .map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">{it.sku}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{it.name}</td>
                          <td className="py-3 px-4">{it.category}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                            {it.current_stock.toLocaleString()} {it.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                            {it.minimum_stock.toLocaleString()} {it.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                            {Math.max(0, it.minimum_stock - it.current_stock).toLocaleString()} {it.unit}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                              {it.stock_status === 'OUT_OF_STOCK' ? 'OUT OF STOCK' : 'REORDER NEEDED'}
                            </span>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                        No critical stock deficits found. All active SKUs are operating safely above minimum safety stock.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRODUCT MOVEMENT DETAIL MODAL / DRAWER */}
      {/* ========================================================================= */}
      {selectedProductDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-xs px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg">
                    {selectedProductDetail.sku}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                    {selectedProductDetail.category}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900">{selectedProductDetail.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete chronological transaction history & running balance ledger for this SKU.
                </p>
              </div>

              <button
                onClick={() => setSelectedProductDetail(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Table */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Snapshot Metrics Bar */}
              <div className="grid grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Current Stock</span>
                  <span className="text-base font-black font-mono text-slate-900">
                    {selectedProductDetail.current_stock?.toLocaleString() || selectedProductDetail.quantity?.toLocaleString() || 0} Pcs
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Period Inward</span>
                  <span className="text-base font-black font-mono text-teal-700">
                    +{selectedProductDetail.period_inward?.toLocaleString() || 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Period Outward</span>
                  <span className="text-base font-black font-mono text-purple-700">
                    -{selectedProductDetail.period_outward?.toLocaleString() || 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Safety Buffer</span>
                  <span className="text-base font-black font-mono text-slate-700">
                    {selectedProductDetail.minimum_stock?.toLocaleString() || 5} Pcs
                  </span>
                </div>
              </div>

              {/* Movement Ledger Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 border-b border-slate-200 font-bold text-slate-600 uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3.5">Date & Time</th>
                      <th className="py-2.5 px-3.5">Type</th>
                      <th className="py-2.5 px-3.5 text-right">Quantity</th>
                      <th className="py-2.5 px-3.5 text-right">Balance After</th>
                      <th className="py-2.5 px-3.5">Reference No</th>
                      <th className="py-2.5 px-3.5">Notes / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {detailLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">Loading SKU ledger...</td>
                      </tr>
                    ) : detailMovements.length > 0 ? (
                      detailMovements.map((tx) => {
                        const formattedDate = formatDateTime(tx.transaction_date || tx.created_at);
                        const ttype = (tx.transaction_type || '').toUpperCase();
                        const isInwardLike = ttype === 'INWARD' || ttype === 'OPENING' || ttype === 'INITIAL_OPENING';
                        const isOutwardLike = ttype === 'OUTWARD';
                        const isAdjustment = ttype === 'ADJUSTMENT';

                        const rawBal = tx.balance_after ?? tx.current_balance_after;
                        const formattedBal = rawBal !== null && rawBal !== undefined && !isNaN(Number(rawBal))
                          ? Number(rawBal).toLocaleString()
                          : '—';

                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3.5 font-mono text-slate-700 font-medium">{formattedDate}</td>
                            <td className="py-2.5 px-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isInwardLike
                                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                                  : isOutwardLike
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : isAdjustment
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                {ttype}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono font-bold tabular-nums">
                              <span className={
                                isInwardLike ? 'text-teal-700' : isOutwardLike ? 'text-rose-600' : 'text-purple-700'
                              }>
                                {isInwardLike ? `+${Math.abs(tx.quantity).toLocaleString()}` : isOutwardLike ? `-${Math.abs(tx.quantity).toLocaleString()}` : tx.quantity >= 0 ? `+${tx.quantity.toLocaleString()}` : `-${Math.abs(tx.quantity).toLocaleString()}`}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                              {formattedBal}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700">
                              {tx.reference_number || tx.reference_no || '—'}
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-600 text-[11px]">
                              {tx.remarks || tx.notes || tx.reason || '—'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                          No audited transactions recorded for this product SKU.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
              <button
                onClick={() => setSelectedProductDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXPORT REPORT MODAL */}
      {/* ========================================================================= */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Export Audited Inventory Reports</h3>
              </div>
              <button
                onClick={() => setExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 uppercase text-[11px] mb-1.5">Select Report Type</label>
                <select
                  value={exportReportType}
                  onChange={(e) => setExportReportType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                >
                  <option value="product_movement">Product Movement Analysis (Period Inward, Outward & Balances)</option>
                  <option value="stock_summary">Live Warehouse Stock Summary</option>
                  <option value="low_stock">Low Stock & Safety Buffer Deficit Report</option>
                  <option value="out_of_stock">Out of Stock & Depleted SKUs</option>
                  <option value="slow_moving">Slow-Moving & Dormant Inventory</option>
                  <option value="category_summary">Category Distribution & Portfolio Breakdown</option>
                  <option value="stock_reconciliation">Full Stock Reconciliation Audit Ledger</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[11px] mb-1.5">Export Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportFormat('xlsx')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                      exportFormat === 'xlsx'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Microsoft Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                      exportFormat === 'csv'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Standard CSV (.csv)</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-[11px] leading-relaxed">
                Exports will strictly apply your currently active period (<strong>{workspace?.period?.display_label || 'All History'}</strong>) and category/variant/status filters.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={exporting}
                onClick={handleExecuteExport}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-600/25 disabled:opacity-50 cursor-pointer"
              >
                {exporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Generating file...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryAnalysis;
