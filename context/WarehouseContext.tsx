'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Item, Bin, Warehouse, Partner, User, Role, BaseUnit,
  GoodsReceipt, GoodsIssue, InventoryCheck
} from '@/types/warehouse';
import type { BulkDocumentRejection, BulkDocumentResult } from '@/components/document-bulk-action';

// Base API URL — dùng Next.js rewrites nên chỉ cần /api/
const API = '/api';
const CACHE_VERSION = 8; // Includes current per-bin reservation quantities.
const CACHE_TTL_MS = 5 * 60 * 1000;
const DATA_CHANGE_KEY = 'ewarehouse_data_changed';
type DocumentCreationOptions = { deferSync?: boolean };
let bootstrapCacheEpoch = 0;

export type CatalogEntity = 'item' | 'bin' | 'warehouse' | 'partner' | 'user' | 'unit';
export type CatalogDeactivationImpact = {
  entity: CatalogEntity;
  id: number;
  label: string;
  code: string;
  name: string;
  current_status: boolean;
  stock: number;
  pending_documents: number;
  dependent_records: number;
  cascaded_records: number;
  requires_confirmation: boolean;
};

async function apiFetch(url: string, options?: RequestInit) {
  const attempts = !options?.method || options.method === 'GET' ? 2 : 1;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        cache: 'no-store',
        ...options,
      });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ewarehouse:unauthorized'));
      }
      if (!res.ok) throw Object.assign(new Error(data?.message || data?.error || `Máy chủ trả về HTTP ${res.status}`), { code: data?.code });
      return data;
    } catch (cause) {
      lastError = cause instanceof Error ? cause : new Error('Không thể kết nối máy chủ');
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 250));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error('Không thể kết nối máy chủ');
}

async function runBulkDocumentAction(
  ids: number[],
  endpoint: (id: number) => string,
  body: Record<string, unknown> | ((id: number) => Record<string, unknown>),
): Promise<BulkDocumentResult> {
  const result: BulkDocumentResult = { succeeded: [], failed: [] };
  for (const id of ids) {
    try {
      await apiFetch(endpoint(id), { method: 'PATCH', body: JSON.stringify(typeof body === 'function' ? body(id) : body) });
      result.succeeded.push(id);
    } catch (error) {
      result.failed.push({ id, message: error instanceof Error ? error.message : 'Không thể xử lý phiếu', ...((error as Error & { code?: string }).code ? { code: (error as Error & { code?: string }).code } : {}) });
    }
  }
  return result;
}

interface WarehouseContextType {
  items: Item[];
  bins: Bin[];
  warehouses: Warehouse[];
  partners: Partner[];
  users: User[];
  roles: Role[];
  units: BaseUnit[];
  goodsReceipts: GoodsReceipt[];
  goodsIssues: GoodsIssue[];
  inventoryChecks: InventoryCheck[];
  costingMethod: 'AVERAGE';
  loading: boolean;
  isSyncing: boolean;
  loadError: string | null;
  refreshAll: () => Promise<void>;
  dataRevision: number;
  getCatalogDeactivationImpact: (entity: CatalogEntity, id: number) => Promise<CatalogDeactivationImpact>;
  setCatalogStatus: (entity: CatalogEntity, id: number, status: boolean, confirmed?: boolean) => Promise<{ success: boolean; message: string }>;

  // Items CRUD
  addItem: (item: Omit<Item, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateItem: (id: number, data: Partial<Item>) => Promise<void>;
  deleteItem: (id: number) => Promise<{ success: boolean; message?: string }>;
  importItemsFromExcel: (newItems: Omit<Item, 'id' | 'created_at' | 'updated_at'>[]) => Promise<void>;

  // Bins CRUD
  addBin: (bin: Omit<Bin, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateBin: (id: number, data: Partial<Bin>) => Promise<void>;
  deleteBin: (id: number) => Promise<{ success: boolean; message?: string }>;

  // Warehouses CRUD
  addWarehouse: (wh: Omit<Warehouse, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateWarehouse: (id: number, data: Partial<Warehouse>) => Promise<void>;
  deleteWarehouse: (id: number) => Promise<{ success: boolean; message?: string }>;

  // Partners CRUD
  addPartner: (partner: Omit<Partner, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePartner: (id: number, data: Partial<Partner>) => Promise<void>;
  deletePartner: (id: number) => Promise<{ success: boolean; message?: string }>;

  // Users CRUD
  addUser: (user: Omit<User, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateUser: (id: number, data: Partial<User>) => Promise<void>;
  deleteUser: (id: number) => Promise<{ success: boolean; message?: string }>;

  // Units CRUD
  addUnit: (unit: Omit<BaseUnit, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateUnit: (id: number, data: Partial<BaseUnit>) => Promise<void>;
  deleteUnit: (id: number) => Promise<{ success: boolean; message?: string }>;

  // Documents
  addInventoryCheck: (ic: Omit<InventoryCheck, 'id' | 'created_at' | 'updated_at'>, options?: DocumentCreationOptions) => Promise<{ success: boolean; message?: string; icId?: number }>;
  updateInventoryCheck: (id: number, ic: Omit<InventoryCheck, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; message?: string }>;
  deleteInventoryCheck: (id: number) => Promise<{ success: boolean; message?: string }>;
  completeInventoryCheck: (id: number, releaseReservations?: boolean) => Promise<{ success: boolean; message?: string; code?: string }>;
  completeMultipleInventoryChecks: (ids: number[], releaseReservations?: boolean) => Promise<BulkDocumentResult>;
  cancelMultipleInventoryChecks: (rejections: BulkDocumentRejection[]) => Promise<BulkDocumentResult>;
  cancelInventoryCheck: (id: number, reason: string) => Promise<{ success: boolean; message?: string }>;

  // Helpers
  getItemStock: (itemId: number, binId?: number, warehouseId?: number) => number;
  getItemAvailableStock: (itemId: number, binId?: number, warehouseId?: number) => number;
  getItemHistory: (itemId: number, warehouseId?: number) => {
    date: string;
    type: 'Nhập' | 'Xuất' | 'Kiểm kê';
    voucherCode: string;
    quantity: number;
    unitPrice?: number;
    partnerName?: string;
    warehouseName?: string;
    balance: number;
  }[];
}

const CACHE_KEY = 'ewarehouse_bootstrap_cache';

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

function invalidateBootstrapCache() {
  bootstrapCacheEpoch += 1;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // Cache is only an acceleration layer; browser storage must never block a business action.
  }
}

function persistBootstrapCache(data: unknown) {
  const epoch = bootstrapCacheEpoch;
  // Defer serialization until the current interaction has painted. This keeps a large
  // bootstrap snapshot from blocking navigation or the completion feedback of an action.
  window.setTimeout(() => {
    if (epoch !== bootstrapCacheEpoch) return;
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({
        version: CACHE_VERSION,
        savedAt: Date.now(),
        data,
      }));
    } catch (storageErr) {
      console.warn('Không thể ghi cache localStorage:', storageErr);
    }
  }, 0);
}

function upsertDocuments<T extends { id: number }>(current: T[], incoming: T[]) {
  if (incoming.length === 0) return current;
  const incomingById = new Map(incoming.map(document => [document.id, document]));
  const currentIds = new Set(current.map(document => document.id));
  const added = incoming.filter(document => !currentIds.has(document.id));
  return [
    ...added,
    ...current.map(document => incomingById.get(document.id) || document),
  ];
}

export const WarehouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [units, setUnits] = useState<BaseUnit[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [goodsIssues, setGoodsIssues] = useState<GoodsIssue[]>([]);
  const [inventoryChecks, setInventoryChecks] = useState<InventoryCheck[]>([]);
  const costingMethod = 'AVERAGE' as const;
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataRevision, setDataRevision] = useState(0);
  const refreshSequence = useRef(0);
  const lastRefresh = useRef(0);

  // ─── Cache-First Instant Hydration ───
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cacheValid = parsed?.version === CACHE_VERSION && Number(parsed?.savedAt) > Date.now() - CACHE_TTL_MS;
        const data = cacheValid ? parsed.data : null;
        if (data && typeof data === 'object') {
          if (Array.isArray(data.items)) setItems(data.items);
          if (Array.isArray(data.bins)) setBins(data.bins);
          if (Array.isArray(data.warehouses)) setWarehouses(data.warehouses);
          if (Array.isArray(data.partners)) setPartners(data.partners);
          if (Array.isArray(data.users)) setUsers(data.users);
          if (Array.isArray(data.roles)) setRoles(data.roles);
          if (Array.isArray(data.units)) setUnits(data.units);
          if (Array.isArray(data.goodsReceipts)) setGoodsReceipts(data.goodsReceipts);
          if (Array.isArray(data.goodsIssues)) setGoodsIssues(data.goodsIssues);
          if (Array.isArray(data.inventoryChecks)) setInventoryChecks(data.inventoryChecks);
          // Đã có cache -> không cần block UI
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc cache cục bộ:', e);
    }
  }, []);

  // Load tất cả dữ liệu từ API qua single bootstrap endpoint
  const refreshAll = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const epoch = bootstrapCacheEpoch;
    setIsSyncing(true);
    setLoadError(null);
    try {
      let data: any = null;
      try {
        // 1. Thử gọi single bootstrap endpoint tối ưu (1 request duy nhất)
        data = await apiFetch(`${API}/bootstrap`);
      } catch (bootstrapErr) {
        console.warn('Bootstrap API thất bại, fallback sang multi-fetch:', bootstrapErr);
        // Fallback gọi song song từng API nếu bootstrap chưa sẵn sàng
        try {
          const [
            itemsData, binsData, warehousesData, partnersData,
            usersData, rolesData, unitsData,
            posData, sosData, icsData,
          ] = await Promise.all([
            apiFetch(`${API}/items`),
            apiFetch(`${API}/bins`),
            apiFetch(`${API}/warehouses`),
            apiFetch(`${API}/partners`),
            apiFetch(`${API}/users`),
            apiFetch(`${API}/roles`),
            apiFetch(`${API}/base-units`),
            apiFetch(`${API}/goods-receipts/postings`),
            apiFetch(`${API}/goods-issues/postings`),
            apiFetch(`${API}/inventory-checks`),
          ]);

          data = {
            items: itemsData,
            bins: binsData,
            warehouses: warehousesData,
            partners: partnersData,
            users: usersData,
            roles: rolesData,
            units: unitsData,
            goodsReceipts: posData,
            goodsIssues: sosData,
            inventoryChecks: icsData,
          };
        } catch (fallbackErr) {
          // Cả bootstrap lẫn fallback đều thất bại → backend không phản hồi
          const msg = (bootstrapErr as Error).name === 'AbortError'
            ? 'Máy chủ backend không phản hồi (timeout). Hãy kiểm tra lại backend đã khởi động chưa.'
            : `Không thể kết nối đến máy chủ: ${(bootstrapErr as Error).message}`;
          if (sequence === refreshSequence.current) setLoadError(msg);
        }
      }

      if (data && sequence === refreshSequence.current && epoch === bootstrapCacheEpoch) {
        setLoadError(null);
        setItems(data.items || []);
        setBins(data.bins || []);
        setWarehouses(data.warehouses || []);
        setPartners(data.partners || []);
        setUsers(data.users || []);
        setRoles(data.roles || []);
        setUnits(data.units || []);
        setGoodsReceipts(data.goodsReceipts || []);
        setGoodsIssues(data.goodsIssues || []);
        setInventoryChecks(data.inventoryChecks || []);

        // Cache is written after the current interaction instead of blocking the render.
        persistBootstrapCache(data);
        lastRefresh.current = Date.now();
        setDataRevision(value => value + 1);
      }
    } catch (err) {
      console.error('Lỗi load dữ liệu từ API:', err);
      if (sequence === refreshSequence.current) setLoadError(`Lỗi không xác định: ${(err as Error).message}`);
    } finally {
      if (sequence === refreshSequence.current) {
        setLoading(false);
        setIsSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshAll();
    return () => { refreshSequence.current += 1; invalidateBootstrapCache(); };
  }, [refreshAll]);

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === DATA_CHANGE_KEY) { invalidateBootstrapCache(); void refreshAll(); }
    };
    const focused = () => {
      if (Date.now() - lastRefresh.current > 30_000) void refreshAll();
    };
    window.addEventListener('storage', changed);
    window.addEventListener('focus', focused);
    return () => {
      window.removeEventListener('storage', changed);
      window.removeEventListener('focus', focused);
    };
  }, [refreshAll]);

  // Joined names/units in documents and bins must be refreshed together with catalogs.
  // Do not re-submit a committed write if the subsequent refresh is temporarily offline.
  const mutateCatalog = useCallback(async (url: string, options: RequestInit) => {
    const result = await apiFetch(url, options);
    invalidateBootstrapCache();
    refreshSequence.current += 1;
    try { window.localStorage.setItem(DATA_CHANGE_KEY, `${Date.now()}-${Math.random()}`); } catch {}
    await refreshAll();
    return result;
  }, [refreshAll]);

  const refreshItems = useCallback(async () => {
    const sequence = refreshSequence.current;
    const updatedItems = await apiFetch(`${API}/items`);
    if (sequence === refreshSequence.current) setItems(updatedItems);
  }, []);

  const syncInventoryChecks = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    invalidateBootstrapCache();
    const sequence = refreshSequence.current;
    try {
      const updated = await Promise.all(ids.map(id => apiFetch(`${API}/inventory-checks/${id}`)));
      if (sequence !== refreshSequence.current) return;
      setInventoryChecks(current => upsertDocuments(current, updated));
      setDataRevision(value => value + 1);
    } catch (error) {
      console.warn('Không thể đồng bộ riêng phiếu kiểm kê, chuyển sang tải lại danh sách:', error);
      try {
        const updated = await apiFetch(`${API}/inventory-checks`);
        if (sequence !== refreshSequence.current) return;
        setInventoryChecks(updated);
        setDataRevision(value => value + 1);
      } catch (fallbackError) {
        console.warn('Không thể tải lại danh sách phiếu kiểm kê:', fallbackError);
      }
    }
  }, []);

  const syncStockItems = useCallback(async () => {
    invalidateBootstrapCache();
    try {
      await refreshItems();
    } catch (error) {
      // Stock calculations still remain correct from the synchronized documents.
      // The full item list will be recovered by the next manual/background refresh.
      console.warn('Không thể đồng bộ nhanh tồn kho trên danh mục vật tư:', error);
    }
  }, [refreshItems]);

  const getCatalogDeactivationImpact = useCallback(async (entity: CatalogEntity, id: number) => (
    apiFetch(`${API}/catalog-status/${entity}/${id}/impact`)
  ), []);

  const setCatalogStatus = useCallback(async (
    entity: CatalogEntity,
    id: number,
    status: boolean,
    confirmed = false,
  ) => {
    const result = await mutateCatalog(`${API}/catalog-status/${entity}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, confirmed }),
    });
    return result;
  }, [mutateCatalog]);


  // ─── Precalculated Stock Maps (O(1) lookups) ───
  const { stockByItemMap, stockByItemBinMap, stockByItemWarehouseMap } = useMemo(() => {
    const itemMap = new Map<number, number>();
    const itemBinMap = new Map<string, number>();
    const itemWarehouseMap = new Map<string, number>();

    goodsReceipts.forEach(po => {
      if (po.receipt_status === 'Confirmed') {
        po.items.forEach(pi => {
          const qty = Number(pi.quantity_ordered) || 0;
          itemMap.set(pi.item_id, (itemMap.get(pi.item_id) || 0) + qty);
          const warehouseKey = `${pi.item_id}_${po.warehouse_id}`;
          itemWarehouseMap.set(warehouseKey, (itemWarehouseMap.get(warehouseKey) || 0) + qty);
          if (pi.bin_id) {
            const key = `${pi.item_id}_${pi.bin_id}`;
            itemBinMap.set(key, (itemBinMap.get(key) || 0) + qty);
          }
        });
      }
    });

    goodsIssues.forEach(so => {
      if (so.issue_status === 'Confirmed') {
        so.items.forEach(si => {
          const qty = Number(si.quantity_ordered) || 0;
          itemMap.set(si.item_id, (itemMap.get(si.item_id) || 0) - qty);
          const warehouseKey = `${si.item_id}_${so.warehouse_id}`;
          itemWarehouseMap.set(warehouseKey, (itemWarehouseMap.get(warehouseKey) || 0) - qty);
          if (si.bin_id) {
            const key = `${si.item_id}_${si.bin_id}`;
            itemBinMap.set(key, (itemBinMap.get(key) || 0) - qty);
          }
        });
      }
    });

    inventoryChecks.forEach(ic => {
      if (ic.check_status === 'Completed') {
        ic.details.forEach(detail => {
          if (!detail.discrepancy_handled) return;
          const quantity = Number(detail.discrepancy) || 0;
          itemMap.set(detail.item_id, (itemMap.get(detail.item_id) || 0) + quantity);
          const warehouseKey = `${detail.item_id}_${ic.warehouse_id}`;
          itemWarehouseMap.set(warehouseKey, (itemWarehouseMap.get(warehouseKey) || 0) + quantity);
          const key = `${detail.item_id}_${detail.bin_id}`;
          itemBinMap.set(key, (itemBinMap.get(key) || 0) + quantity);
        });
      }
    });

    return { stockByItemMap: itemMap, stockByItemBinMap: itemBinMap, stockByItemWarehouseMap: itemWarehouseMap };
  }, [goodsReceipts, goodsIssues, inventoryChecks]);

  // ─── Instant O(1) stock lookup ───
  const getItemStock = useCallback((itemId: number, binId?: number, warehouseId?: number): number => {
    if (warehouseId !== undefined) return stockByItemWarehouseMap.get(`${itemId}_${warehouseId}`) || 0;
    if (binId) {
      return stockByItemBinMap.get(`${itemId}_${binId}`) || 0;
    }
    return stockByItemMap.get(itemId) || 0;
  }, [stockByItemMap, stockByItemBinMap, stockByItemWarehouseMap]);

  // ─── Get chronological movement history for item ───
  const getItemAvailableStock = useCallback((itemId: number, binId?: number, warehouseId?: number): number => {
    const raw = items.find(item => item.id === itemId)?.reserved_bins;
    let held: { bin_id: number; quantity: number }[] = [];
    try { held = typeof raw === 'string' ? JSON.parse(raw) : raw || []; } catch { return 0; }
    const reserved = held.filter(row => binId ? row.bin_id === binId : warehouseId === undefined || bins.some(bin => bin.id === row.bin_id && bin.warehouse_id === warehouseId))
      .reduce((sum, row) => sum + Number(row.quantity), 0);
    return Math.max(0, getItemStock(itemId, binId, warehouseId) - reserved);
  }, [items, bins, getItemStock]);

  const getItemHistory = useCallback((itemId: number, warehouseId?: number) => {
    const movements: {
      date: string;
      type: 'Nhập' | 'Xuất' | 'Kiểm kê';
      voucherCode: string;
      quantity: number;
      unitPrice?: number;
      partnerName?: string;
      warehouseName?: string;
      balance: number;
    }[] = [];

    goodsReceipts
      .filter(po => po.receipt_status === 'Confirmed' && (warehouseId === undefined || po.warehouse_id === warehouseId))
      .forEach(po => {
        po.items.forEach(pi => {
          if (pi.item_id === itemId) {
            movements.push({
              date: po.order_date,
              type: 'Nhập',
              voucherCode: po.code,
              quantity: pi.quantity_ordered,
              unitPrice: Number(pi.unit_price) || 0,
              partnerName: po.partner_name,
              warehouseName: po.warehouse_name,
              balance: 0,
            });
          }
        });
      });

    goodsIssues
      .filter(so => so.issue_status === 'Confirmed' && (warehouseId === undefined || so.warehouse_id === warehouseId))
      .forEach(so => {
        so.items.forEach(si => {
          if (si.item_id === itemId) {
            movements.push({
              date: so.order_date,
              type: 'Xuất',
              voucherCode: so.code,
              quantity: si.quantity_ordered,
              partnerName: so.partner_name,
              warehouseName: so.warehouse_name,
              balance: 0,
            });
          }
        });
      });

    inventoryChecks
      .filter(ic => ic.check_status === 'Completed' && (warehouseId === undefined || ic.warehouse_id === warehouseId))
      .forEach(ic => {
        ic.details.forEach(detail => {
          if (detail.item_id === itemId && detail.discrepancy_handled && Number(detail.discrepancy) !== 0) {
            movements.push({
              date: ic.to_date,
              type: 'Kiểm kê',
              voucherCode: ic.code,
              quantity: Number(detail.discrepancy),
              warehouseName: ic.warehouse_name,
              balance: 0,
            });
          }
        });
      });

    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    return movements.map(m => {
      if (m.type === 'Nhập') runningBalance += m.quantity;
      else if (m.type === 'Xuất') runningBalance -= m.quantity;
      else runningBalance += m.quantity;
      return { ...m, balance: runningBalance };
    });
  }, [goodsReceipts, goodsIssues, inventoryChecks]);

  // ─── Items CRUD ───
  const addItem = useCallback(async (newItem: Omit<Item, 'id' | 'created_at' | 'updated_at'>) => {
    await mutateCatalog(`${API}/items`, { method: 'POST', body: JSON.stringify(newItem) });
  }, [mutateCatalog]);

  const updateItem = useCallback(async (id: number, data: Partial<Item>) => {
    await mutateCatalog(`${API}/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }, [mutateCatalog]);

  const deleteItem = useCallback(async (id: number): Promise<{ success: boolean; message?: string }> => {
    try {
      await mutateCatalog(`${API}/items/${id}`, { method: 'DELETE' });
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [mutateCatalog]);

  const importItemsFromExcel = useCallback(async (newItems: Omit<Item, 'id' | 'created_at' | 'updated_at'>[]) => {
    await mutateCatalog(`${API}/items/import`, { method: 'POST', body: JSON.stringify({ items: newItems }) });
  }, [mutateCatalog]);

  // ─── Bins CRUD ───
  const addBin = useCallback(async (bin: Omit<Bin, 'id' | 'created_at' | 'updated_at'>) => {
    await mutateCatalog(`${API}/bins`, { method: 'POST', body: JSON.stringify(bin) });
  }, [mutateCatalog]);

  const updateBin = useCallback(async (id: number, data: Partial<Bin>) => {
    await mutateCatalog(`${API}/bins/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }, [mutateCatalog]);

  const deleteBin = useCallback(async (id: number): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await mutateCatalog(`${API}/bins/${id}`, { method: 'DELETE' });
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [mutateCatalog]);

  // ─── Warehouses CRUD ───
  const addWarehouse = useCallback(async (wh: Omit<Warehouse, 'id' | 'created_at' | 'updated_at'>) => {
    await mutateCatalog(`${API}/warehouses`, { method: 'POST', body: JSON.stringify(wh) });
  }, [mutateCatalog]);

  const updateWarehouse = useCallback(async (id: number, data: Partial<Warehouse>) => {
    await mutateCatalog(`${API}/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }, [mutateCatalog]);

  const deleteWarehouse = useCallback(async (id: number): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await mutateCatalog(`${API}/warehouses/${id}`, { method: 'DELETE' });
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [mutateCatalog]);

  // ─── Partners CRUD ───
  const addPartner = useCallback(async (partner: Omit<Partner, 'id' | 'created_at' | 'updated_at'>) => {
    await mutateCatalog(`${API}/partners`, { method: 'POST', body: JSON.stringify(partner) });
  }, [mutateCatalog]);

  const updatePartner = useCallback(async (id: number, data: Partial<Partner>) => {
    await mutateCatalog(`${API}/partners/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }, [mutateCatalog]);

  const deletePartner = useCallback(async (id: number): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await mutateCatalog(`${API}/partners/${id}`, { method: 'DELETE' });
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [mutateCatalog]);

  // ─── Users CRUD ───
  const addUser = useCallback(async (user: Omit<User, 'id' | 'created_at' | 'updated_at'>) => {
    await mutateCatalog(`${API}/users`, { method: 'POST', body: JSON.stringify(user) });
  }, [mutateCatalog]);

  const updateUser = useCallback(async (id: number, data: Partial<User>) => {
    await mutateCatalog(`${API}/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }, [mutateCatalog]);

  const deleteUser = useCallback(async (id: number): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await mutateCatalog(`${API}/users/${id}`, { method: 'DELETE' });
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [mutateCatalog]);

  // ─── Units CRUD ───
  const addUnit = useCallback(async (unit: Omit<BaseUnit, 'id' | 'created_at' | 'updated_at'>) => {
    await mutateCatalog(`${API}/base-units`, { method: 'POST', body: JSON.stringify(unit) });
  }, [mutateCatalog]);

  const updateUnit = useCallback(async (id: number, data: Partial<BaseUnit>) => {
    await mutateCatalog(`${API}/base-units/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }, [mutateCatalog]);

  const deleteUnit = useCallback(async (id: number): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await mutateCatalog(`${API}/base-units/${id}`, { method: 'DELETE' });
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [mutateCatalog]);

  // ─── Inventory Checks ───
  const addInventoryCheck = useCallback(async (icData: Omit<InventoryCheck, 'id' | 'created_at' | 'updated_at'>, options?: DocumentCreationOptions) => {
    try {
      const result = await apiFetch(`${API}/inventory-checks`, {
        method: 'POST',
        body: JSON.stringify(icData),
      });
      if (!options?.deferSync || !result.icId) await syncInventoryChecks([result.icId]);
      return { success: true, message: result.message, icId: result.icId };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [syncInventoryChecks]);

  const updateInventoryCheck = useCallback(async (id: number, icData: Omit<InventoryCheck, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const result = await apiFetch(`${API}/inventory-checks/${id}`, { method: 'PUT', body: JSON.stringify(icData) });
      await syncInventoryChecks([id]);
      return { success: true, message: result.message };
    } catch (err: any) { return { success: false, message: err.message }; }
  }, [syncInventoryChecks]);

  const deleteInventoryCheck = useCallback(async (id: number) => {
    try {
      const result = await apiFetch(`${API}/inventory-checks/${id}`, { method: 'DELETE' });
      invalidateBootstrapCache();
      setInventoryChecks(current => current.filter(document => document.id !== id));
      setDataRevision(value => value + 1);
      return { success: true, message: result.message };
    } catch (err: any) { return { success: false, message: err.message }; }
  }, []);

  const completeInventoryCheck = useCallback(async (id: number, releaseReservations = false) => {
    try {
      const result = await apiFetch(`${API}/inventory-checks/${id}/complete`, { method: 'PATCH', body: JSON.stringify({ release_reservations: releaseReservations }) });
      await Promise.all([syncInventoryChecks([id]), syncStockItems()]);
      return { success: true, message: result.message };
    } catch (err: any) {
      await Promise.all([syncInventoryChecks([id]), syncStockItems()]);
      return { success: false, message: err.message, code: err.code };
    }
  }, [syncInventoryChecks, syncStockItems]);

  const completeMultipleInventoryChecks = useCallback(async (ids: number[], releaseReservations = false) => {
    const result = await runBulkDocumentAction(ids, id => `${API}/inventory-checks/${id}/complete`, releaseReservations ? { release_reservations: true } : {});
    await Promise.all([
      syncInventoryChecks(result.succeeded),
      result.succeeded.length ? syncStockItems() : Promise.resolve(),
    ]);
    return result;
  }, [syncInventoryChecks, syncStockItems]);

  const cancelMultipleInventoryChecks = useCallback(async (rejections: BulkDocumentRejection[]) => {
    const reasons = new Map(rejections.map(entry => [entry.id, entry.reason]));
    const result = await runBulkDocumentAction(rejections.map(entry => entry.id), id => `${API}/inventory-checks/${id}/cancel`, id => ({ reason: reasons.get(id) || '' }));
    await syncInventoryChecks(result.succeeded);
    return result;
  }, [syncInventoryChecks]);

  const cancelInventoryCheck = useCallback(async (id: number, reason: string) => {
    try {
      const result = await apiFetch(`${API}/inventory-checks/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) });
      await syncInventoryChecks([id]);
      return { success: true, message: result.message };
    } catch (err: any) { return { success: false, message: err.message }; }
  }, [syncInventoryChecks]);

  const contextValue = useMemo(() => ({
    items, bins, warehouses, partners, users, roles, units,
    goodsReceipts, goodsIssues, inventoryChecks,
    costingMethod,
    loading, isSyncing, loadError, refreshAll, dataRevision, getCatalogDeactivationImpact, setCatalogStatus,
    addItem, updateItem, deleteItem, importItemsFromExcel,
    addBin, updateBin, deleteBin,
    addWarehouse, updateWarehouse, deleteWarehouse,
    addPartner, updatePartner, deletePartner,
    addUser, updateUser, deleteUser,
    addUnit, updateUnit, deleteUnit,
    addInventoryCheck, updateInventoryCheck, deleteInventoryCheck, completeInventoryCheck, completeMultipleInventoryChecks, cancelMultipleInventoryChecks, cancelInventoryCheck,
    getItemStock, getItemAvailableStock, getItemHistory,
  }), [
    items, bins, warehouses, partners, users, roles, units,
    goodsReceipts, goodsIssues, inventoryChecks,
    costingMethod, loading, isSyncing, loadError, refreshAll, dataRevision, getCatalogDeactivationImpact, setCatalogStatus,
    addItem, updateItem, deleteItem, importItemsFromExcel,
    addBin, updateBin, deleteBin,
    addWarehouse, updateWarehouse, deleteWarehouse,
    addPartner, updatePartner, deletePartner,
    addUser, updateUser, deleteUser,
    addUnit, updateUnit, deleteUnit,
    addInventoryCheck, updateInventoryCheck, deleteInventoryCheck, completeInventoryCheck, completeMultipleInventoryChecks, cancelMultipleInventoryChecks, cancelInventoryCheck,
    getItemStock, getItemAvailableStock, getItemHistory,
  ]);


  return (
    <WarehouseContext.Provider value={contextValue}>
      {children}
    </WarehouseContext.Provider>
  );
};

export const useWarehouse = () => {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error('useWarehouse must be used within a WarehouseProvider');
  }
  return context;
};

