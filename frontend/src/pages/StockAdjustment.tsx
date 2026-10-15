import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, CheckCircle2, AlertCircle, Layers, Calendar, Hash, FileText, AlertTriangle, Scale } from 'lucide-react';
import api from '../api/client';
import { Product } from '../types';
import { ProductSearchSelect } from '../components/ProductSearchSelect';

export const StockAdjustment: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [mode, setMode] = useState<'delta' | 'counted'>('delta');
  const [deltaQuantity, setDeltaQuantity] = useState<string>('');
  const [countedQuantity, setCountedQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const res = await api.get('/products?page=1&page_size=500');
        setProducts(res.data.items);
      } catch (err: any) {
        setErrorMessage(err.response?.data?.detail || 'Failed to load products');
      }
    };
    fetchAllProducts();
  }, []);

  const selectedProduct = products.find((p) => p.id === Number(selectedProductId));
  const currentQty = selectedProduct ? Number(selectedProduct.current_quantity) : 0;

  // Compute effective delta
  let effectiveDelta = 0;
  if (selectedProduct) {
    if (mode === 'delta') {
      effectiveDelta = parseFloat(deltaQuantity) || 0;
    } else {
      const counted = parseFloat(countedQuantity);
      if (!isNaN(counted)) {
        effectiveDelta = counted - currentQty;
      }
    }
  }

  const projectedBalance = selectedProduct
    ? currentQty + effectiveDelta
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setErrorMessage('Please select a product.');
      return;
    }
    if (effectiveDelta === 0) {
      setErrorMessage('Adjustment quantity cannot be zero.');
      return;
    }
    if (!reason || reason.trim().length < 3) {
      setErrorMessage('Mandatory reason required for audit tracking (min 3 characters).');
      return;
    }
    if (projectedBalance !== null && projectedBalance < 0) {
      setErrorMessage(`Adjustment would cause negative balance (${projectedBalance.toLocaleString()}). Operation blocked.`);
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await api.post('/inventory/adjustment', {
        product_id: Number(selectedProductId),
        quantity: effectiveDelta,
        reason: reason.trim(),
        transaction_date: new Date(date).toISOString(),
        reference_number: reference || undefined,
        remarks: remarks || undefined
      });

      setSuccessMessage(
        `Adjustment posted! SKU: ${res.data.product_sku}. Delta: ${effectiveDelta > 0 ? '+' : ''}${effectiveDelta.toLocaleString()}. New Balance: ${Number(res.data.current_balance_after).toLocaleString()} units. Reason: ${reason}`
      );

      setProducts((prev) =>
        prev.map((p) =>
          p.id === Number(selectedProductId)
            ? { ...p, current_quantity: res.data.current_balance_after }
            : p
        )
      );
      setDeltaQuantity('');
      setCountedQuantity('');
      setReason('');
      setReference('');
      setRemarks('');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to post adjustment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shadow-xs">
          <SlidersHorizontal className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Stock Adjustment & Physical Audit
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Perform authorized stock corrections following physical cycle counts, scrap declarations, or discrepancy reconciliation.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 text-xs sm:text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-xs sm:text-sm font-medium">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/70 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('delta')}
              className={`flex-1 py-2 rounded-lg transition-all ${
                mode === 'delta'
                  ? 'bg-white text-purple-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quantity Delta (+ / -)
            </button>
            <button
              type="button"
              onClick={() => setMode('counted')}
              className={`flex-1 py-2 rounded-lg transition-all ${
                mode === 'counted'
                  ? 'bg-white text-purple-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Physical Counted Balance
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Select Product / Variant *
              </label>
              <ProductSearchSelect
                products={products}
                selectedProductId={selectedProductId}
                onSelect={(id) => setSelectedProductId(id)}
                accentColor="purple"
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mode === 'delta' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Delta Quantity (+ / -) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. +10 or -5"
                    value={deltaQuantity}
                    onChange={(e) => setDeltaQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-purple-700 placeholder-slate-400 font-mono focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Actual Counted Stock *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="Counted units on shelf"
                    value={countedQuantity}
                    onChange={(e) => setCountedQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-purple-700 placeholder-slate-400 font-mono focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Mandatory Reason for Adjustment *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Physical inventory count discrepancy, Water damaged, Return restock"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" /> Audit Ref / Memo #
                </label>
                <input
                  type="text"
                  placeholder="e.g. AUDIT-2026-Q3"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 font-mono focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" /> Additional Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional context..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedProductId || effectiveDelta === 0 || !reason}
              className="w-full py-3 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm shadow-purple-700/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{isSubmitting ? 'Posting Adjustment...' : 'Confirm & Post Adjustment'}</span>
            </button>
          </form>
        </div>

        {/* Live Balance Summary Panel (Fully Colored Purple) */}
        <div className="bg-gradient-to-br from-purple-700 to-purple-800 text-white p-6 rounded-2xl shadow-md border border-purple-600/50 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-bold text-purple-100 uppercase tracking-wider mb-4 pb-2 border-b border-purple-600/60 flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-200" />
              Live Stock Projection
            </h3>

            {selectedProduct ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] text-purple-200 uppercase font-semibold">Selected SKU</span>
                  <p className="font-mono text-xs font-semibold text-white truncate">{selectedProduct.sku}</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{selectedProduct.name}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-purple-900/40 border border-purple-500/40 space-y-2.5 backdrop-blur-xs">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-purple-200">Current Ledger:</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {currentQty.toLocaleString()} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-purple-200">Adjustment Delta:</span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        effectiveDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {effectiveDelta > 0 ? `+${effectiveDelta.toLocaleString()}` : effectiveDelta.toLocaleString()} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-purple-600/60 flex justify-between text-xs sm:text-sm">
                    <span className="text-white font-semibold">New Adjusted Balance:</span>
                    <span
                      className={`font-mono font-extrabold text-base tabular-nums ${
                        projectedBalance !== null && projectedBalance < 0
                          ? 'text-rose-300'
                          : 'text-white'
                      }`}
                    >
                      {projectedBalance !== null ? projectedBalance.toLocaleString() : '—'} {selectedProduct.unit}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-purple-100 space-y-1">
                  <p>• Mandatory reason saved to audit ledger</p>
                  <p>• Logged under active authenticated user</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-purple-200/70 text-xs">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50 text-purple-200" />
                Select a product to preview adjustment calculations.
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-purple-900/50 border border-purple-500/30 text-[11px] text-purple-200 font-mono">
            Adjustments maintain full auditability without silent balance editing.
          </div>
        </div>
      </div>
    </div>
  );
};

