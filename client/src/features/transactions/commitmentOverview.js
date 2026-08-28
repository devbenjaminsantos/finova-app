export function sortInstallmentPlans(plans) {
  return [...plans].sort((left, right) =>
    (left.description || "").localeCompare(right.description || "")
  );
}

export function sortRecurringRules(rules) {
  return [...rules].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    return (left.nextOccurrenceDate || "9999-12-31").localeCompare(
      right.nextOccurrenceDate || "9999-12-31"
    );
  });
}

export function getInstallmentOverview(groups) {
  return groups.reduce(
    (accumulator, group) => {
      const nextInstallmentAmount =
        group.nextInstallmentDate && group.nextInstallmentIndex
          ? Number(group.amountPerInstallmentCents) || 0
          : 0;

      return {
        openPlans: accumulator.openPlans + 1,
        remainingAmountCents:
          accumulator.remainingAmountCents + (Number(group.remainingAmountCents) || 0),
        upcomingInstallments:
          accumulator.upcomingInstallments + (Number(group.upcomingInstallments) || 0),
        nextInstallmentsAmountCents:
          accumulator.nextInstallmentsAmountCents + nextInstallmentAmount,
      };
    },
    {
      openPlans: 0,
      remainingAmountCents: 0,
      upcomingInstallments: 0,
      nextInstallmentsAmountCents: 0,
    }
  );
}

export function getRecurringOverview(rules) {
  return rules.reduce(
    (accumulator, rule) => ({
      activeRules: accumulator.activeRules + (rule.isActive ? 1 : 0),
      nextMonthAmountCents:
        accumulator.nextMonthAmountCents +
        (rule.isActive && rule.nextOccurrenceDate ? Number(rule.amountCents) || 0 : 0),
    }),
    {
      activeRules: 0,
      nextMonthAmountCents: 0,
    }
  );
}
