import { NavLink } from 'react-router-dom';
import type { NavItem } from '@/data/dashboard-types';
import './Sidebar.css';

type Props = {
  items: NavItem[];
  open?: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ items, open = false, onNavigate }: Props) {
  return (
    <aside className={['ga-sidebar', open ? 'ga-sidebar--open' : ''].join(' ')}>
      <nav className="ga-sidebar__nav" aria-label="Admin">
        <ul className="ga-sidebar__list">
          {items.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.path}
                end={
                  item.path === '/' ||
                  items.some(
                    (other) =>
                      other.path !== item.path &&
                      other.path.startsWith(`${item.path}/`),
                  )
                }
                className={({ isActive }) =>
                  [
                    'ga-sidebar__link',
                    isActive ? 'ga-sidebar__link--active' : '',
                  ].join(' ')
                }
                onClick={onNavigate}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
