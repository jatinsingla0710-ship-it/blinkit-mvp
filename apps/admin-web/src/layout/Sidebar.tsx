import { NavLink, useLocation } from 'react-router-dom';
import type { NavGroup } from '@/data/dashboard-types';
import { isSidebarItemActive } from '@/data/nav';
import './Sidebar.css';

type Props = {
  groups: NavGroup[];
  open?: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ groups, open = false, onNavigate }: Props) {
  const location = useLocation();

  return (
    <aside className={['ga-sidebar', open ? 'ga-sidebar--open' : ''].join(' ')}>
      <nav className="ga-sidebar__nav" aria-label="Admin">
        {groups.map((group) => {
          if (group.items.length === 0) return null;
          return (
            <div key={group.id} className="ga-sidebar__group">
              {group.label ? (
                <p className="ga-sidebar__group-label">{group.label}</p>
              ) : null}
              <ul className="ga-sidebar__list">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      className={() =>
                        [
                          'ga-sidebar__link',
                          isSidebarItemActive(location.pathname, item)
                            ? 'ga-sidebar__link--active'
                            : '',
                        ].join(' ')
                      }
                      onClick={onNavigate}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
