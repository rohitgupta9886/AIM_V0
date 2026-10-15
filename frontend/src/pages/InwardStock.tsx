import React, { useState, useEffect } from 'react';
import { ArrowDownToLine, CheckCircle2, AlertCircle, Layers, Calendar, Hash, FileText, PackagePlus } from 'lucide-react';
import api from '../api/client';
import { Product } from '../types';
import { ProductSearchSelect } from '../components/ProductSearchSelect';

export const InwardStock: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<string>('');
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
  const projectedBalance = selectedProduct
    ? Number(selectedProduct.current_quantity) + (parseFloat(quantity) || 0)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !quantity || parseFloat(quantity) <= 0) {
      setErrorMessage('Please select a product and enter a positive quantity.');
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await api.post('/inventory/inward', {
        product_id: Number(selectedProductId),
        quantity: parseFloat(quantity),
        transaction_date: new Date(date).toISOString(),
        reference_number: reference || undefined,
        remarks: remarks || undefined
      });

      setSuccessMessage(
        `Inward posted successfully! SKU: ${res.data.product_sku}. New Balance: ${Number(res.data.current_balance_after).toLocaleString()} units. Ref: ${res.data.reference_number || 'N/A'}`
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
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to post inward transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shadow-xs">
          <ArrowDownToLine className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Stock Inward Receipt
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Record incoming goods received from factory production or suppliers with row-level locked PostgreSQL balance updates.
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
            {/* SKU Search Combobox */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Select Product / Variant *
              </label>
              <ProductSearchSelect
                products={products}
                selectedProductId={selectedProductId}
                onSelect={(id) => setSelectedProductId(id)}
                accentColor="teal"
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Inward Quantity *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="Enter received units"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-teal-800 font-bold placeholder-slate-400 font-mono focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" /> Reference / Invoice #
              </label>
              <input
                type="text"
                placeholder="e.g. GRN-2026-0881, INV-449"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 font-mono focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> Remarks / Notes
              </label>
              <textarea
                rows={2}
                placeholder="Batch info, delivery remarks, condition..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedProductId || !quantity}
              className="w-full py-3 bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm shadow-teal-700/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>{isSubmitting ? 'Posting Transaction...' : 'Confirm & Post Inward'}</span>
            </button>
          </form>
        </div>

        {/* Live Balance Summary Panel (Fully Colored Teal) */}
        <div className="bg-gradient-to-br from-teal-700 to-teal-800 text-white p-6 rounded-2xl shadow-md border border-teal-600/50 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-bold text-teal-100 uppercase tracking-wider mb-4 pb-2 border-b border-teal-600/60 flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-teal-200" />
              Live Stock Projection
            </h3>

            {selectedProduct ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] text-teal-200 uppercase font-semibold">Selected SKU</span>
                  <p className="font-mono text-xs font-semibold text-white truncate">{selectedProduct.sku}</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{selectedProduct.name}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-teal-900/40 border border-teal-500/40 space-y-2.5 backdrop-blur-xs">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-teal-200">Current Balance:</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {Number(selectedProduct.current_quantity).toLocaleString()} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-teal-200">+ Inward Quantity:</span>
                    <span className="font-mono font-bold text-teal-200 tabular-nums">
                      +{parseFloat(quantity) || 0} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-teal-600/60 flex justify-between text-xs sm:text-sm">
                    <span className="text-white font-semibold">New Balance:</span>
                    <span className="font-mono font-extrabold text-white text-base tabular-nums">
                      {projectedBalance !== null ? projectedBalance.toLocaleString() : '—'} {selectedProduct.unit}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-teal-100 space-y-1">
                  <p>• Category: <span className="font-medium text-white">{selectedProduct.category}</span></p>
                  <p>• Threshold: <span className="font-medium text-white">{selectedProduct.minimum_stock} {selectedProduct.unit}</span></p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-teal-200/70 text-xs">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50 text-teal-200" />
                Select a product to view real-time balance calculations.
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-teal-900/50 border border-teal-500/30 text-[11px] text-teal-200 font-mono">
            Transaction is posted atomically to PostgreSQL with row-level locking.
          </div>
        </div>
      </div>
    </div>
  );
};

