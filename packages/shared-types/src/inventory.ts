import type { InventoryMovementType, StockReservationStatus } from './enums';

export interface InventoryBalance {
  id: string;
  skuId: string;
  operationalLocationId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  /** Derived: onHandQuantity - reservedQuantity */
  availableQuantity: number;
  updatedAt: string;
}

export function deriveAvailableQuantity(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}

/** Append-only inventory movement ledger entry. */
export interface InventoryMovement {
  id: string;
  skuId: string;
  operationalLocationId: string;
  movementType: InventoryMovementType;
  quantityDelta: number;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  actorProfileId?: string;
  createdAt: string;
}

export interface StockReservation {
  id: string;
  orderId: string;
  skuId: string;
  operationalLocationId: string;
  quantity: number;
  status: StockReservationStatus;
  createdAt: string;
  updatedAt: string;
}
