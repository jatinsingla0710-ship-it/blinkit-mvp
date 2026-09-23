import type {
  InventoryBalance,
  InventoryMovement,
  StockReservation,
} from '@groaurum/shared-types';
import type { ServiceActionResult } from './order';

export interface InventoryService {
  getBalance(skuId: string, operationalLocationId: string): Promise<InventoryBalance | null>;
  listMovements(
    skuId: string,
    operationalLocationId: string
  ): Promise<InventoryMovement[]>;
  listReservationsForOrder(orderId: string): Promise<StockReservation[]>;
  reserveForOrder(
    orderId: string,
    operationalLocationId: string
  ): Promise<ServiceActionResult<StockReservation[]>>;
  releaseReservation(reservationId: string): Promise<ServiceActionResult<StockReservation>>;
  recordMovement(
    movement: Omit<InventoryMovement, 'id' | 'createdAt'>
  ): Promise<ServiceActionResult<InventoryMovement>>;
}
