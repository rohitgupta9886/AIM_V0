import axios, { AxiosInstance } from 'axios';

interface CustomAxiosInstance extends AxiosInstance {
  getLowStock?: (threshold?: number) => Promise<any>;
  getCategoryStock?: () => Promise<any>;
  getProducts?: (params?: any) => Promise<any>;
  getProductDatedMovement?: (productId: number) => Promise<any>;
  getImportBatches?: () => Promise<any>;
  previewExcel?: (file: File, sheetName?: string) => Promise<any>;
  importExcel?: (file: File, sheetName?: string, asOpeningBalance?: boolean) => Promise<any>;
  getUsers?: () => Promise<any>;
  createUser?: (data: any) => Promise<any>;
  getCategories?: () => Promise<any>;
  createCategory?: (data: { name: string; description?: string }) => Promise<any>;
  updateCategory?: (id: number, data: { name?: string; description?: string }) => Promise<any>;
  getAnalyticsWorkspace?: (params?: any) => Promise<any>;
  getProductMovementTable?: (params?: any) => Promise<any>;
  exportAnalysisReport?: (params: any) => Promise<any>;
  getAnalysisFilterOptions?: () => Promise<any>;
  deleteCategory?: (id: number, reassign_to?: string) => Promise<any>;
}

const api: CustomAxiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth-logout'));
      }
    }
    return Promise.reject(error);
  }
);

// Convenience methods
api.getAnalyticsWorkspace = (params?: any) => api.get('/analysis/workspace', { params });
api.getProductMovementTable = (params?: any) => api.get('/analysis/movement-table', { params });
api.exportAnalysisReport = (params: any) => api.get('/analysis/export', { params, responseType: 'blob' });
api.getAnalysisFilterOptions = () => api.get('/analysis/filter-options');
api.getLowStock = (threshold?: number) => api.get('/analysis/low-stock');
api.getCategoryStock = () => api.get('/analysis/category-stock');
api.getProducts = (params?: any) => api.get('/products', { params });
api.getProductDatedMovement = (productId: number) =>
  api.get('/analysis/product-movement', { params: { product_id: productId } }).then((res) => ({
    data: { transactions: res.data },
  }));
api.getImportBatches = () =>
  api.get('/import/history').then((res) => ({
    data: res.data.map((b: any) => ({
      ...b,
      created_at: b.imported_at,
      rows_imported: b.imported_count,
      status: b.error_count > 0 ? 'WARNING' : 'COMPLETED',
      total_inward: b.reconciliation_data?.grand_total_inwards ?? 0,
      total_outward: b.reconciliation_data?.grand_total_outwards ?? 0,
      total_closing: b.reconciliation_data?.grand_total_closing ?? 0,
    })),
  }));
api.previewExcel = (file: File, sheetName?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  if (sheetName) formData.append('sheet_name', sheetName);
  return api.post('/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => {
    const data = res.data;
    return {
      data: {
        filename: data.filename,
        sheet_name: data.sheet_name,
        product_count: data.product_rows_count,
        category_count: data.category_rows_count,
        total_inward: data.reconciliation?.grand_total_inwards,
        total_outward: data.reconciliation?.grand_total_outwards,
        total_closing: data.reconciliation?.grand_total_closing,
        warnings: data.reconciliation?.discrepancy_explanation ? [data.reconciliation.discrepancy_explanation] : [],
        preview_rows: (data.preview_rows || []).map((r: any) => ({
          row_index: r.row_number,
          row_type: r.row_type,
          item_name: r.raw_description,
          category: r.category,
          sku: r.sku,
          inward_qty: r.inwards_qty,
          outward_qty: r.outwards_qty,
          closing_qty: r.closing_qty,
        })),
      },
    };
  });
};
api.importExcel = (file: File, sheetName?: string, asOpeningBalance?: boolean) => {
  const formData = new FormData();
  formData.append('file', file);
  if (sheetName) formData.append('sheet_name', sheetName);
  formData.append('allow_negative_stock', 'true');
  formData.append('update_existing_products', 'false');
  return api.post('/import/confirm', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => ({
    data: {
      batch_id: res.data.id,
      rows_imported: res.data.imported_count,
      total_closing_stock: res.data.reconciliation_data?.grand_total_closing ?? 0,
    },
  }));
};
api.getUsers = () => api.get('/auth/users');
api.createUser = (data: any) => api.post('/auth/users', data);
api.getCategories = () => api.get('/categories');
api.createCategory = (data: { name: string; description?: string }) => api.post('/categories', data);
api.updateCategory = (id: number, data: { name?: string; description?: string }) => api.put(`/categories/${id}`, data);
api.deleteCategory = (id: number, reassign_to?: string) =>
  api.delete(`/categories/${id}`, { params: reassign_to ? { reassign_to } : {} });

export { api };
export default api;
