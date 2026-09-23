import type {
  ServiceArea,
  ServiceabilityEvaluationInput,
  ServiceabilityEvaluationResult,
  ServiceabilityRule,
} from '@groaurum/shared-types';

function compareAreas(a: ServiceArea, b: ServiceArea): number {
  if (a.displayOrder !== b.displayOrder) {
    return a.displayOrder - b.displayOrder;
  }
  return a.name.localeCompare(b.name);
}

function pinMatches(rule: ServiceabilityRule, pinCode: string): boolean {
  if (rule.ruleType !== 'PIN_CODE' || rule.config.ruleType !== 'PIN_CODE') {
    return false;
  }
  return rule.config.pinCodes.includes(pinCode);
}

/** True when the selected active service area has an active PIN_CODE rule for this PIN. */
export function serviceAreaAcceptsPin(
  serviceAreaId: string,
  pinCode: string,
  areas: ServiceArea[],
  rules: ServiceabilityRule[],
): boolean {
  const area = areas.find((row) => row.id === serviceAreaId);
  if (!area?.isActive) return false;
  const pin = pinCode.trim();
  if (!/^[0-9]{6}$/.test(pin)) return false;
  return rules.some(
    (rule) =>
      rule.serviceAreaId === serviceAreaId &&
      rule.isActive &&
      pinMatches(rule, pin),
  );
}

function adminAreaMatches(rule: ServiceabilityRule, adminAreaCode: string): boolean {
  if (rule.ruleType !== 'ADMIN_AREA' || rule.config.ruleType !== 'ADMIN_AREA') {
    return false;
  }
  return rule.config.areaCodes.includes(adminAreaCode);
}

/**
 * Pure serviceability evaluator (PIN_CODE + ADMIN_AREA).
 * Polygon rules are reported as UNSUPPORTED_RULE_TYPE when they are the only candidates.
 *
 * Multiple matches: first active area by displayOrder ascending, then name.
 */
export function evaluateServiceabilityRules(
  areas: ServiceArea[],
  rules: ServiceabilityRule[],
  input: ServiceabilityEvaluationInput,
): ServiceabilityEvaluationResult {
  try {
    const hasPin = Boolean(input.pinCode && input.pinCode.trim());
    const hasAdmin = Boolean(input.adminAreaCode && input.adminAreaCode.trim());

    if (!hasPin && !hasAdmin) {
      return {
        status: 'INSUFFICIENT_ADDRESS_DATA',
        serviceable: false,
        serviceArea: null,
        matchedRuleId: null,
        message: 'PIN code or admin area code is required for serviceability evaluation.',
      };
    }

    const pinCode = input.pinCode?.trim() ?? '';
    const adminAreaCode = input.adminAreaCode?.trim() ?? '';

    const activeAreas = areas.filter((area) => area.isActive).sort(compareAreas);
    const activeRules = rules.filter((rule) => rule.isActive);

    let sawUnsupportedOnlyMatch = false;

    for (const area of activeAreas) {
      const areaRules = activeRules.filter((rule) => rule.serviceAreaId === area.id);

      for (const rule of areaRules) {
        if (rule.ruleType === 'POLYGON') {
          if (hasPin || hasAdmin) {
            sawUnsupportedOnlyMatch = true;
          }
          continue;
        }

        if (rule.ruleType === 'PIN_CODE' && hasPin && pinMatches(rule, pinCode)) {
          return {
            status: 'SERVICEABLE',
            serviceable: true,
            serviceArea: area,
            matchedRuleId: rule.id,
          };
        }

        if (
          rule.ruleType === 'ADMIN_AREA' &&
          hasAdmin &&
          adminAreaMatches(rule, adminAreaCode)
        ) {
          return {
            status: 'SERVICEABLE',
            serviceable: true,
            serviceArea: area,
            matchedRuleId: rule.id,
          };
        }
      }
    }

    if (sawUnsupportedOnlyMatch) {
      const onlyPolygon = activeRules.every((r) => r.ruleType === 'POLYGON');
      if (onlyPolygon || activeRules.some((r) => r.ruleType === 'POLYGON')) {
        // If no supported rule matched but polygon rules exist, report unsupported
        // only when no PIN/ADMIN_AREA rules were available to evaluate.
        const hasSupported = activeRules.some(
          (r) => r.ruleType === 'PIN_CODE' || r.ruleType === 'ADMIN_AREA',
        );
        if (!hasSupported) {
          return {
            status: 'UNSUPPORTED_RULE_TYPE',
            serviceable: false,
            serviceArea: null,
            matchedRuleId: null,
            message: 'Polygon serviceability matching is not implemented.',
          };
        }
      }
    }

    return {
      status: 'NOT_SERVICEABLE',
      serviceable: false,
      serviceArea: null,
      matchedRuleId: null,
      message: 'No active serviceability rule matched the provided address data.',
    };
  } catch (error) {
    return {
      status: 'ERROR',
      serviceable: false,
      serviceArea: null,
      matchedRuleId: null,
      message: error instanceof Error ? error.message : 'Serviceability evaluation failed.',
    };
  }
}
