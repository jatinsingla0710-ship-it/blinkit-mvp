import type {
  EnqueueNotificationInput,
  NotificationService,
} from '../../contracts/notification';
import type { ServiceActionResult } from '../../contracts/order';
import type { GroAurumSupabaseClient } from '../../supabase/client';

export function createSupabaseNotificationService(
  client: GroAurumSupabaseClient,
): NotificationService {
  return {
    async enqueue(
      input: EnqueueNotificationInput,
    ): Promise<ServiceActionResult<{ id: string }>> {
      const { data, error } = await client.rpc('enqueue_notification', {
        p_channel: input.channel,
        p_template_key: input.templateKey,
        p_recipient: input.recipient,
        p_payload: (input.payload ?? {}) as import('../../database.types').Json,
        p_related_entity_type: input.relatedEntityType ?? null,
        p_related_entity_id: input.relatedEntityId ?? null,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: { id: data as string } };
    },
  };
}
