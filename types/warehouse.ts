export interface Role {
  id: number;
  code: string;
  role_name: string;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  password?: string;
  email: string;
  name: string;
  status: boolean;
  role_id: number;
  role_code?: string;
  role_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Partner {
  id: number;
  code: string;
  name: string;
  phone_number: string;
  address: string;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export interface BaseUnit {
  id: number;
  code: string;
  description: string;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bin {
  id: number;
  location_id: string;
  warehouse_id: number;
  warehouse_name?: string;
  description: string;
  max_capacity: number;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: number;
  code: string;
  name: string;
  base_unit_id: number;
  base_unit_name?: string;
  status: boolean;
  created_at: string;
  updated_at: string;
  stock_quantity?: number;
  avg_cost?: number;
  reserved_bins?: string | { bin_id: number; quantity: number }[];
}

export interface GoodsReceiptDetail {
  paid_quantity?: number | null;
  bonus_quantity?: number;
  commercial_unit_price?: number | null;
  inventory_value?: number | null;

  id: number;
  goods_receipt_id: number;
  item_id: number;
  item_code?: string;
  item_name?: string;
  quantity_ordered: number;
  first_quantity?: number;
  first_bonus?: number;
  unit_price: number;
  bin_id: number;
  bin_description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GoodsReceipt {
  first_date?: string;
  request_key?: string;
  id: number;
  code: string;
  order_date: string;
  warehouse_id: number;
  warehouse_name?: string;
  partner_id: number;
  partner_name?: string;
  user_id: number;
  user_name?: string;
  description: string;
  receipt_status: 'Pending' | 'Confirmed' | 'Rejected';
  status: boolean;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  rejected_at?: string;
  items: GoodsReceiptDetail[];
}

export interface GoodsIssueDetail {
  id: number;
  goods_issue_id: number;
  item_id: number;
  item_code?: string;
  item_name?: string;
  quantity_ordered: number;
  first_quantity?: number;
  first_bonus?: number;
  unit_price: number;
  cost_price: number;
  bin_id: number;
  bin_description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GoodsIssue {
  first_date?: string;
  request_key?: string;
  id: number;
  code: string;
  order_date: string;
  warehouse_id: number;
  warehouse_name?: string;
  partner_id: number;
  partner_name?: string;
  user_id: number;
  user_name?: string;
  status: boolean;
  description: string;
  issue_status: 'Pending' | 'Confirmed' | 'Rejected';
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  rejected_at?: string;
  items: GoodsIssueDetail[];
}

export interface InventoryCheckDetail {
  id: number;
  inventory_check_id: number;
  check_detail_code: string;
  item_id: number;
  item_code?: string;
  item_name?: string;
  bin_id: number;
  bin_description?: string;
  actual_quantity: number;
  book_quantity: number;
  discrepancy: number;
  discrepancy_handled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryCheck {
  id: number;
  code: string;
  from_date: string;
  to_date: string;
  warehouse_id: number;
  warehouse_name?: string;
  user_id: number;
  user_name?: string;
  description: string;
  check_status: 'InProgress' | 'Completed' | 'Cancelled';
  status: boolean;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  details: InventoryCheckDetail[];
}

