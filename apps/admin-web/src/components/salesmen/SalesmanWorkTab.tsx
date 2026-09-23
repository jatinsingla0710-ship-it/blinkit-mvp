import type { SalesmanDetail } from '@/data/salesmen-types';
import { SalesmanCustomersTab } from '@/components/salesmen/SalesmanCustomersTab';
import { Field, FieldGrid } from '@groaurum/ui';
import './SalesmanWorkTab.css';

type Props = {
  salesman: SalesmanDetail;
  onCreateOrder?: (customerId: string) => void;
  onReassign?: (customerId: string) => void;
};

/** Work tab — service area, schedule, and assigned shops. */
export function SalesmanWorkTab({
  salesman,
  onCreateOrder,
  onReassign,
}: Props) {
  const emp = salesman.employment;

  return (
    <div className="ga-sm-work">
      <FieldGrid columns={3}>
        <Field label="Service area">
          {emp?.primaryServiceAreaLabel ?? salesman.territory ?? '—'}
        </Field>
        <Field label="Working days">{emp?.workingDaysLabel ?? '—'}</Field>
        <Field label="Weekly off">{emp?.weeklyOffLabel ?? '—'}</Field>
        <Field label="Assigned shops">{salesman.assignedCustomersCount}</Field>
        <Field label="Earning model">
          {salesman.employment?.earningModel === 'COMMISSION'
            ? 'Commission'
            : salesman.employment?.earningModel === 'SALARY_PLUS_COMMISSION'
              ? 'Salary + Commission'
              : 'Salary'}
        </Field>
      </FieldGrid>

      <section className="ga-sm-work__shops">
        <h3 className="ga-sm-work__heading">Assigned shops</h3>
        <p className="ga-sm-work__hint">
          Shops are assigned from Customers or via salesman reassign — not from
          this screen.
        </p>
        <SalesmanCustomersTab
          rows={salesman.assignedCustomers}
          onCreateOrder={onCreateOrder}
          onReassign={onReassign}
        />
      </section>
    </div>
  );
}
