import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import type { SalesmanAttendanceStatus } from '@groaurum/api-client';
import type { BadgeTone } from '@groaurum/ui';
import { Badge, Button, Card, EmptyState, PageHeader } from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { deriveAttendanceControls } from '@/data/attendance-controls';
import { useState } from 'react';

function attendanceTone(status: SalesmanAttendanceStatus): BadgeTone {
  switch (status) {
    case 'PRESENT':
      return 'success';
    case 'ABSENT':
      return 'danger';
    case 'WEEKLY_OFF':
    case 'HOLIDAY':
      return 'neutral';
    case 'PAID_LEAVE':
    case 'UNPAID_LEAVE':
      return 'warning';
    default:
      return 'neutral';
  }
}

function attendanceStatusLabel(status: SalesmanAttendanceStatus): string {
  switch (status) {
    case 'PRESENT':
      return 'Present';
    case 'ABSENT':
      return 'Absent';
    case 'WEEKLY_OFF':
      return 'Weekly off';
    case 'HOLIDAY':
      return 'Holiday';
    case 'PAID_LEAVE':
      return 'Paid leave';
    case 'UNPAID_LEAVE':
      return 'Unpaid leave';
    default:
      return status;
  }
}

export function DashboardPage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const profileId = user?.id ?? '';
  const [dayError, setDayError] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sales', 'dashboard', profileId],
    queryFn: () => api.getDashboard(profileId),
    enabled: Boolean(profileId),
  });

  const attendanceQuery = useQuery({
    queryKey: ['sales', 'attendance', 'today', profileId],
    queryFn: () => api.getTodayAttendance(profileId),
    enabled: Boolean(profileId),
  });
  const attendance = attendanceQuery.data;

  const invalidateAttendance = () =>
    queryClient.invalidateQueries({
      queryKey: ['sales', 'attendance', 'today', profileId],
    });

  const startDayMutation = useMutation({
    mutationFn: () => api.startDay(),
    onSuccess: () => {
      setDayError(null);
      void invalidateAttendance();
    },
    onError: (err: unknown) => {
      setDayError(
        err instanceof Error ? err.message : 'Could not start day',
      );
    },
  });

  const endDayMutation = useMutation({
    mutationFn: () => api.endDay(),
    onSuccess: () => {
      setDayError(null);
      void invalidateAttendance();
    },
    onError: (err: unknown) => {
      setDayError(err instanceof Error ? err.message : 'Could not end day');
    },
  });

  const { view: attendanceView, canStartDay, canEndDay } =
    deriveAttendanceControls({
      enabled: Boolean(profileId),
      isLoading: attendanceQuery.isLoading,
      isError: attendanceQuery.isError,
      attendance,
    });
  const dayBusy = startDayMutation.isPending || endDayMutation.isPending;

  return (
    <div className="ga-sales-stack">
      <PageHeader
        title="Dashboard"
        subtitle={user?.displayName ? `Hi, ${user.displayName}` : 'Today’s focus'}
      />

      <Card title="Today">
        {attendanceView === 'unavailable' ? (
          <p className="ga-sales-muted">
            Attendance is unavailable until your profile loads.
          </p>
        ) : null}

        {attendanceView === 'loading' ? (
          <p className="ga-sales-muted">Loading attendance…</p>
        ) : null}

        {attendanceView === 'error' ? (
          <div className="ga-sales-stack" role="alert">
            <p className="ga-sales-error">
              Could not load today&apos;s attendance
              {attendanceQuery.error instanceof Error
                ? `: ${attendanceQuery.error.message}`
                : '.'}{' '}
              Start Day and End Day are paused until it loads.
            </p>
            <div className="ga-sales-actions">
              <Button
                variant="secondary"
                type="button"
                disabled={attendanceQuery.isFetching}
                onClick={() => {
                  void attendanceQuery.refetch();
                }}
              >
                {attendanceQuery.isFetching ? 'Retrying…' : 'Retry'}
              </Button>
            </div>
          </div>
        ) : null}

        {attendanceView === 'recorded' && attendance ? (
          <div className="ga-sales-attendance">
            <Badge tone={attendanceTone(attendance.status)}>
              {attendanceStatusLabel(attendance.status)}
            </Badge>
            {attendance.status === 'PRESENT' ? (
              <p className="ga-sales-muted">
                {attendance.dayStartedAtLabel
                  ? `Started ${attendance.dayStartedAtLabel}`
                  : 'Not started'}
                {attendance.dayEndedAtLabel
                  ? ` · Ended ${attendance.dayEndedAtLabel}`
                  : ''}
              </p>
            ) : (
              <p className="ga-sales-muted">
                Marked as {attendanceStatusLabel(attendance.status).toLowerCase()}{' '}
                for today
              </p>
            )}
          </div>
        ) : null}

        {attendanceView === 'not_started' ? (
          <p className="ga-sales-muted">Day not started yet</p>
        ) : null}

        {dayError ? <p className="ga-sales-error">{dayError}</p> : null}

        <div className="ga-sales-actions ga-sales-today-actions">
          <Button
            variant="primary"
            type="button"
            disabled={!canStartDay || dayBusy}
            onClick={() => {
              setDayError(null);
              startDayMutation.mutate();
            }}
          >
            {startDayMutation.isPending ? 'Starting…' : 'Start Day'}
          </Button>

          <Link to="/visits">
            <Button variant="secondary">Today&apos;s Visits</Button>
          </Link>

          <Link to="/customers">
            <Button variant="secondary">Assigned shops</Button>
          </Link>

          <Link to="/orders/new">
            <Button variant="secondary">Orders</Button>
          </Link>

          <Button
            variant="ghost"
            type="button"
            disabled={!canEndDay || dayBusy}
            onClick={() => {
              setDayError(null);
              endDayMutation.mutate();
            }}
          >
            {endDayMutation.isPending ? 'Ending…' : 'End Day'}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Card>
          <EmptyState title="Loading KPIs" detail="Fetching your field summary…" />
        </Card>
      ) : null}

      {isError ? (
        <p className="ga-sales-error">
          {error instanceof Error ? error.message : 'Failed to load dashboard'}
        </p>
      ) : null}

      {data ? (
        <div className="ga-sales-kpi-grid">
          <div className="ga-sales-kpi">
            <p className="ga-sales-kpi__label">Assigned retailers</p>
            <p className="ga-sales-kpi__value">{data.assignedRetailers}</p>
          </div>
          <div className="ga-sales-kpi">
            <p className="ga-sales-kpi__label">Today&apos;s visits</p>
            <p className="ga-sales-kpi__value">{data.todaysVisits}</p>
          </div>
          <div className="ga-sales-kpi">
            <p className="ga-sales-kpi__label">Pending activations</p>
            <p className="ga-sales-kpi__value">{data.pendingActivations}</p>
          </div>
          <div className="ga-sales-kpi">
            <p className="ga-sales-kpi__label">Orders collected</p>
            <p className="ga-sales-kpi__value">{data.ordersCollected}</p>
          </div>
          <div className="ga-sales-kpi" style={{ gridColumn: '1 / -1' }}>
            <p className="ga-sales-kpi__label">Revenue this month</p>
            <p className="ga-sales-kpi__value">{data.revenueThisMonthLabel}</p>
          </div>
        </div>
      ) : null}

      <Card title="Quick actions">
        <div className="ga-sales-actions">
          <Link to="/customers/new">
            <Button variant="primary">New retailer</Button>
          </Link>
          <Link to="/orders/new">
            <Button variant="secondary">Create order</Button>
          </Link>
          <Link to="/visits">
            <Button variant="ghost">Today&apos;s visits</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
