import { useEffect, useState } from 'react';
import { Modal, Button } from '@groaurum/ui';
import {
  parsePinCodeList,
  pinCodesSchema,
} from '@groaurum/validation';
import type { ServiceAreaListItem } from '@/data/service-area-model';
import {
  useCreateServiceabilityRuleMutation,
  useUpdateServiceabilityRuleMutation,
} from '@/data/mutations';
import './ServiceAreaFormModal.css';

type Props = {
  open: boolean;
  area: ServiceAreaListItem | null;
  onClose: () => void;
};

export function ServiceAreaPinsModal({ open, area, onClose }: Props) {
  const createRule = useCreateServiceabilityRuleMutation();
  const updateRule = useUpdateServiceabilityRuleMutation();
  const [rawPins, setRawPins] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !area) return;
    setError(null);
    setRawPins(area.pinCodes.join('\n'));
  }, [open, area]);

  const pending = createRule.isPending || updateRule.isPending;

  const onSubmit = () => {
    if (!area) return;
    const parsed = pinCodesSchema.safeParse(parsePinCodeList(rawPins));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid PIN codes');
      return;
    }
    setError(null);
    if (area.pinRuleId) {
      updateRule.mutate(
        { id: area.pinRuleId, input: { pinCodes: parsed.data } },
        {
          onSuccess: () => onClose(),
          onError: (err) =>
            setError(err instanceof Error ? err.message : 'Update failed'),
        },
      );
      return;
    }
    createRule.mutate(
      {
        serviceAreaId: area.id,
        ruleType: 'PIN_CODE',
        pinCodes: parsed.data,
        isActive: true,
      },
      {
        onSuccess: () => onClose(),
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Create failed'),
      },
    );
  };

  return (
    <Modal
      open={open}
      title={area ? `PIN codes · ${area.name}` : 'PIN codes'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Save PIN Codes'}
          </Button>
        </>
      }
    >
      <div className="ga-sa-form">
        <label className="ga-sa-form__textarea">
          <span className="ga-sa-form__label">PIN codes</span>
          <textarea
            value={rawPins}
            onChange={(e) => setRawPins(e.target.value)}
            rows={8}
            placeholder={'110017\n110019\n110020'}
            spellCheck={false}
          />
        </label>
        <p className="ga-sa-form__hint">
          One 6-digit PIN per line. Commas are also accepted. Duplicates are
          rejected.
        </p>
        {error ? <p className="ga-sa-form__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
