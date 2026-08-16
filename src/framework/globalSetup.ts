import path from 'node:path';
import { createFrameworkConfig } from '../config/manager.js';
import { ensureArtifactDirs, persistRunMetadata } from './artifactManager.js';

export default async function globalSetup() {
  const config = await createFrameworkConfig(process.cwd());
  await persistRunMetadata(config);
  await ensureArtifactDirs(config);
  const outputDir = path.resolve(config.outputDir);
  return outputDir;
}
