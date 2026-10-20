import type { ArApReconciliationView } from '@/data/ar-ap-reconciliation-view';

/**
 * Read-only Books check. Match rules live in buildArApReconciliation.
 */
export function ArApReconciliationPanel({
  view,
}: {
  view: ArApReconciliationView;
}) {
  return (
    <section className="ga-cashbank__card" aria-label="Books check">
      <h2>Books check</h2>
      <p className="ga-cashbank__note">{view.headline}</p>
      <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Side</th>
            <th>In the business</th>
            <th>In Books</th>
            <th>Difference</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {view.sides.map((side) => (
            <tr key={side.id}>
              <td>{side.title}</td>
              <td>{side.domainLabel}</td>
              <td>{side.booksLabel}</td>
              <td>{side.deltaLabel}</td>
              <td>
                {side.statusLabel}
                {side.reason ? (
                  <div className="ga-cashbank__note">{side.reason}</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {view.notes.length > 0 ? (
        <ul className="ga-cashbank__notes">
          {view.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
