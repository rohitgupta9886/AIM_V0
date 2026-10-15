import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  Filter,
  Plus,
  Edit2,
  Power,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  PackageX,
  X,
  Layers,
  Sparkles,
  ArrowUpDown,
  FolderPlus,
  Trash2,
  Check,
  Tags,
  RefreshCw
} from 'lucide-react';
import api from '../api/client';
import { Product, PaginatedProducts, ProductCategory } from '../types';
import { useAuth } from '../context/AuthContext';

export const Catalogue: React.FC = () => {
  const { isAdmin } = useAuth();
  const [productsData, setProductsData] = useState<PaginatedProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockStatus, setStockStatus] = useState('ALL');
  const [filters, setFilters] = useState<any>({ categories: [] });

  // Category CRUD State
  const [categoriesList, setCategoriesList] = useState<ProductCategory[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySuccess, setCategorySuccess] = useState<string | null>(null);
  const [isCatSubmitting, setIsCatSubmitting] = useState(false);

  // Category inline edit & delete state
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [deletingCat, setDeletingCat] = useState<ProductCategory | null>(null);
  const [reassignTarget, setReassignTarget] = useState('');

  // Modal State for Add / Edit Product Variant
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    unit: 'Pcs',
    thickness: '',
    colour_finish: '',
    dimensions: '',
    length: '',
    minimum_stock: 5.0,
    opening_stock: 0.0
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchFilters = async () => {
    try {
      const res = await api.get('/products/filters');
      setFilters(res.data);
    } catch (e) {}
  };

  const fetchCategoriesList = async () => {
    try {
      const res = await api.getCategories();
      setCategoriesList(res.data || []);
    } catch (e) {
      console.error('Failed to load categories', e);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        page_size: 20,
        sort_by: 'name',
        sort_dir: 'asc'
      };
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      if (stockStatus !== 'ALL') params.stock_status = stockStatus;

      const res = await api.get('/products', { params });
      setProductsData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
    fetchCategoriesList();
  }, []);

  // Category CRUD Handlers
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      setCategoryError('Category name cannot be empty.');
      return;
    }
    setCategoryError(null);
    setCategorySuccess(null);
    setIsCatSubmitting(true);
    try {
      const res = await api.createCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim() || undefined
      });
      const created = res.data;
      setNewCatName('');
      setNewCatDesc('');
      setCategorySuccess(`Category "${created.name}" created and selected!`);
      await fetchCategoriesList();
      fetchFilters();
      // Auto-select in variant form
      setFormData((prev) => ({ ...prev, category: created.name }));
    } catch (err: any) {
      setCategoryError(err.response?.data?.detail || 'Failed to create category');
    } finally {
      setIsCatSubmitting(false);
    }
  };

  const handleStartEditCat = (cat: ProductCategory) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description || '');
    setCategoryError(null);
    setCategorySuccess(null);
  };

  const handleSaveEditCat = async (catId: number) => {
    if (!editCatName.trim()) {
      setCategoryError('Category name cannot be empty.');
      return;
    }
    setIsCatSubmitting(true);
    setCategoryError(null);
    try {
      const res = await api.updateCategory(catId, {
        name: editCatName.trim(),
        description: editCatDesc.trim() || undefined
      });
      const updated = res.data;
      const oldCat = categoriesList.find((c) => c.id === catId);
      if (formData.category === oldCat?.name) {
        setFormData((prev) => ({ ...prev, category: updated.name }));
      }
      setEditingCatId(null);
      setCategorySuccess(`Category renamed to "${updated.name}" successfully!`);
      await fetchCategoriesList();
      fetchFilters();
      fetchProducts();
    } catch (err: any) {
      setCategoryError(err.response?.data?.detail || 'Failed to update category');
    } finally {
      setIsCatSubmitting(false);
    }
  };

  const handlePromptDeleteCat = (cat: ProductCategory) => {
    setCategoryError(null);
    setCategorySuccess(null);
    if (cat.product_count === 0) {
      if (window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
        confirmDeleteCat(cat.id);
      }
    } else {
      setDeletingCat(cat);
      const remaining = categoriesList.filter((c) => c.id !== cat.id);
      setReassignTarget(remaining.length > 0 ? remaining[0].name : '');
    }
  };

  const confirmDeleteCat = async (catId: number, reassignTo?: string) => {
    setIsCatSubmitting(true);
    setCategoryError(null);
    try {
      const res = await api.deleteCategory(catId, reassignTo);
      const targetCat = categoriesList.find((c) => c.id === catId);
      if (formData.category === targetCat?.name) {
        const fallback = reassignTo || (categoriesList.find((c) => c.id !== catId)?.name || '');
        setFormData((prev) => ({ ...prev, category: fallback }));
      }
      setDeletingCat(null);
      setCategorySuccess(res.data?.message || 'Category deleted successfully');
      await fetchCategoriesList();
      fetchFilters();
      fetchProducts();
    } catch (err: any) {
      setCategoryError(err.response?.data?.detail || 'Failed to delete category');
    } finally {
      setIsCatSubmitting(false);
    }
  };

  // Reset page when search term changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Instant live search: updates just after typing / releasing keypad button (100ms debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 100);
    return () => clearTimeout(timer);
  }, [search, page, category, stockStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    const defaultCat = categoriesList.length > 0
      ? categoriesList[0].name
      : (filters.categories[0] || 'WPC Door');
    setFormData({
      sku: '',
      name: '',
      category: defaultCat,
      unit: 'Pcs',
      thickness: '',
      colour_finish: '',
      dimensions: '',
      length: '',
      minimum_stock: 5.0,
      opening_stock: 0.0
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    setFormData({
      sku: prod.sku,
      name: prod.name,
      category: prod.category,
      unit: prod.unit,
      thickness: prod.thickness || '',
      colour_finish: prod.colour_finish || '',
      dimensions: prod.dimensions || '',
      length: prod.length || '',
      minimum_stock: prod.minimum_stock,
      opening_stock: 0.0
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleToggleActive = async (id: number) => {
    try {
      await api.patch(`/products/${id}/toggle-active`);
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to toggle product status');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || !formData.name || !formData.category) {
      setModalError('SKU, Name, and Category are required fields.');
      return;
    }
    setModalError(null);
    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, {
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          thickness: formData.thickness || null,
          colour_finish: formData.colour_finish || null,
          dimensions: formData.dimensions || null,
          length: formData.length || null,
          minimum_stock: Number(formData.minimum_stock)
        });
      } else {
        await api.post('/products', {
          ...formData,
          minimum_stock: Number(formData.minimum_stock),
          opening_stock: Number(formData.opening_stock)
        });
      }
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      setModalError(err.response?.data?.detail || 'Error saving product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Product Catalogue & Variants
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Browse and manage all 204 independently stocked SKUs, variant specifications, and thresholds.
              </p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm shadow-indigo-600/30 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        )}
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
              placeholder="Instant search by SKU, Name, Finish, Thickness, Dimensions..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
            >
              <option value="">All Categories</option>
              {filters.categories.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Dropdown */}
          <select
            value={stockStatus}
            onChange={(e) => {
              setStockStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="NORMAL">Normal Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Products Presentation (Desktop Table + Mobile Cards) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Desktop / Tablet Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">SKU Code</th>
                <th className="py-3.5 px-4">Product Variant Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Variant Specs</th>
                <th className="py-3.5 px-4 text-right">Current Stock</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                {isAdmin && <th className="py-3.5 px-4 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="mt-2 text-xs font-medium text-slate-500">Loading catalogue...</p>
                  </td>
                </tr>
              ) : productsData && productsData.items.length > 0 ? (
                productsData.items.map((prod) => (
                  <tr
                    key={prod.id}
                    className={`hover:bg-slate-50/80 transition-colors ${!prod.active ? 'opacity-50 bg-slate-50/30' : ''}`}
                  >
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-semibold text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded-md border border-indigo-100 text-xs inline-block">
                        {prod.sku}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 block">{prod.name}</span>
                      {prod.original_description && prod.original_description !== prod.name && (
                        <span className="text-[11px] text-slate-500 block truncate max-w-xs mt-0.5">
                          {prod.original_description}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                        {prod.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {prod.thickness && (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 text-[11px] font-medium">
                            {prod.thickness}
                          </span>
                        )}
                        {prod.dimensions && (
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/60 font-mono text-[11px] font-medium">
                            {prod.dimensions}
                          </span>
                        )}
                        {prod.colour_finish && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60 text-[11px] font-medium">
                            {prod.colour_finish}
                          </span>
                        )}
                        {prod.length && (
                          <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200/60 font-mono text-[11px] font-medium">
                            {prod.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums">
                      <span
                        className={
                          Number(prod.current_quantity) <= 0
                            ? 'text-rose-600'
                            : Number(prod.current_quantity) <= Number(prod.minimum_stock)
                            ? 'text-amber-600'
                            : 'text-slate-900'
                        }
                      >
                        {Number(prod.current_quantity).toLocaleString()}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-1.5 font-normal font-sans">{prod.unit}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {prod.stock_status === 'NORMAL' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Normal
                        </span>
                      )}
                      {prod.stock_status === 'LOW_STOCK' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
                        </span>
                      )}
                      {prod.stock_status === 'OUT_OF_STOCK' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium">
                          <PackageX className="w-3.5 h-3.5" /> Out of Stock
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(prod)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(prod.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              prod.active
                                ? 'bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                            title={prod.active ? 'Deactivate Product' : 'Reactivate Product'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    No products found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Card View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="inline-block w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="mt-2 text-xs font-medium text-slate-500">Loading catalogue...</p>
            </div>
          ) : productsData && productsData.items.length > 0 ? (
            productsData.items.map((prod) => (
              <div key={prod.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs inline-block mb-1 border border-indigo-100">
                      {prod.sku}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">{prod.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{prod.category}</p>
                  </div>
                  <div>
                    {prod.stock_status === 'NORMAL' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                        <CheckCircle className="w-3 h-3" /> Normal
                      </span>
                    )}
                    {prod.stock_status === 'LOW_STOCK' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                        <AlertTriangle className="w-3 h-3" /> Low Stock
                      </span>
                    )}
                    {prod.stock_status === 'OUT_OF_STOCK' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium">
                        <PackageX className="w-3 h-3" /> Out of Stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Variant Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {prod.thickness && (
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 text-[11px] font-medium">
                      {prod.thickness}
                    </span>
                  )}
                  {prod.dimensions && (
                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/60 font-mono text-[11px] font-medium">
                      {prod.dimensions}
                    </span>
                  )}
                  {prod.colour_finish && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60 text-[11px] font-medium">
                      {prod.colour_finish}
                    </span>
                  )}
                  {prod.length && (
                    <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200/60 font-mono text-[11px] font-medium">
                      {prod.length}
                    </span>
                  )}
                </div>

                {/* Mobile Stock & Action bar */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-slate-500">Current Stock:</span>
                    <span
                      className={`font-mono font-bold tabular-nums text-sm ${
                        Number(prod.current_quantity) <= 0
                          ? 'text-rose-600'
                          : Number(prod.current_quantity) <= Number(prod.minimum_stock)
                          ? 'text-amber-600'
                          : 'text-slate-900'
                      }`}
                    >
                      {Number(prod.current_quantity).toLocaleString()} {prod.unit}
                    </span>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(prod)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-16 text-center text-slate-400">
              No products found matching the criteria.
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {productsData && productsData.total_pages > 1 && (
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-600 bg-slate-50/50">
            <span>
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, productsData.total)} of {productsData.total} items
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-slate-700 font-medium px-2">
                Page {page} of {productsData.total_pages}
              </span>
              <button
                disabled={page >= productsData.total_pages}
                onClick={() => setPage((p) => Math.min(p + 1, productsData.total_pages))}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingProduct ? 'Edit Product Variant' : 'Add New Product Variant'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Enter SKU and dimensional specifications for independently stocked inventory.
            </p>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    disabled={!!editingProduct}
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="e.g. WPC-D-25MM-72X24-IVORY"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryError(null);
                        setCategorySuccess(null);
                        setShowCategoryModal(true);
                      }}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer transition-colors"
                      title="Manage categories (create, edit, delete)"
                    >
                      <FolderPlus className="w-3.5 h-3.5" /> Manage Categories
                    </button>
                  </div>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      if (e.target.value === '__MANAGE__') {
                        setCategoryError(null);
                        setCategorySuccess(null);
                        setShowCategoryModal(true);
                      } else {
                        setFormData({ ...formData, category: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {categoriesList.length > 0 ? (
                      categoriesList.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name} ({cat.product_count} variant{cat.product_count === 1 ? '' : 's'})
                        </option>
                      ))
                    ) : (
                      (filters.categories || []).map((catName: string) => (
                        <option key={catName} value={catName}>
                          {catName}
                        </option>
                      ))
                    )}
                    <option value="__MANAGE__" className="font-semibold text-indigo-600 bg-indigo-50">
                      + Add / Manage Categories...
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. 25MM Ivory 72X24"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Thickness
                  </label>
                  <input
                    type="text"
                    value={formData.thickness}
                    onChange={(e) => setFormData({ ...formData, thickness: e.target.value })}
                    placeholder="25MM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Dimensions
                  </label>
                  <input
                    type="text"
                    value={formData.dimensions}
                    onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                    placeholder="72X24"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Length
                  </label>
                  <input
                    type="text"
                    value={formData.length}
                    onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                    placeholder="7FT"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Colour / Finish
                  </label>
                  <input
                    type="text"
                    value={formData.colour_finish}
                    onChange={(e) => setFormData({ ...formData, colour_finish: e.target.value })}
                    placeholder="Ivory / Teak / Walnut"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Minimum Stock Alert
                  </label>
                  <input
                    type="number"
                    value={formData.minimum_stock}
                    onChange={(e) => setFormData({ ...formData, minimum_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {!editingProduct && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Opening Stock Quantity
                  </label>
                  <input
                    type="number"
                    value={formData.opening_stock}
                    onChange={(e) => setFormData({ ...formData, opening_stock: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm shadow-indigo-600/30 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category CRUD Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-xl p-6 rounded-2xl border border-slate-200 shadow-2xl relative flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Manage Product Categories</h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700">
                      {categoriesList.length} Categories
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Create new categories, rename across all variants, or safely delete unused ones.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCatId(null);
                  setDeletingCat(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification messages */}
            {categorySuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between animate-in fade-in duration-150">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  {categorySuccess}
                </span>
                <button type="button" onClick={() => setCategorySuccess(null)} className="text-emerald-500 hover:text-emerald-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {categoryError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between animate-in fade-in duration-150">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  {categoryError}
                </span>
                <button type="button" onClick={() => setCategoryError(null)} className="text-rose-500 hover:text-rose-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Create New Category Card */}
            <form onSubmit={handleCreateCategory} className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-600" /> Add New Category
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Category Name *"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="Optional Description"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="sm:col-span-1">
                  <button
                    type="submit"
                    disabled={isCatSubmitting || !newCatName.trim()}
                    className="w-full h-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs disabled:opacity-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
            </form>

            {/* Existing Categories List */}
            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Active Categories
                </h4>
                <button
                  type="button"
                  onClick={fetchCategoriesList}
                  className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Refresh categories"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              <div className="space-y-2">
                {categoriesList.map((cat) => {
                  const isEditing = editingCatId === cat.id;
                  const isDeleting = deletingCat?.id === cat.id;

                  if (isEditing) {
                    return (
                      <div key={cat.id} className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-2">
                        <div className="text-[11px] font-semibold text-indigo-900">
                          Editing "{cat.name}" ({cat.product_count} linked variants)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            placeholder="Category Name"
                            className="px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <input
                            type="text"
                            value={editCatDesc}
                            onChange={(e) => setEditCatDesc(e.target.value)}
                            placeholder="Description"
                            className="px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isCatSubmitting || !editCatName.trim()}
                            onClick={() => handleSaveEditCat(cat.id)}
                            className="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                          >
                            <Check className="w-3 h-3" /> Save Changes
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (isDeleting) {
                    const candidateTargets = categoriesList.filter((c) => c.id !== cat.id);
                    return (
                      <div key={cat.id} className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          Reassign {cat.product_count} Products Before Deleting "{cat.name}"
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          This category is currently assigned to {cat.product_count} product variants.
                          Select a target category to reassign them to before deletion:
                        </p>
                        <div className="flex items-center gap-2">
                          <select
                            value={reassignTarget}
                            onChange={(e) => setReassignTarget(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium text-slate-900"
                          >
                            {candidateTargets.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setDeletingCat(null)}
                            className="px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isCatSubmitting || !reassignTarget}
                            onClick={() => confirmDeleteCat(cat.id, reassignTarget)}
                            className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Reassign & Delete
                          </button>
                        </div>
                      </div>
                    );
                  }

                  const isSelectedInForm = formData.category === cat.name;

                  return (
                    <div
                      key={cat.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        isSelectedInForm
                          ? 'bg-indigo-50/40 border-indigo-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-slate-900">{cat.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              cat.product_count > 0
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {cat.product_count} variant{cat.product_count === 1 ? '' : 's'}
                          </span>
                          {isSelectedInForm && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                              Selected
                            </span>
                          )}
                        </div>
                        {cat.description && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{cat.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, category: cat.name }));
                            setShowCategoryModal(false);
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isSelectedInForm
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700'
                          }`}
                          title="Select this category for product variant"
                        >
                          {isSelectedInForm ? 'Selected' : 'Use'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditCat(cat)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Rename or edit category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePromptDeleteCat(cat)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={cat.product_count > 0 ? "Delete with reassign" : "Delete category"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {categoriesList.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No categories found. Create one above to get started.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Currently selected: <span className="font-semibold text-slate-800">{formData.category || 'None'}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCatId(null);
                  setDeletingCat(null);
                }}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

