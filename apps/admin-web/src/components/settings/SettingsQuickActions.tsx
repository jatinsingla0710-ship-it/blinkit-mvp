import { ActionBar, Button } from '@groaurum/ui';

export type SettingsQuickActionId =
  | 'update_company'
  | 'add_warehouse'
  | 'add_service_area'
  | 'manage_roles';

type Props = {
  onAction?: (id: SettingsQuickActionId) => void;
};

export function SettingsQuickActions({ onAction }: Props) {
  return (
    <ActionBar>
      <Button variant="primary" onClick={() => onAction?.('update_company')}>
        Update Company
      </Button>
      <Button variant="secondary" onClick={() => onAction?.('add_warehouse')}>
        Add Warehouse
      </Button>
      <Button
        variant="secondary"
        onClick={() => onAction?.('add_service_area')}
      >
        Add Service Area
      </Button>
      <Button variant="secondary" onClick={() => onAction?.('manage_roles')}>
        View Roles & Permissions
      </Button>
    </ActionBar>
  );
}
