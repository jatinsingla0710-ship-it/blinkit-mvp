import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { COMPANY_SETTING_KEY } from '@groaurum/validation';
import type { SettingsSectionId } from '@/data/settings-types';
import { CompanyProfileSection } from '@/components/settings/CompanyProfileSection';
import { DeliverySlotsSection } from '@/components/settings/DeliverySlotsSection';
import { NotificationTemplatesSection } from '@/components/settings/NotificationTemplatesSection';
import { PaymentConfigSection } from '@/components/settings/PaymentConfigSection';
import { ServiceAreasSection } from '@/components/settings/ServiceAreasSection';
import {
  SettingsQuickActions,
  type SettingsQuickActionId,
} from '@/components/settings/SettingsQuickActions';
import { SystemPreferencesSection } from '@/components/settings/SystemPreferencesSection';
import { TaxesSection } from '@/components/settings/TaxesSection';
import { UserRolesSection } from '@/components/settings/UserRolesSection';
import { WarehousesSection } from '@/components/settings/WarehousesSection';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useSettingsSnapshotQuery } from '@/data/hooks';
import { useUpsertSettingMutation } from '@/data/mutations';
import './SettingsPage.css';

const TABS: TabItem<SettingsSectionId>[] = [
  { id: 'company', label: 'Company Profile' },
  { id: 'warehouses', label: 'Warehouses' },
  { id: 'service_areas', label: 'Service Areas' },
  { id: 'delivery_slots', label: 'Delivery Slots' },
  { id: 'payments', label: 'Payments' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'taxes', label: 'Taxes' },
  { id: 'roles', label: 'Roles & Permissions' },  { id: 'preferences', label: 'Preferences' },
];

/**
 * Settings & System Configuration — live repository + React Query.
 * Company profile edits persist via settings.company when Supabase adapter is on.
 */
export function SettingsPage() {
  const { state } = useSettingsSnapshotQuery();
  const [section, setSection] = useState<SettingsSectionId>('company');
  const upsertSetting = useUpsertSettingMutation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canEditCompany = hasPermission('settings:manage');

  const onAction = (id: SettingsQuickActionId) => {
    if (id === 'update_company') {
      setSection('company');
      return;
    }
    if (id === 'add_warehouse') {
      navigate('/warehouses');
      return;
    }
    if (id === 'add_service_area') {
      navigate('/service-areas');
      return;
    }
    if (id === 'manage_roles') {
      setSection('roles');
    }
  };

  return (
    <QueryStateGate title="Settings" state={state}>
      {(snapshot) => (
        <div className="ga-st-page">
          <PageHeader
            title="Settings"
            subtitle="Business configuration · system-wide controls"
            meta={snapshot.generatedAtLabel}
          />

          <Card title="Quick Actions">
            <SettingsQuickActions onAction={onAction} />
          </Card>

          <Card className="ga-st-page__main">
            <Tabs items={TABS} active={section} onChange={setSection} />
            <div className="ga-st-page__panel">
              {section === 'company' ? (
                <CompanyProfileSection
                  company={snapshot.company}
                  canEdit={canEditCompany}
                  saving={upsertSetting.isPending}
                  onSave={async (company) => {
                    await upsertSetting.mutateAsync({
                      settingKey: COMPANY_SETTING_KEY,
                      settingValue: company,
                      description: 'Company profile',
                    });
                  }}
                />
              ) : null}
              {section === 'warehouses' ? (
                <WarehousesSection
                  rows={snapshot.warehouses}
                  onAdd={() => {
                    navigate('/warehouses');
                  }}
                />
              ) : null}
              {section === 'service_areas' ? (
                <ServiceAreasSection
                  rows={snapshot.serviceAreas}
                  onAdd={() => {
                    navigate('/service-areas');
                  }}
                />
              ) : null}
              {section === 'delivery_slots' ? (
                <DeliverySlotsSection slots={snapshot.deliverySlots} />
              ) : null}
              {section === 'payments' ? (
                <PaymentConfigSection payments={snapshot.payments} />
              ) : null}
              {section === 'notifications' ? (
                <NotificationTemplatesSection rows={snapshot.notifications} />
              ) : null}
              {section === 'taxes' ? (
                <TaxesSection rows={snapshot.taxes} />
              ) : null}
              {section === 'roles' ? (
                <UserRolesSection rows={snapshot.roles} />
              ) : null}
              {section === 'preferences' ? (
                <SystemPreferencesSection preferences={snapshot.preferences} />
              ) : null}
            </div>
          </Card>
        </div>
      )}
    </QueryStateGate>
  );
}
