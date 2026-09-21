import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const a11yTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type A11yOptions = {
  // Turns the listed rules off **only** inside `selector`, for markup rendered
  // by a third-party library. The rest of the page is still checked with every
  // rule, and no rule is ever turned off for the whole page.
  disableRulesWithin?: { selector: string; rules: string[] };
};

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
type Violation = AxeResults['violations'][number];

const seriousOrCriticalOnly = (violations: Violation[]): Violation[] =>
  violations.filter(
    (violation) =>
      violation.impact === 'critical' || violation.impact === 'serious',
  );

export async function expectNoSeriousA11yViolations(
  page: Page,
  options?: A11yOptions,
): Promise<void> {
  const exclusion = options?.disableRulesWithin;

  const pageBuilder = new AxeBuilder({ page }).withTags(a11yTags);
  if (exclusion) pageBuilder.exclude(exclusion.selector);

  const pageResults = await pageBuilder.analyze();
  const violations = seriousOrCriticalOnly(pageResults.violations);

  if (exclusion) {
    // The excluded subtree is still analysed, only without the listed rules.
    const scopedResults = await new AxeBuilder({ page })
      .include(exclusion.selector)
      .withTags(a11yTags)
      .disableRules(exclusion.rules)
      .analyze();

    violations.push(...seriousOrCriticalOnly(scopedResults.violations));
  }

  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}
