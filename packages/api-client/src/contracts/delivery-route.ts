import type {
  DeliveryAttempt,
  DeliveryFailureReason,
  DeliveryRoute,
  RouteStop,
} from '@groaurum/shared-types';
import type { ServiceActionResult } from './order';

export interface DeliveryRouteService {
  getRouteById(routeId: string): Promise<DeliveryRoute | null>;
  listStops(routeId: string): Promise<RouteStop[]>;
  createRoute(
    serviceAreaId: string,
    routeDate: string,
    assignedDeliveryProfileId?: string
  ): Promise<ServiceActionResult<DeliveryRoute>>;
  addOrderToRoute(
    routeId: string,
    orderId: string,
    sequence: number
  ): Promise<ServiceActionResult<RouteStop>>;
  markStopInProgress(stopId: string): Promise<ServiceActionResult<RouteStop>>;
  completeStop(stopId: string): Promise<ServiceActionResult<RouteStop>>;
  recordDeliveryAttempt(
    routeStopId: string,
    orderId: string,
    succeeded: boolean,
    failureReason?: DeliveryFailureReason,
    failureNote?: string
  ): Promise<ServiceActionResult<DeliveryAttempt>>;
}
