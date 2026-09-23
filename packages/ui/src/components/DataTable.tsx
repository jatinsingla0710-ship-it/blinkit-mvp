import type { ReactNode, TableHTMLAttributes } from 'react';
import './DataTable.css';

type Props = TableHTMLAttributes<HTMLTableElement> & {
  children: ReactNode;
};

/** Shared dense data table shell for admin consoles. */
export function DataTable({ children, className, ...rest }: Props) {
  return (
    <div className="ga-table-wrap">
      <table
        className={['ga-table', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}
