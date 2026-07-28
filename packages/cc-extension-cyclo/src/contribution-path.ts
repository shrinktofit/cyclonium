import { relative } from 'node:path';

export function toExtensionRelativeContributionPath(
  packagePath: string,
  contributionPath: string,
): string {
  return relative(packagePath, contributionPath).replaceAll('\\', '/');
}
