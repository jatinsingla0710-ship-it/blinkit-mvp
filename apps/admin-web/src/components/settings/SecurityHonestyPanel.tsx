import {
  PHASE_24_SECURITY_HONESTY,
  SENSITIVE_CONFIRM_ACTIONS,
} from '@/data/ai-tool-permissions';
import {
  AI_ASSISTED_SURFACES,
  AI_QUALITY_IMPROVEMENT_BACKLOG,
  AI_QUALITY_INVARIANTS,
  PHASE_28_AI_QUALITY_HONESTY,
} from '@/data/ai-quality';
import {
  PHASE_27_PRODUCTION_QA_HONESTY,
  PRODUCTION_SAFETY_RULES,
  formatDeploymentStatusClaim,
  mustProductionQaChecks,
} from '@/data/production-qa';
import './SecurityHonestyPanel.css';

/**
 * Settings honesty: Security (24) + Production QA (27) + AI quality (28).
 */
export function SecurityHonestyPanel() {
  const mustChecks = mustProductionQaChecks();

  return (
    <section className="ga-security-honesty" aria-label="Security and audit">
      <h3 className="ga-security-honesty__title">Security &amp; audit</h3>
      <p className="ga-security-honesty__body">{PHASE_24_SECURITY_HONESTY}</p>
      <h4 className="ga-security-honesty__subtitle">
        Confirm before money posts
      </h4>
      <ul className="ga-security-honesty__list">
        {SENSITIVE_CONFIRM_ACTIONS.map((action) => (
          <li key={action.id}>
            <strong>{action.label}</strong>
            <span>{action.detail}</span>
          </li>
        ))}
      </ul>
      <p className="ga-security-honesty__foot">
        Order activity and scan confirmations keep actor + timestamp trails on
        those flows. There is not yet a single AI audit warehouse for every
        assistant answer.
      </p>

      <h3 className="ga-security-honesty__title">Production QA &amp; migrations</h3>
      <p className="ga-security-honesty__body">{PHASE_27_PRODUCTION_QA_HONESTY}</p>
      <h4 className="ga-security-honesty__subtitle">Safety rules</h4>
      <ul className="ga-security-honesty__list">
        {PRODUCTION_SAFETY_RULES.map((rule) => (
          <li key={rule}>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
      <h4 className="ga-security-honesty__subtitle">Must-gates before hosted migrate</h4>
      <ul className="ga-security-honesty__list">
        {mustChecks.map((check) => (
          <li key={check.id}>
            <strong>{check.label}</strong>
            <span>{check.detail}</span>
          </li>
        ))}
      </ul>
      <pre className="ga-security-honesty__claim">{formatDeploymentStatusClaim()}</pre>

      <h3 className="ga-security-honesty__title">AI quality &amp; monitoring</h3>
      <p className="ga-security-honesty__body">{PHASE_28_AI_QUALITY_HONESTY}</p>
      <h4 className="ga-security-honesty__subtitle">Assisted surfaces</h4>
      <ul className="ga-security-honesty__list">
        {AI_ASSISTED_SURFACES.map((surface) => (
          <li key={surface.id}>
            <strong>
              {surface.label} · {surface.extractorOrEngine}
            </strong>
            <span>{surface.monitoringNote}</span>
          </li>
        ))}
      </ul>
      <h4 className="ga-security-honesty__subtitle">Quality invariants</h4>
      <ul className="ga-security-honesty__list">
        {AI_QUALITY_INVARIANTS.map((rule) => (
          <li key={rule}>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
      <h4 className="ga-security-honesty__subtitle">Improvement backlog</h4>
      <ul className="ga-security-honesty__list">
        {AI_QUALITY_IMPROVEMENT_BACKLOG.map((item) => (
          <li key={item.id}>
            <strong>
              {item.label} · {item.status.replace('_', ' ')}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
