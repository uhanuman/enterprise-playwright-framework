import { runNpmAudit, assertSeverityThreshold, AuditResult } from '../src/security/scan.js';

const maxHighCritical = Number(process.env.SECURITY_MAX_HIGH_CRITICAL ?? '0');

async function main(): Promise<void> {
  console.log('Running npm audit...');
  let result: AuditResult;
  try {
    result = await runNpmAudit();
  } catch (error) {
    console.error(`npm audit could not be executed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  console.log('Audit summary:', JSON.stringify(result.summary));

  try {
    assertSeverityThreshold(result, maxHighCritical);
    console.log('Security scan passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();