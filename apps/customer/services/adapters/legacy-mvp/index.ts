/**
 * Legacy consumer MVP mock port.
 * Current screens import @/services/mock directly; this port documents the
 * adapter boundary for Phase 3 cutover without changing runtime behaviour.
 */
export {
  categories,
  products,
  stores,
  presetAddresses,
} from '@/services/mock/data';

export {
  distanceKm,
  findNearestStore,
  getStoreById,
} from '@/services/mock/geo';

export {
  getCategories,
  getProductsByStore,
  getProductById,
  getProductsByCategory,
  searchProducts,
  getBestsellers,
  getLiveStock,
  decrementStock,
  findSubstitute,
} from '@/services/mock/catalog';

export {
  computeTotals,
  validateCartStock,
  createOrder,
  getOrderById,
  getOrders,
  getOrderStatusLabel,
  type StockIssue,
} from '@/services/mock/orders';
