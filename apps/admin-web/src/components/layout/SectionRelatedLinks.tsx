import { NavLink } from 'react-router-dom';
import './SectionRelatedLinks.css';

export type SectionRelatedLink = {
  to: string;
  label: string;
  description?: string;
};

type Props = {
  label?: string;
  links: SectionRelatedLink[];
};

/**
 * Compact related-section links for Phase 1 IA —
 * surfaces secondary pages without top-level sidebar items.
 */
export function SectionRelatedLinks({
  label = 'Related',
  links,
}: Props) {
  if (links.length === 0) return null;

  return (
    <nav className="ga-section-links" aria-label={label}>
      <ul className="ga-section-links__list">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              className={({ isActive }) =>
                [
                  'ga-section-links__link',
                  isActive ? 'ga-section-links__link--active' : '',
                ].join(' ')
              }
              end={link.to === '/' || !link.to.includes('?')}
            >
              <span className="ga-section-links__label">{link.label}</span>
              {link.description ? (
                <span className="ga-section-links__desc">{link.description}</span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
