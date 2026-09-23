import type { ReactNode, SVGProps } from 'react';
import './Icon.css';

export type IconSize = 'sm' | 'md' | 'lg';

type Props = {
  children: ReactNode;
  size?: IconSize;
  label?: string;
  className?: string;
};

/**
 * Standardizes icon box sizing. Pass an inline SVG as children.
 * Prefer stroke icons at 1.5–2px for admin density.
 */
export function Icon({ children, size = 'md', label, className }: Props) {
  return (
    <span
      className={['ga-icon', `ga-icon--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </span>
  );
}

/** Shared SVG defaults for stroke icons. */
export function iconSvgProps(
  size: IconSize = 'md',
): Pick<SVGProps<SVGSVGElement>, 'width' | 'height' | 'viewBox' | 'fill' | 'stroke' | 'strokeWidth'> {
  const px = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;
  return {
    width: px,
    height: px,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
  };
}
