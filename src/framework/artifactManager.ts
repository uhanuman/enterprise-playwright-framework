import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FrameworkConfig } from '../config/manager.js';

export interface RunMetadata {
  runId: string;
  environment: string;
  startedAt: string;
}

let cachedRunMetadata: RunMetadata | null = null;
const RUN_METADATA_FILE = '.current-run.json';

export function generateRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const hash = crypto.randomBytes(4).toString('hex');
  return `${timestamp}_${hash}`;
}

export function setRunMetadata(metadata: RunMetadata): void {
  cachedRunMetadata = metadata;
}

export async function persistRunMetadata(config: FrameworkConfig): Promise<RunMetadata> {
  const metadata = getRunMetadata();
  const filePath = path.join(config.outputDir, RUN_METADATA_FILE);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(metadata, null, 2), 'utf8');
  return metadata;
}

export async function readPersistedRunMetadata(config: FrameworkConfig): Promise<RunMetadata | null> {
  const filePath = path.join(config.outputDir, RUN_METADATA_FILE);
  if (!fsSync.existsSync(filePath)) return null;
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as RunMetadata;
  } catch {
    return null;
  }
}

export function getRunMetadata(config?: FrameworkConfig): RunMetadata {
  if (cachedRunMetadata) return cachedRunMetadata;
  const persisted = config ? readPersistedRunMetadataSync(config) : null;
  if (persisted) {
    cachedRunMetadata = persisted;
    return persisted;
  }
  cachedRunMetadata = {
    runId: generateRunId(),
    environment: process.env.ENVIRONMENT ?? 'dev',
    startedAt: new Date().toISOString()
  };
  return cachedRunMetadata;
}

function readPersistedRunMetadataSync(config: FrameworkConfig): RunMetadata | null {
  const filePath = path.join(config.outputDir, RUN_METADATA_FILE);
  if (!fsSync.existsSync(filePath)) return null;
  try {
    return JSON.parse(fsSync.readFileSync(filePath, 'utf8')) as RunMetadata;
  } catch {
    return null;
  }
}

export class ArtifactManager {
  private runDir: string;

  constructor(private config: FrameworkConfig, private suiteName = 'default') {
    const meta = getRunMetadata(config);
    this.runDir = path.join(config.outputDir, meta.runId, meta.environment);
  }

  async initialize(): Promise<void> {
    const subdirs = ['logs', 'traces', 'screenshots', 'snapshots', 'network', 'reports', 'quality', this.suiteName];
    for (const dir of subdirs) {
      await fs.mkdir(path.join(this.runDir, dir), { recursive: true });
    }
    await fs.writeFile(
      path.join(this.runDir, 'run-metadata.json'),
      JSON.stringify(getRunMetadata(this.config), null, 2),
      'utf8'
    );
  }

  getRunDir(): string {
    return this.runDir;
  }

  pathFor(type: 'logs' | 'traces' | 'screenshots' | 'snapshots' | 'network' | 'reports' | 'quality', fileName: string): string {
    return path.join(this.runDir, type, fileName);
  }

  async writeArtifact(
    type: 'logs' | 'traces' | 'screenshots' | 'snapshots' | 'network' | 'reports' | 'quality',
    fileName: string,
    content: string | Buffer
  ): Promise<string> {
    const filePath = this.pathFor(type, fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
    return filePath;
  }

  forSuite(suiteName: string): ArtifactManager {
    return new ArtifactManager(this.config, suiteName);
  }
}

export async function ensureArtifactDirs(config: FrameworkConfig): Promise<ArtifactManager> {
  const manager = new ArtifactManager(config);
  await manager.initialize();
  return manager;
}
