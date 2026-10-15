import React, { useState, useEffect } from 'react';
import { api, API_BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ImportBatch } from '../types';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, RefreshCw, FileText, CheckCircle, FileUp } from 'lucide-react';

export const ExcelImportExport: React.FC = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState<string>('Stock Summary');
  const [asOpeningBalance, setAsOpeningBalance] = useState<boolean>(true);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [loadingImport, setLoadingImport] = useState<boolean>(false);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const fetchBatches = async () => {
    try {
      const res = await api.getImportBatches();
      setBatches(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewData(null);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoadingPreview(true);
    setErrorMsg(null);
    try {
      const res = await api.previewExcel(file, sheetName);
      setPreviewData(res.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to inspect Excel workbook.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!file) return;
    setLoadingImport(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.importExcel(file, sheetName, asOpeningBalance);
      setSuccessMsg(
        `Import successful! Batch #${res.data.batch_id} processed ${res.data.rows_imported} products with closing total of ${Number(res.data.total_closing_stock).toLocaleString()} units.`
      );
      setPreviewData(null);
      setFile(null);
      fetchBatches();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Import failed. Check reconciliation rules.');
    } finally {
      setLoadingImport(false);
    }
  };

  const handleExportStockSummary = async () => {
    try {
      const res = await api.exportAnalysisReport({ report_type: 'stock_summary', export_format: 'xlsx' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Stock_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export stock summary XLSX:', err);
      window.open(`${API_BASE_URL}/analysis/export?report_type=stock_summary&export_format=xlsx`, '_blank');
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.exportAnalysisReport({ report_type: 'stock_summary', export_format: 'csv' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Stock_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export stock summary CSV:', err);
      window.open(`${API_BASE_URL}/analysis/export?report_type=stock_summary&export_format=csv`, '_blank');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header and Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Excel Data Import & Reconciliation
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Ingest, inspect, validate, and export full inventory workbooks with mathematical parity checks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportStockSummary}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-emerald-200 rounded-xl text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel (.XLSX)</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Upload & Inspect Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-indigo-600" />
          <span>Upload Inventory Workbook (e.g. desktop.xlsx)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Select Excel File (.xlsx, .xls)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-xs sm:text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-xl bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Sheet Name</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="Stock Summary"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={asOpeningBalance}
              onChange={(e) => setAsOpeningBalance(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="text-xs sm:text-sm text-slate-700 font-medium">
              Treat Inward/Outward columns as initial opening balance
            </span>
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePreview}
              disabled={!file || loadingPreview}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 shadow-xs transition-colors cursor-pointer"
            >
              {loadingPreview ? 'Inspecting...' : 'Preview & Validate'}
            </button>

            {isAdmin && (
              <button
                onClick={handleExecuteImport}
                disabled={!file || loadingImport}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm shadow-indigo-600/30 disabled:opacity-40 transition-all cursor-pointer"
              >
                {loadingImport ? 'Executing Import...' : 'Confirm & Commit Import'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview Table & Discrepancy Reconciliation */}
      {previewData && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Workbook Pre-flight Analysis: {previewData.filename}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detected {previewData.product_count} product rows across {previewData.category_count} categories.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-lg font-mono font-medium">
                Inward: +{Number(previewData.total_inward).toLocaleString()}
              </span>
              <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-mono font-medium">
                Outward: -{Number(previewData.total_outward).toLocaleString()}
              </span>
              <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg font-mono font-bold">
                Closing: {Number(previewData.total_closing).toLocaleString()}
              </span>
            </div>
          </div>

          {previewData.warnings && previewData.warnings.length > 0 && (
            <div className="p-4 bg-amber-50 border-b border-amber-200/70">
              <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Reconciliation Warnings Detected ({previewData.warnings.length})</span>
              </h4>
              <ul className="text-xs text-amber-900 list-disc list-inside space-y-0.5 font-medium">
                {previewData.warnings.map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs shadow-xs">
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px] font-semibold">
                  <th className="py-2.5 px-3">Excel Row</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Item / Description</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Generated SKU</th>
                  <th className="py-2.5 px-3 text-right">Inward</th>
                  <th className="py-2.5 px-3 text-right">Outward</th>
                  <th className="py-2.5 px-3 text-right">Closing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {previewData.preview_rows?.slice(0, 100).map((r: any, idx: number) => {
                  const isCat = r.row_type === 'CATEGORY';
                  const isTot = r.row_type === 'TOTAL';
                  return (
                    <tr
                      key={idx}
                      className={
                        isTot
                          ? 'bg-slate-100 font-bold text-slate-900'
                          : isCat
                          ? 'bg-indigo-50/50 font-bold text-indigo-900'
                          : 'hover:bg-slate-50/80 font-medium'
                      }
                    >
                      <td className="py-2 px-3 text-slate-400">#{r.row_index}</td>
                      <td className="py-2 px-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            r.row_type === 'PRODUCT'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : r.row_type === 'CATEGORY'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {r.row_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-800">{r.item_name}</td>
                      <td className="py-2 px-3 font-sans text-slate-500">{r.category || '—'}</td>
                      <td className="py-2 px-3 text-indigo-700 font-semibold">{r.sku || '—'}</td>
                      <td className="py-2 px-3 text-right text-teal-700 font-medium tabular-nums">{r.inward_qty ?? '—'}</td>
                      <td className="py-2 px-3 text-right text-rose-600 font-medium tabular-nums">{r.outward_qty ?? '—'}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">{r.closing_qty ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {previewData.preview_rows?.length > 100 && (
            <div className="p-2.5 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
              Showing first 100 of {previewData.preview_rows.length} rows. Full dataset will be imported on commit.
            </div>
          )}
        </div>
      )}

      {/* Batch History Audit Trail */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <span>Audit Trail: Past Import Batches</span>
          </h3>
          <button
            onClick={fetchBatches}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-semibold">
                <th className="py-3 px-4">Batch ID</th>
                <th className="py-3 px-4">Filename</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Items Imported</th>
                <th className="py-3 px-4 text-right">Total Inward</th>
                <th className="py-3 px-4 text-right">Total Outward</th>
                <th className="py-3 px-4 text-right">Closing Units</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No import batches logged yet.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-700">#{b.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{b.filename}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{b.rows_imported}</td>
                    <td className="py-3 px-4 text-right font-mono text-teal-700 font-medium tabular-nums">
                      +{Number(b.total_inward).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 font-medium tabular-nums">
                      -{Number(b.total_outward).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {Number(b.total_closing).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          b.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : b.status === 'FAILED'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {b.status === 'COMPLETED' && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

