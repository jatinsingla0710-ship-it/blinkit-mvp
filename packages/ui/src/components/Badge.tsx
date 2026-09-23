import './Badge.css';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type Props = {
  children: string;
  tone?: BadgeTone;
};

export function Badge({ children, tone = 'neutral' }: Props) {
  return (
    <span className={['ga-badge', `ga-badge--${tone}`].join(' ')}>
      {children}
    </span>
  );
}
