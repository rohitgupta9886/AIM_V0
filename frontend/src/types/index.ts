export interface User {
  id: number;
  username: string;
  role: 'admin' | 'viewer';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  original_description?: string;
  unit: string;
  thickness?: string;
  colour_finish?: string;
  dimensions?: string;
  length?: string;
  minimum_stock: number;
  active: boolean;
  current_quantity: number;
  stock_status: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  created_at: string;
  updated_at: string;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Transaction {
  id: number;
  product_id: number;
  product_sku?: string;
  product_name?: string;
  transaction_type: 'OPENING' | 'INWARD' | 'OUTWARD' | 'ADJUSTMENT' | 'REVERSAL';
  transaction_date: string;
  quantity: number;
  reference_number?: string;
  remarks?: string;
  created_by?: string;
  created_at: string;
  current_balance_after?: number;
}

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface StockSummaryItem {
  product_id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  thickness?: string;
  colour_finish?: string;
  dimensions?: string;
  length?: string;
  current_quantity: number;
  minimum_stock: number;
  stock_status: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  total_inward: number;
  total_outward: number;
  total_adjustment: number;
}

export interface DashboardKPIs {
  active_skus: number;
  total_stock_quantity: number;
  primary_unit: string;
  total_inward: number;
  total_outward: number;
  low_stock_count: number;
  out_of_stock_count: number;
  normal_stock_count: number;
}

export interface StockByCategory {
  category: string;
  sku_count: number;
  total_quantity: number;
}

export interface TopSKU {
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
}

export interface TimeSeriesPoint {
  month: string;
  inward: number;
  outward: number;
  opening: number;
  adjustment: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  stock_by_category: StockByCategory[];
  top_skus: TopSKU[];
  inward_vs_outward_time: TimeSeriesPoint[];
}

export interface RowPreviewItem {
  row_number: number;
  row_type: 'PRODUCT' | 'CATEGORY' | 'TOTAL' | 'HEADER' | 'EMPTY';
  raw_description?: string;
  category?: string;
  sku?: string;
  thickness?: string;
  colour_finish?: string;
  dimensions?: string;
  length?: string;
  unit: string;
  opening_qty: number;
  inwards_qty: number;
  outwards_qty: number;
  closing_qty: number;
  status: 'VALID' | 'WARNING' | 'ERROR' | 'EXCLUDED';
  message?: string;
  is_duplicate: boolean;
}

export interface ReconciliationReport {
  source_period_start?: string;
  source_period_end?: string;
  grand_total_inwards: number;
  grand_total_outwards: number;
  grand_total_closing: number;
  calculated_items_inwards: number;
  calculated_items_outwards: number;
  calculated_items_closing: number;
  closing_discrepancy: number;
  inward_discrepancy: number;
  outward_discrepancy: number;
  discrepancy_explanation?: string;
  negative_stock_rows_count: number;
  duplicate_skus_count: number;
}

export interface ImportPreviewResponse {
  filename: string;
  sheet_name: string;
  available_sheets: string[];
  total_rows: number;
  product_rows_count: number;
  category_rows_count: number;
  header_rows_count: number;
  reconciliation: ReconciliationReport;
  preview_rows: RowPreviewItem[];
}

export interface ImportRowResult {
  id: number;
  source_sheet: string;
  source_row: number;
  source_description?: string;
  status: string;
  message?: string;
}

export interface LowStockItem {
  product_id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  current_quantity: number;
  minimum_stock: number;
  deficit: number;
  stock_status: string;
  total_inward?: number;
  total_outward?: number;
  product_name?: string;
  current_stock?: number;
  uom?: string;
}

export interface CategoryStock {
  category: string;
  sku_count: number;
  total_stock: number;
  avg_stock_per_sku: number;
  total_closing_stock?: number;
  total_inward?: number;
  total_outward?: number;
  product_count?: number;
}

export interface ImportBatch {
  id: number;
  filename: string;
  source_period_start?: string;
  source_period_end?: string;
  imported_at: string;
  created_at?: string;
  imported_by?: string;
  imported_count: number;
  rows_imported?: number;
  skipped_count: number;
  error_count: number;
  status?: string;
  total_inward?: number;
  total_outward?: number;
  total_closing?: number;
  reconciliation_data?: any;
  row_results?: ImportRowResult[];
}

export interface ProductCategory {
  id: number;
  name: string;
  description?: string;
  product_count: number;
  created_at: string;
  updated_at: string;
}
