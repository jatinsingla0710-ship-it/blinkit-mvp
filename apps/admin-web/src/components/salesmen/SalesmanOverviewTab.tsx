import type { SalesmanDetail } from '@/data/salesmen-types';
import { SalesmanStatusBadge } from '@/components/salesmen/SalesmanStatusBadges';
import { Field, FieldGrid } from '@groaurum/ui';

type Props = {
  salesman: SalesmanDetail;
};

function idProofLabel(
  type: NonNullable<SalesmanDetail['employment']>['idProofType'],
): string {
  if (!type) return '—';
  if (type === 'AADHAAR') return 'Aadhaar';
  if (type === 'PAN') return 'PAN';
  return 'Other';
}

/** Profile tab — identity and employment snapshot. */
export function SalesmanOverviewTab({ salesman }: Props) {
  const emp = salesman.employment;

  return (
    <FieldGrid columns={4}>
      <Field label="Name">{salesman.name}</Field>
      <Field label="Mobile">{salesman.phoneLabel}</Field>
      <Field label="Email">{salesman.emailLabel}</Field>
      <Field label="Employee ID">{salesman.employeeId}</Field>
      <Field label="ID proof type">
        {idProofLabel(emp?.idProofType ?? null)}
      </Field>
      <Field label="ID proof number">{emp?.idProofNumber ?? '—'}</Field>
      <Field label="Joining date">
        {emp?.joiningDateLabel ?? salesman.joiningDateLabel}
      </Field>
      <Field label="Status">
        <SalesmanStatusBadge status={salesman.status} />
      </Field>
      {emp?.address ? <Field label="Address">{emp.address}</Field> : null}
    </FieldGrid>
  );
}
