import type { ProductPublishStatus, PublishChecklistItem } from '@/data/product-types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import './PublishChecklist.css';

type Props = {
  items: PublishChecklistItem[];
  canPublish: boolean;
  publishStatus?: ProductPublishStatus;
};

export function PublishChecklist({
  items,
  canPublish,
  publishStatus,
}: Props) {
  const requiredItems = items.filter((item) => !item.optional);
  const optionalItems = items.filter((item) => item.optional);
  const readyCount = requiredItems.filter((i) => i.ready).length;
  const published = publishStatus === 'published';

  const renderItem = (item: PublishChecklistItem) => (
    <li key={item.key} className="ga-checklist__item">
      <span
        className={[
          'ga-checklist__mark',
          item.ready ? 'ga-checklist__mark--ready' : 'ga-checklist__mark--pending',
        ].join(' ')}
        aria-hidden
      >
        {item.ready ? '✓' : '·'}
      </span>
      <div className="ga-checklist__copy">
        <p className="ga-checklist__label">
          {item.label}
          {item.optional ? (
            <span className="ga-checklist__optional">Optional</span>
          ) : null}
        </p>
        <p className="ga-checklist__detail">{item.detail}</p>
      </div>
    </li>
  );

  const badgeTone = published
    ? 'success'
    : canPublish
      ? 'success'
      : 'warning';
  const badgeLabel = published
    ? 'Published'
    : canPublish
      ? 'Ready to publish'
      : `${readyCount}/${requiredItems.length} required`;

  return (
    <Card
      title="Publish Checklist"
      action={<Badge tone={badgeTone}>{badgeLabel}</Badge>}
    >
      <ul className="ga-checklist">{requiredItems.map(renderItem)}</ul>
      {optionalItems.length > 0 ? (
        <>
          <p className="ga-checklist__section">Recommended (optional)</p>
          <ul className="ga-checklist">{optionalItems.map(renderItem)}</ul>
        </>
      ) : null}
    </Card>
  );
}
