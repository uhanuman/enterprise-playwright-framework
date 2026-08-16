import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface Vulnerability {
  name: string;
  severity: 'low' | 'moderate' | 'high' | 'critical' | 'info';
  via: string[];
  effects: string[];
  range: string;
  nodes: string[];
  fixAvailable: boolean | Record<string, unknown>;
}

export interface AuditResult {
  vulnerable: boolean;
  metadata: Record<string, unknown>;
  vulnerabilities: Vulnerability[];
  summary: { critical: number; high: number; moderate: number; low: number; info: number };
}

export interface SecurityScanOptions {
  cwd?: string;
  auditCommand?: string;
  args?: string[];
}

export async function runNpmAudit(options: SecurityScanOptions = {}): Promise<AuditResult> {
  const cwd = options.cwd ?? process.cwd();
  const command = options.auditCommand ?? 'npm';
  const args = options.args ?? ['audit', '--json'];
  const commandLine = [command, ...args].join(' ');

  const { stdout } = await execAsync(commandLine, { cwd, maxBuffer: 10 * 1024 * 1024 }).catch((error) => {
    const execError = error as { stdout?: string; stderr?: string };
    if (execError.stdout) {
      return { stdout: execError.stdout };
    }
    throw new Error(`Command '${commandLine}' failed: ${execError.stderr ?? String(error)}`);
  });

  const raw = JSON.parse(stdout) as {
    vulnerable?: boolean;
    metadata?: Record<string, unknown>;
    vulnerabilities?: Record<string, unknown>;
  };

  const vulnMap = (raw.vulnerabilities ?? {}) as Record<string, unknown>;
  const vulnerabilities: Vulnerability[] = Object.entries(vulnMap).map(([name, value]) => {
    const v = value as Record<string, unknown>;
    return {
      name,
      severity: (v.severity as Vulnerability['severity']) ?? 'unknown',
      via: (v.via as string[]) ?? [],
      effects: (v.effects as string[]) ?? [],
      range: String(v.range ?? ''),
      nodes: (v.nodes as string[]) ?? [],
      fixAvailable: v.fixAvailable as boolean | Record<string, unknown>
    };
  });

  const summary = {
    critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
    high: vulnerabilities.filter((v) => v.severity === 'high').length,
    moderate: vulnerabilities.filter((v) => v.severity === 'moderate').length,
    low: vulnerabilities.filter((v) => v.severity === 'low').length,
    info: vulnerabilities.filter((v) => v.severity === 'info').length
  };

  return {
    vulnerable: raw.vulnerable ?? false,
    metadata: raw.metadata ?? {},
    vulnerabilities,
    summary
  };
}

export function assertSeverityThreshold(result: AuditResult, maxHighCritical: number): void {
  const count = result.summary.critical + result.summary.high;
  if (count > maxHighCritical) {
    throw new Error(
      `Security scan failed: ${count} high/critical vulnerabilities exceed threshold ${maxHighCritical}\n` +
      result.vulnerabilities
        .filter((v) => v.severity === 'critical' || v.severity === 'high')
        .map((v) => `- ${v.severity}: ${v.name} ${v.range}`)
        .join('\n')
    );
  }
}