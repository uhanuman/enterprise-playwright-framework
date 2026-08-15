import fs from 'node:fs';
import path from 'node:path';
import type { ArtifactManager } from '../framework/artifactManager.js';

export type ArtifactType = 'logs' | 'traces' | 'screenshots' | 'snapshots' | 'network' | 'reports' | 'quality';

export interface ArtifactReference {
  type: ArtifactType;
  fileName: string;
  filePath: string;
  sizeBytes?: number;
}

export class OutputManager {
  private artifacts: ArtifactReference[] = [];

  constructor(private artifactManager: ArtifactManager) {}

  get runDir(): string {
    return this.artifactManager.getRunDir();
  }

  async write(type: ArtifactType, fileName: string, content: string | Buffer): Promise<string> {
    const filePath = await this.artifactManager.writeArtifact(type, fileName, content);
    this.artifacts.push({
      type,
      fileName,
      filePath,
      sizeBytes: Buffer.isBuffer(content) ? content.byteLength : Buffer.byteLength(content, 'utf8')
    });
    return filePath;
  }

  pathFor(type: ArtifactType, fileName: string): string {
    return this.artifactManager.pathFor(type, fileName);
  }

  list(): ArtifactReference[] {
    return [...this.artifacts];
  }

  async summary(): Promise<Record<string, ArtifactReference[]>> {
    const grouped: Record<string, ArtifactReference[]> = {};
    for (const artifact of this.artifacts) {
      if (!grouped[artifact.type]) grouped[artifact.type] = [];
      grouped[artifact.type].push(artifact);
    }
    return grouped;
  }

  async writeManifest(): Promise<string> {
    const manifestPath = path.join(this.runDir, 'artifacts-manifest.json');
    const walk = (dir: string): string[] => {
      const result: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          result.push(...walk(fullPath));
        } else {
          result.push(fullPath);
        }
      }
      return result;
    };

    const entries = walk(this.runDir)
      .filter((filePath) => path.basename(filePath) !== 'artifacts-manifest.json')
      .map((filePath) => ({ filePath, sizeBytes: fs.statSync(filePath).size }));

    fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2), 'utf8');
    return manifestPath;
  }
}