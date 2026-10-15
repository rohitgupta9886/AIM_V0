import React, { useState, useEffect } from 'react';
import { ArrowUpFromLine, CheckCircle2, AlertTriangle, AlertCircle, Layers, Calendar, Hash, FileText, PackageMinus } from 'lucide-react';
import api from '../api/client';
import { Product } from '../types';
import { ProductSearchSelect } from '../components/ProductSearchSelect';

export const OutwardStock: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [allowNegativeOverride, setAllowNegativeOverride] = useState(false);

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
  const parsedQty = parseFloat(quantity) || 0;
  const currentQty = selectedProduct ? Number(selectedProduct.current_quantity) : 0;
  const projectedBalance = selectedProduct
    ? currentQty - parsedQty
    : null;

  const isInsufficient = selectedProduct && parsedQty > currentQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !quantity || parsedQty <= 0) {
      setErrorMessage('Please select a product and enter a positive dispatch quantity.');
      return;
    }

    if (isInsufficient && !allowNegativeOverride) {
      setErrorMessage(
        `Insufficient stock! Available: ${currentQty.toLocaleString()} ${selectedProduct.unit}. Requested: ${parsedQty.toLocaleString()} ${selectedProduct.unit}. Enable administrator override checkbox if authorized.`
      );
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await api.post('/inventory/outward', {
        product_id: Number(selectedProductId),
        quantity: parsedQty,
        transaction_date: new Date(date).toISOString(),
        reference_number: reference || undefined,
        remarks: remarks || undefined,
        allow_negative_override: allowNegativeOverride
      });

      setSuccessMessage(
        `Stock outward dispatched successfully! SKU: ${res.data.product_sku}. Remaining Balance: ${Number(res.data.current_balance_after).toLocaleString()} units. Ref: ${res.data.reference_number || 'N/A'}`
      );
      // Update local product balance
      setProducts((prev) =>
        prev.map((p) =>
          p.id === Number(selectedProductId)
            ? { ...p, current_quantity: res.data.current_balance_after }
            : p
        )
      );
      setQuantity('');
      setReference('');
      setRemarks('');
      setAllowNegativeOverride(false);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to dispatch outward stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shadow-xs">
          <ArrowUpFromLine className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Stock Outward Dispatch
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Issue inventory for client sales, delivery, or processing. Enforces real-time balance checks and blocks accidental negative stock.
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
        {/* Form Container */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Select Product / Variant *
              </label>
              <ProductSearchSelect
                products={products}
                selectedProductId={selectedProductId}
                onSelect={(id) => setSelectedProductId(id)}
                accentColor="blue"
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Outward Quantity *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="Enter dispatch quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold placeholder-slate-400 font-mono transition-all border ${
                    isInsufficient
                      ? 'bg-rose-50/50 border-rose-300 text-rose-700 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'bg-slate-50 border-slate-200 text-blue-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" /> Dispatch Reference / Delivery Challan
              </label>
              <input
                type="text"
                placeholder="e.g. DC-2026-901, SO-5100"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 font-mono focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> Customer / Destination / Remarks
              </label>
              <textarea
                rows={2}
                placeholder="Client name, transport vehicle, destination..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
            </div>

            {isInsufficient && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2.5">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Insufficient Stock Warning</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Requested quantity ({parsedQty.toLocaleString()}) exceeds available balance ({currentQty.toLocaleString()}).
                  The system prevents negative balances by default to protect audit integrity.
                </p>
                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={allowNegativeOverride}
                    onChange={(e) => setAllowNegativeOverride(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <span className="text-xs text-amber-950 font-semibold">
                    Administrator Override (Permit Negative Balance)
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !selectedProductId || !quantity || (isInsufficient && !allowNegativeOverride)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              <span>{isSubmitting ? 'Posting Dispatch...' : 'Confirm & Post Outward'}</span>
            </button>
          </form>
        </div>

        {/* Live Balance Summary Panel (Fully Colored Blue) */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-800 text-white p-6 rounded-2xl shadow-md border border-blue-600/50 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-bold text-blue-100 uppercase tracking-wider mb-4 pb-2 border-b border-blue-600/60 flex items-center gap-2">
              <PackageMinus className="w-4 h-4 text-blue-200" />
              Live Stock Projection
            </h3>

            {selectedProduct ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] text-blue-200 uppercase font-semibold">Selected SKU</span>
                  <p className="font-mono text-xs font-semibold text-white truncate">{selectedProduct.sku}</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{selectedProduct.name}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-900/40 border border-blue-500/40 space-y-2.5 backdrop-blur-xs">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-blue-200">Current Balance:</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {currentQty.toLocaleString()} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-blue-200">- Outward Quantity:</span>
                    <span className="font-mono font-bold text-blue-200 tabular-nums">
                      -{parsedQty.toLocaleString()} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-blue-600/60 flex justify-between text-xs sm:text-sm">
                    <span className="text-white font-semibold">Remaining Balance:</span>
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

                <div className="text-xs text-blue-100 space-y-1">
                  <p>• Category: <span className="font-medium text-white">{selectedProduct.category}</span></p>
                  <p>• Threshold: <span className="font-medium text-white">{selectedProduct.minimum_stock} {selectedProduct.unit}</span></p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-blue-200/70 text-xs">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50 text-blue-200" />
                Select a product to view real-time balance calculations.
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-blue-900/50 border border-blue-500/30 text-[11px] text-blue-200 font-mono">
            Insufficient stock is blocked by PostgreSQL row lock and validation.
          </div>
        </div>
      </div>
    </div>
  );
};

