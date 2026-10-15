import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, ChevronDown, Boxes, ArrowRight, CornerDownLeft } from 'lucide-react';
import { Product } from '../types';

interface ProductSearchSelectProps {
  products: Product[];
  selectedProductId: number | '';
  onSelect: (productId: number | '') => void;
  disabled?: boolean;
  accentColor?: 'emerald' | 'rose' | 'indigo' | 'amber' | 'teal' | 'purple' | 'blue';
}

export const ProductSearchSelect: React.FC<ProductSearchSelectProps> = ({
  products,
  selectedProductId,
  onSelect,
  disabled = false,
  accentColor = 'teal',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === Number(selectedProductId)),
    [products, selectedProductId]
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Multi-term smart filtering across all attributes
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) {
      return products;
    }
    const words = searchTerm.trim().toLowerCase().split(/\s+/);
    return products.filter((p) => {
      const fullText = [
        p.sku,
        p.name,
        p.category,
        p.dimensions,
        p.colour_finish,
        p.thickness,
        p.length,
        p.unit,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return words.every((word) => fullText.includes(word));
    });
  }, [products, searchTerm]);

  // Reset highlight to top when search results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // Scroll active item into view during arrow key navigation
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-list-item]');
      const activeItem = items[highlightedIndex] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (productId: number) => {
    onSelect(productId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onSelect('');
    setSearchTerm('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredProducts.length > 0) {
        handleSelect(filteredProducts[highlightedIndex]?.id || filteredProducts[0].id);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape' && e.key !== 'Enter') {
      setIsOpen(true);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {selectedProduct && !isOpen ? (
        // Selected Product Card in crisp Light SaaS Theme
        <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-slate-400 transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
              <Boxes className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {selectedProduct.sku}
                </span>
                <span className="text-xs font-semibold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded">
                  {selectedProduct.category}
                </span>
                {selectedProduct.dimensions && (
                  <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                    {selectedProduct.dimensions}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-900 truncate mt-1">
                {selectedProduct.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Current Stock</span>
              <span
                className={`font-mono text-sm font-black tabular-nums ${
                  selectedProduct.current_quantity <= 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {selectedProduct.current_quantity} {selectedProduct.unit}
              </span>
            </div>

            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="px-3 py-1.5 text-xs bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-300 transition-colors font-semibold shadow-xs cursor-pointer"
            >
              Change
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleClear}
              title="Clear selection"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        // Live Search Input Box
        <div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              disabled={disabled}
              placeholder={
                selectedProduct
                  ? `Selected: ${selectedProduct.sku} — Type to search another SKU...`
                  : `Type SKU, Name, or Category (e.g. WPC, Brown, 7FT, MDF)...`
              }
              value={searchTerm}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onKeyUp={handleKeyUp}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-24 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs font-medium transition-all"
            />

            <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  title="Clear search text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 hidden sm:inline-block font-mono font-medium">
                {filteredProducts.length} items
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Instant Floating Results Menu */}
          {isOpen && (
            <div
              ref={listRef}
              className="absolute z-50 left-0 right-0 mt-1.5 max-h-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="p-2.5 bg-slate-50 sticky top-0 flex items-center justify-between text-xs text-slate-600 border-b border-slate-200 z-10 font-medium">
                <span className="font-semibold text-indigo-700">
                  {filteredProducts.length} matching product{filteredProducts.length === 1 ? '' : 's'}
                </span>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  Use <kbd className="px-1 py-0.5 bg-white rounded text-[10px] font-mono border border-slate-200">↑</kbd> <kbd className="px-1 py-0.5 bg-white rounded text-[10px] font-mono border border-slate-200">↓</kbd> and <kbd className="px-1 py-0.5 bg-white rounded text-[10px] font-mono border border-slate-200">Enter ↵</kbd>
                </span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  <p className="font-bold text-slate-700">No products match "{searchTerm}"</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Try searching by generic terms like <span className="text-indigo-600 font-semibold">Door</span>, <span className="text-indigo-600 font-semibold">Sheet</span>, <span className="text-indigo-600 font-semibold">Frame</span>, or dimension numbers.
                  </p>
                </div>
              ) : (
                filteredProducts.map((p, index) => {
                  const isSelected = p.id === Number(selectedProductId);
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <div
                      key={p.id}
                      data-list-item
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => handleSelect(p.id)}
                      className={`p-3 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                        isHighlighted
                          ? 'bg-indigo-50/80 text-indigo-950 border-l-4 border-indigo-600 pl-2'
                          : isSelected
                          ? 'bg-slate-100 text-slate-900 font-medium'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {p.sku}
                          </span>
                          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {p.category}
                          </span>
                          {p.dimensions && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              ({p.dimensions})
                            </span>
                          )}
                          {p.colour_finish && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              • {p.colour_finish}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-900 mt-1 leading-snug">
                          {p.name}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Stock</span>
                          <span
                            className={`font-mono text-xs font-bold tabular-nums ${
                              p.current_quantity <= 0 ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            {p.current_quantity} {p.unit}
                          </span>
                        </div>

                        {isHighlighted ? (
                          <CornerDownLeft className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : isSelected ? (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductSearchSelect;
