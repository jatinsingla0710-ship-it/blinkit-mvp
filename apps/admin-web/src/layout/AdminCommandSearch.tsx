import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { NavGroup } from '@/data/dashboard-types';
import {
  useCustomersSnapshotQuery,
  useProductsListQuery,
} from '@/data/hooks';
import './AdminCommandSearch.css';

type Props = {
  groups: NavGroup[];
};

type ResultLinkProps = {
  to: string;
  eyebrow: string;
  title: string;
  detail?: string;
  onSelect: () => void;
};

export function filterCommandRoutes(groups: NavGroup[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];
  return groups
    .flatMap((group) =>
      group.items.map((item) => ({ ...item, groupLabel: group.label })),
    )
    .filter((item) =>
      `${item.label} ${item.groupLabel ?? ''}`.toLowerCase().includes(normalized),
    )
    .slice(0, 10);
}

function ResultLink({
  to,
  eyebrow,
  title,
  detail,
  onSelect,
}: ResultLinkProps) {
  return (
    <li>
      <Link to={to} className="ga-command__result" onClick={onSelect}>
        <span className="ga-command__eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </Link>
    </li>
  );
}

function CustomerResults({
  query,
  onSelect,
}: {
  query: string;
  onSelect: () => void;
}) {
  const { data, isPending } = useCustomersSnapshotQuery();
  const rows = useMemo(() => {
    const needle = query.toLowerCase();
    return (data?.rows ?? [])
      .filter((row) =>
        [row.shopName, row.ownerName, row.phoneLabel, row.areaLabel]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 4);
  }, [data, query]);

  if (isPending) {
    return <li className="ga-command__status">Loading customers…</li>;
  }
  return (
    <>
      {rows.map((row) => (
        <ResultLink
          key={row.id}
          to={`/customers/${row.id}`}
          eyebrow="Customer"
          title={row.shopName}
          detail={`${row.ownerName} · ${row.areaLabel}`}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function ProductResults({
  query,
  onSelect,
}: {
  query: string;
  onSelect: () => void;
}) {
  const { data, isPending } = useProductsListQuery();
  const rows = useMemo(() => {
    const needle = query.toLowerCase();
    return (data ?? [])
      .filter((row) =>
        [row.name, row.primarySkuCode, row.primarySkuName, row.categoryName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 4);
  }, [data, query]);

  if (isPending) {
    return <li className="ga-command__status">Loading products…</li>;
  }
  return (
    <>
      {rows.map((row) => (
        <ResultLink
          key={row.id}
          to={`/products/${row.id}`}
          eyebrow="Product"
          title={row.name}
          detail={[row.primarySkuCode, row.categoryName].filter(Boolean).join(' · ')}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export function AdminCommandSearch({ groups }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const close = () => {
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const normalized = query.trim().toLowerCase();
  const routes = filterCommandRoutes(groups, normalized);
  const canSearchCustomers = groups.some((group) =>
    group.items.some((item) => item.id === 'customers'),
  );
  const canSearchProducts = groups.some((group) =>
    group.items.some((item) => item.id === 'products'),
  );

  return (
    <>
      <button
        type="button"
        className="ga-command__trigger"
        onClick={() => setOpen(true)}
        aria-label="Search RichlyBook"
      >
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>

      {open ? (
        <div className="ga-command" role="dialog" aria-modal="true" aria-label="Search">
          <button
            type="button"
            className="ga-command__backdrop"
            aria-label="Close search"
            onClick={close}
          />
          <div className="ga-command__panel">
            <label className="ga-command__input-wrap">
              <span className="ga-sr-only">Search pages, customers, and products</span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages, customers, products…"
              />
              <kbd>Esc</kbd>
            </label>

            <div className="ga-command__body">
              {normalized.length < 2 ? (
                <p className="ga-command__empty">
                  Type at least 2 characters to find anything in RichlyBook.
                </p>
              ) : (
                <ul className="ga-command__results">
                  {routes.map((item) => (
                    <ResultLink
                      key={`route-${item.id}`}
                      to={item.path}
                      eyebrow={item.groupLabel ?? 'Page'}
                      title={item.label}
                      onSelect={close}
                    />
                  ))}
                  {canSearchCustomers ? (
                    <CustomerResults query={normalized} onSelect={close} />
                  ) : null}
                  {canSearchProducts ? (
                    <ProductResults query={normalized} onSelect={close} />
                  ) : null}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
