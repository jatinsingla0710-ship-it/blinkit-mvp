import type { ActivationStage } from '@/data/customers-types';
import { Card } from '@/components/ui/Card';
import './ActivationWorkflow.css';

type Props = {
  stages: ActivationStage[];
};

/**
 * Retailer activation rail — Created → Invitation created → Activated.
 * No OTP stage (no OTP system for shop activation).
 */
export function ActivationWorkflow({ stages }: Props) {
  return (
    <Card title="Activation Workflow">
      <ol className="ga-activation">
        {stages.map((stage, index) => (
          <li key={stage.state} className="ga-activation__item">
            <div className="ga-activation__rail">
              <span
                className={[
                  'ga-activation__dot',
                  stage.stateKind === 'done' ? 'ga-activation__dot--done' : '',
                  stage.stateKind === 'current'
                    ? 'ga-activation__dot--current'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              {index < stages.length - 1 ? (
                <span
                  className={[
                    'ga-activation__line',
                    stage.stateKind === 'done'
                      ? 'ga-activation__line--done'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              ) : null}
            </div>
            <div className="ga-activation__body">
              <p
                className={[
                  'ga-activation__label',
                  stage.stateKind !== 'upcoming'
                    ? 'ga-activation__label--active'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {stage.label}
              </p>
              {stage.at ? (
                <p className="ga-activation__at">{stage.at}</p>
              ) : stage.stateKind === 'upcoming' ? (
                <p className="ga-activation__pending">Pending</p>
              ) : null}
              <p className="ga-activation__detail">{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
