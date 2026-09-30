import { IRuleTarget, Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

/**
 *
 * @param scope Construct (stack) where the rule is added.
 * @param name Name for the rule or rules.
 * @param environment Environment name.
 * @param scheduleExpressions Cron expressions for the rule.
 * @param target Target for the rule (e.g. a lambda).
 * @returns List of created rules.
 */
export function createScheduledTrigger(
  scope: Construct,
  appName: string,
  environment: string,
  name: string,
  scheduleExpressions: string[],
  target: IRuleTarget,
): Rule[] {
  const scheduleRules: Rule[] = scheduleExpressions.map((expr: string, index: number) => {
    const ruleName: string = `${name}-Rule${index + 1}`;
    return new Rule(scope, ruleName, {
      ruleName: `${appName}-${environment}-${ruleName}`,
      schedule: Schedule.expression(expr),
    });
  });

  scheduleRules.forEach((rule: Rule) => {
    rule.addTarget(target);
  });
  return scheduleRules;
}

// ADD SCHEDULED TRIGGERS HERE

export function createExampleSchedule(
  scope: Construct,
  appName: string,
  environment: string,
  target: IRuleTarget,
): Rule[] {
  return createScheduledTrigger(
    scope,
    appName,
    environment,
    'Example',
    [
      'cron(0 00 1 * ? *)', // 12:00 AM UTC every 1st day of the month
      'cron(0 00 15 * ? *)', // 12:00 AM UTC every 15th day of the month
    ],
    target,
  );
}
