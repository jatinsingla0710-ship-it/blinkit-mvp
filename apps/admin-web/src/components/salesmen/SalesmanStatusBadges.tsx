import type {
  SalesmanAttendanceStatusVm,
  SalesmanStatus,
  VisitStatus,
} from '@/data/salesmen-types';
import { Badge } from '@/components/ui/Badge';

export function SalesmanStatusBadge({ status }: { status: SalesmanStatus }) {
  switch (status) {
    case 'active':
      return <Badge tone="success">Active</Badge>;
    case 'on_leave':
      return <Badge tone="warning">On Leave</Badge>;
    case 'inactive':
      return <Badge tone="neutral">Inactive</Badge>;
    case 'suspended':
      return <Badge tone="danger">Suspended</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  switch (status) {
    case 'completed':
      return <Badge tone="success">Completed</Badge>;
    case 'planned':
      return <Badge tone="info">Planned</Badge>;
    case 'missed':
      return <Badge tone="danger">Missed</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

export function AttendanceStatusBadge({
  status,
}: {
  status: SalesmanAttendanceStatusVm;
}) {
  switch (status) {
    case 'PRESENT':
      return <Badge tone="success">Present</Badge>;
    case 'ABSENT':
      return <Badge tone="danger">Absent</Badge>;
    case 'PAID_LEAVE':
      return <Badge tone="info">Paid leave</Badge>;
    case 'UNPAID_LEAVE':
      return <Badge tone="warning">Unpaid leave</Badge>;
    case 'HOLIDAY':
      return <Badge tone="neutral">Holiday</Badge>;
    case 'WEEKLY_OFF':
      return <Badge tone="neutral">Weekly off</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}
