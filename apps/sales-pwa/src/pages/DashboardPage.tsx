import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import type { SalesmanAttendanceStatus } from '@groaurum/api-client';
import type { BadgeTone } from '@groaurum/ui';
import { Badge, Button, Card } from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { deriveAttendanceControls } from '@/data/attendance-controls';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState, Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import {
  ChevronRightIcon,
  CustomersIcon,
  OrdersIcon,
  RouteIcon,
} from '@/components/icons';
import { errorMessage } from '@/lib/errors';
import { formatRupees, targetBarWidth } from '@/lib/money';
import { useState } from 'react';
import { readCurrentPosition } from '@/data/geolocation';

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(date = new Date()): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function targetSchemaMissing(error: unknown): boolean {
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : error instanceof Error
        ? error.message
        : '';
  return /schema cache|could not find the function|PGRST202|42883/i.test(message);
}

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
  const toast = useToast();
  const profileId = user?.id ?? '';
  const [dayError, setDayError] = useState<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ['sales', 'dashboard', profileId],
    queryFn: () => api.getDashboard(profileId),
    enabled: Boolean(profileId),
  });
  const data = dashboardQuery.data;

  const attendanceQuery = useQuery({
    queryKey: ['sales', 'attendance', 'today', profileId],
    queryFn: () => api.getTodayAttendance(profileId),
    enabled: Boolean(profileId),
  });
  const attendance = attendanceQuery.data;

  const targetQuery = useQuery({
    queryKey: ['sales', 'target', profileId],
    queryFn: () => api.getMonthTarget(),
    enabled: Boolean(profileId),
  });
  const target = targetQuery.data;
  const targetMissing =
    targetQuery.isError && targetSchemaMissing(targetQuery.error);

  const invalidateAttendance = () =>
    queryClient.invalidateQueries({
      queryKey: ['sales', 'attendance', 'today', profileId],
    });

  const [locating, setLocating] = useState<'start' | 'end' | null>(null);

  const startDayMutation = useMutation({
    mutationFn: (location: { lat: number; lng: number } | null) =>
      api.startDay(undefined, location),
    onSuccess: (result, location) => {
      setDayError(null);
      if (result.alreadyStarted) toast.success('Your day was already started');
      else if (location) toast.success('Day started');
      else toast.success('Day started without a location');
      void invalidateAttendance();
    },
    onError: (err: unknown) => {
      setDayError(
        err instanceof Error ? err.message : 'Could not start day',
      );
    },
  });

  const endDayMutation = useMutation({
    mutationFn: (location: { lat: number; lng: number } | null) =>
      api.endDay(undefined, location),
    onSuccess: (result, location) => {
      setDayError(null);
      if (result.alreadyEnded) toast.success('Your day was already ended');
      else if (location) toast.success('Day ended');
      else toast.success('Day ended without a location');
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
  const dayBusy = startDayMutation.isPending || endDayMutation.isPending || locating !== null;

  async function onStartDay() {
    if (dayBusy) return;
    setDayError(null);
    setLocating('start');
    let location: { lat: number; lng: number } | null = null;
    try {
      location = await readCurrentPosition();
    } catch (err) {
      setDayError(
        err instanceof Error
          ? `${err.message} The day will still start without a location.`
          : 'Location was not captured. The day will still start without a location.',
      );
    }
    startDayMutation.mutate(location);
    setLocating(null);
  }

  async function onEndDay() {
    if (dayBusy) return;
    setDayError(null);
    setLocating('end');
    let location: { lat: number; lng: number } | null = null;
    try {
      location = await readCurrentPosition();
    } catch (err) {
      setDayError(
        err instanceof Error
          ? `${err.message} The day will still end without a location.`
          : 'Location was not captured. The day will still end without a location.',
      );
    }
    endDayMutation.mutate(location);
    setLocating(null);
  }

  const firstName = user?.displayName?.trim().split(/\s+/)[0];

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        subtitle={todayLabel()}
      />

      <Card title="Today's Work">
        {attendanceView === 'unavailable' ? (
          <p className="ga-sales-muted">
            Workday is unavailable until your profile loads.
          </p>
        ) : null}

        {attendanceView === 'loading' ? (
          <div className="ga-sales-attendance" role="status" aria-busy="true">
            <Skeleton width={96} height={24} />
            <p className="ga-sales-muted">Loading today&apos;s work…</p>
          </div>
        ) : null}

        {attendanceView === 'error' ? (
          <ErrorState
            message={`Could not load today's workday${
              attendanceQuery.error instanceof Error
                ? `: ${attendanceQuery.error.message}.`
                : '.'
            } Start Day and End Day are paused until it loads.`}
            onRetry={() => {
              void attendanceQuery.refetch();
            }}
            retrying={attendanceQuery.isFetching}
          />
        ) : null}

        {attendanceView === 'recorded' && attendance ? (
          <div className="ga-sales-attendance">
            <Badge tone={attendanceTone(attendance.status)}>
              {attendance.status === 'PRESENT' && attendance.dayEndedAt
                ? 'Completed'
                : attendance.status === 'PRESENT' && attendance.dayStartedAt
                  ? 'Working'
                  : attendanceStatusLabel(attendance.status)}
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
            <p className="ga-sales-muted">Workday window from 8:00 AM</p>
          </div>
        ) : null}

        {attendanceView === 'not_started' ? (
          <p className="ga-sales-muted">
            Day not started yet · Workday opens at 8:00 AM
          </p>
        ) : null}

        {dayError ? <p className="ga-sales-error">{dayError}</p> : null}

        <div className="ga-sales-day-actions">
          <Button
            variant="primary"
            type="button"
            disabled={!canStartDay || dayBusy}
            onClick={() => void onStartDay()}
          >
            {locating === 'start' || startDayMutation.isPending ? 'Starting…' : 'Start Day'}
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={!canEndDay || dayBusy}
            onClick={() => void onEndDay()}
          >
            {locating === 'end' || endDayMutation.isPending ? 'Ending…' : 'End Day'}
          </Button>
        </div>
      </Card>

      {target ? (
        <section className="ga-sales-target" aria-label="Monthly target">
          <p className="ga-sales-kpi__label">This month&apos;s target</p>
          <p className="ga-sales-target__value">
            {formatRupees(target.achievedAmount)} achieved of {formatRupees(target.targetAmount)}
          </p>
          <div
            className="ga-sales-target__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={targetBarWidth(target.progressPercent)}
            aria-label="Target progress"
          >
            <span
              className="ga-sales-target__fill"
              style={{ width: `${targetBarWidth(target.progressPercent)}%` }}
            />
          </div>
          <p className="ga-sales-target__remaining">
            {formatRupees(target.remainingAmount)} remaining
          </p>
        </section>
      ) : null}

      {targetQuery.isError && !targetMissing ? (
        <ErrorState
          message={errorMessage(targetQuery.error, 'Could not load your target.')}
          onRetry={() => {
            void targetQuery.refetch();
          }}
          retrying={targetQuery.isFetching}
        />
      ) : null}

      <Link to="/visits" className="ga-sales-route-card">
        <span className="ga-sales-route-card__icon">
          <RouteIcon size={26} />
        </span>
        <span className="ga-sales-route-card__text">
          <span className="ga-sales-route-card__title">Today&apos;s route</span>
          <span className="ga-sales-route-card__meta">
            {data
              ? `${data.todaysVisits} ${data.todaysVisits === 1 ? 'shop' : 'shops'} planned today`
              : dashboardQuery.isLoading
                ? 'Loading today’s route…'
                : 'Open your visit list'}
          </span>
        </span>
        <ChevronRightIcon size={22} />
      </Link>

      <section className="ga-sales-quick-grid" aria-label="Quick actions">
        <Link to="/orders/new" className="ga-sales-quick-action">
          <OrdersIcon size={26} />
          <span>New order</span>
        </Link>
        <Link to="/customers/new" className="ga-sales-quick-action">
          <CustomersIcon size={26} />
          <span>Add customer</span>
        </Link>
      </section>

      <section className="ga-sales-stack" aria-labelledby="home-month-heading">
        <h2 id="home-month-heading" className="ga-sales-section-title">
          This month
        </h2>

        {dashboardQuery.isLoading ? (
          <LoadingState label="Loading your field summary…" variant="kpis" rows={4} />
        ) : null}

        {dashboardQuery.isError ? (
          <ErrorState
            message={errorMessage(dashboardQuery.error, 'Could not load your summary.')}
            onRetry={() => {
              void dashboardQuery.refetch();
            }}
            retrying={dashboardQuery.isFetching}
            stale={Boolean(data)}
          />
        ) : null}

        {data ? (
          <div className="ga-sales-kpi-grid">
            <div className="ga-sales-kpi" style={{ gridColumn: '1 / -1' }}>
              <p className="ga-sales-kpi__label">Revenue this month</p>
              <p className="ga-sales-kpi__value">{data.revenueThisMonthLabel}</p>
            </div>
            <div className="ga-sales-kpi">
              <p className="ga-sales-kpi__label">Orders collected</p>
              <p className="ga-sales-kpi__value">{data.ordersCollected}</p>
            </div>
            <div className="ga-sales-kpi">
              <p className="ga-sales-kpi__label">Customers</p>
              <p className="ga-sales-kpi__value">{data.assignedRetailers}</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
