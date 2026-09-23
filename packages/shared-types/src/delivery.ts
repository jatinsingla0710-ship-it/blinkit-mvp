import type {
  DeliveryFailureReason,
  DeliveryRouteStatus,
  RouteStopStatus,
} from './enums';

export interface DeliveryRoute {
  id: string;
  serviceAreaId: string;
  routeDate: string;
  assignedDeliveryProfileId: string | null;
  status: DeliveryRouteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RouteStop {
  id: string;
  routeId: string;
  orderId: string;
  sequence: number;
  status: RouteStopStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryAttempt {
  id: string;
  routeStopId: string;
  orderId: string;
  attemptedAt: string;
  succeeded: boolean;
  failureReason?: DeliveryFailureReason;
  failureNote?: string;
  createdAt: string;
}
