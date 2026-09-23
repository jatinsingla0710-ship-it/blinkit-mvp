import './EmptyState.css';

type Props = {
  title: string;
  detail?: string;
};

export function EmptyState({ title, detail }: Props) {
  return (
    <div className="ga-empty">
      <p className="ga-empty__title">{title}</p>
      {detail ? <p className="ga-empty__detail">{detail}</p> : null}
    </div>
  );
}
