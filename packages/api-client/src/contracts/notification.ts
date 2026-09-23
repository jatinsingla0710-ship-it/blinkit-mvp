import type { ServiceActionResult } from './order';

export type NotificationChannel = 'SMS' | 'WHATSAPP' | 'PUSH' | 'EMAIL';

export interface EnqueueNotificationInput {
  channel: NotificationChannel;
  templateKey: string;
  recipient: string;
  payload?: Record<string, unknown>;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/**
 * Central notification service — enqueues to notification_outbox.
 * Delivery is performed by the send-notification edge worker.
 */
export interface NotificationService {
  enqueue(
    input: EnqueueNotificationInput,
  ): Promise<ServiceActionResult<{ id: string }>>;
}
