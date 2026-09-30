import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, TextField, SelectField, Button } from '@groaurum/ui';
import type { CustomerDetail } from '@/data/customers-types';
import {
  customerContactUpdateSchema,
  customerUpdateSchema,
} from '@groaurum/validation';
import { formatMutationError } from '@/data/mutation-errors';
import { activeServiceAreas } from '@/data/live-entity-helpers';
import { useServiceAreasListQuery } from '@/data/hooks';
import {
  useUpdateCustomerContactMutation,
  useUpdateCustomerMutation,
} from '@/data/mutations';
import {
  formatEditMobileConflictWarning,
  isMobileLookupReady,
} from '@/data/customer-mobile-lookup';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import './CustomerFormModal.css';

type Props = {
  open: boolean;
  customer: CustomerDetail;
  onClose: () => void;
};

type FormState = {
  tradeName: string;
  legalName: string;
  ownerName: string;
  ownerMobile: string;
  ownerEmail: string;
  serviceAreaId: string;
  deliveryAddressLine: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPinCode: string;
  acknowledgeActivatedChange: boolean;
};

export function CustomerEditModal({ open, customer, onClose }: Props) {
  const updateCustomer = useUpdateCustomerMutation();
  const updateContact = useUpdateCustomerContactMutation();
  const { state: areasState } = useServiceAreasListQuery();
  const [form, setForm] = useState<FormState>({
    tradeName: '',
    legalName: '',
    ownerName: '',
    ownerMobile: '',
    ownerEmail: '',
    serviceAreaId: '',
    deliveryAddressLine: '',
    deliveryCity: '',
    deliveryState: '',
    deliveryPinCode: '',
    acknowledgeActivatedChange: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [mobileWarning, setMobileWarning] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const serviceAreas = useMemo(
    () => activeServiceAreas(areasState.data ?? []),
    [areasState.data],
  );

  const hasDigitalAccess = customer.digitalAccess === 'activated';
  const mobileChanged =
    form.ownerMobile.trim() !== '' &&
    form.ownerMobile.trim() !== customer.phoneLabel.replace(/\s/g, ' ').trim() &&
    normalizeDisplayMobile(form.ownerMobile) !==
      normalizeDisplayMobile(customer.phoneLabel);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMobileWarning(null);
    submittingRef.current = false;
    setForm({
      tradeName: customer.shopName,
      legalName: customer.legalName ?? '',
      ownerName: customer.ownerName,
      ownerMobile: displayMobile(customer.phoneLabel),
      ownerEmail: customer.emailLabel ?? '',
      serviceAreaId: customer.serviceAreaId ?? '',
      deliveryAddressLine: customer.deliveryAddressLine ?? '',
      deliveryCity: customer.deliveryCity ?? '',
      deliveryState: customer.deliveryState ?? '',
      deliveryPinCode: customer.deliveryPinCode ?? '',
      acknowledgeActivatedChange: false,
    });
  }, [open, customer]);

  useEffect(() => {
    if (!open || !isMobileLookupReady(form.ownerMobile)) {
      setMobileWarning(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void requireLiveAdminApi()
        .findCustomersByMobile(form.ownerMobile)
        .then((matches) => {
          if (cancelled) return;
          const warning = formatEditMobileConflictWarning(matches, customer.id);
          setMobileWarning(warning || null);
        })
        .catch(() => {
          if (!cancelled) setMobileWarning(null);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, form.ownerMobile, customer.id]);

  const pending = updateCustomer.isPending || updateContact.isPending;

  const onSubmit = async () => {
    if (pending || submittingRef.current) return;
    setError(null);

    const shopParsed = customerUpdateSchema.safeParse({
      tradeName: form.tradeName.trim(),
      legalName: form.legalName.trim() || undefined,
      serviceAreaId: form.serviceAreaId || null,
      deliveryAddressLine: form.deliveryAddressLine.trim(),
      deliveryCity: form.deliveryCity.trim(),
      deliveryState: form.deliveryState.trim(),
      deliveryPinCode: form.deliveryPinCode.trim(),
    });
    if (!shopParsed.success) {
      setError(formatMutationError(shopParsed.error, 'Invalid customer details'));
      return;
    }

    const contactParsed = customerContactUpdateSchema.safeParse({
      ownerName: form.ownerName.trim(),
      ownerMobile: form.ownerMobile.trim(),
      ownerEmail: form.ownerEmail.trim() || undefined,
      acknowledgeActivatedChange: form.acknowledgeActivatedChange,
    });
    if (!contactParsed.success) {
      setError(formatMutationError(contactParsed.error, 'Invalid contact details'));
      return;
    }

    if (
      hasDigitalAccess &&
      mobileChanged &&
      !form.acknowledgeActivatedChange
    ) {
      setError(
        'This customer has a linked login. Confirm that changing the mobile may require them to verify the new number.',
      );
      return;
    }

    submittingRef.current = true;
    try {
      await updateCustomer.mutateAsync({
        id: customer.id,
        input: shopParsed.data,
      });
      await updateContact.mutateAsync({
        shopId: customer.id,
        input: contactParsed.data,
      });
      submittingRef.current = false;
      onClose();
    } catch (err) {
      submittingRef.current = false;
      setError(formatMutationError(err, 'Could not update customer'));
    }
  };

  return (
    <Modal
      open={open}
      title="Edit customer"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void onSubmit()} disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="ga-cust-form">
        <p className="ga-cust-form__hint" role="status">
          Update shop profile and primary contact. Salesman assignment uses Reassign
          Salesman.
        </p>

        <TextField
          label="Shop / trade name"
          value={form.tradeName}
          onChange={(e) => setForm((f) => ({ ...f, tradeName: e.target.value }))}
        />
        <TextField
          label="Legal name (optional)"
          value={form.legalName}
          onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
        />

        <h3 className="ga-cust-form__section">Primary contact</h3>
        <TextField
          label="Contact name"
          value={form.ownerName}
          onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
        />
        <TextField
          label="Primary mobile"
          value={form.ownerMobile}
          onChange={(e) =>
            setForm((f) => ({ ...f, ownerMobile: e.target.value }))
          }
          placeholder="10-digit mobile"
        />
        {mobileWarning ? (
          <p className="ga-cust-form__warning">{mobileWarning}</p>
        ) : null}
        <TextField
          label="Email (optional)"
          value={form.ownerEmail}
          onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
        />

        {hasDigitalAccess && mobileChanged ? (
          <div className="ga-cust-form__access-note">
            <label className="ga-cust-form__confirm">
              <input
                type="checkbox"
                checked={form.acknowledgeActivatedChange}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    acknowledgeActivatedChange: e.target.checked,
                  }))
                }
              />
              I understand the customer may need to verify the new mobile number
              before it becomes their login number.
            </label>
          </div>
        ) : null}

        <h3 className="ga-cust-form__section">Address & territory</h3>
        <SelectField
          label="Service area"
          value={form.serviceAreaId}
          onChange={(serviceAreaId) => setForm((f) => ({ ...f, serviceAreaId }))}
        >
          <option value="">Select service area</option>
          {serviceAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Delivery address line"
          value={form.deliveryAddressLine}
          onChange={(e) =>
            setForm((f) => ({ ...f, deliveryAddressLine: e.target.value }))
          }
        />
        <TextField
          label="City"
          value={form.deliveryCity}
          onChange={(e) => setForm((f) => ({ ...f, deliveryCity: e.target.value }))}
        />
        <TextField
          label="State"
          value={form.deliveryState}
          onChange={(e) =>
            setForm((f) => ({ ...f, deliveryState: e.target.value }))
          }
        />
        <TextField
          label="PIN code"
          value={form.deliveryPinCode}
          onChange={(e) =>
            setForm((f) => ({ ...f, deliveryPinCode: e.target.value }))
          }
        />
        {error ? <p className="ga-cust-form__error">{error}</p> : null}
      </div>
    </Modal>
  );
}

function displayMobile(mobile: string): string {
  if (mobile === '—') return '';
  return mobile.replace(/\s/g, '');
}

function normalizeDisplayMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return mobile.trim();
}
