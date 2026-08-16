import type { TestInfo } from '@playwright/test';
import { createNetworkRecorder, NetworkRecorder } from '../web/listeners/networkRecorder.js';
import { getRunMetadata } from './artifactManager.js';
import type { FrameworkConfig } from '../config/manager.js';
import type { ArtifactManager } from './artifactManager.js';
import type { FrameworkLogger } from '../logging/logger.js';
import type { Page } from '@playwright/test';

interface HookContext {
  page: Page;
  frameworkConfig: FrameworkConfig;
  frameworkLogger: FrameworkLogger;
  artifactManager: ArtifactManager;
}

export interface AutoHooksFixture {
  _frameworkHooks: [
    (context: HookContext, use: () => Promise<void>, testInfo: TestInfo) => Promise<void>,
    { auto: true }
  ];
}

export function createAutoHooks(): AutoHooksFixture {
  const recorderMap = new Map<string, NetworkRecorder>();

  const fixture = async (
    { page, frameworkConfig, frameworkLogger, artifactManager }: HookContext,
    use: () => Promise<void>,
    testInfo: TestInfo
  ): Promise<void> => {
    frameworkLogger.info(`Test started: ${testInfo.title}`);

    let recorder: NetworkRecorder | undefined;
    if (frameworkConfig.networkRecording) {
      recorder = createNetworkRecorder(page, { enabled: true, captureBodies: true });
      recorder.start();
      recorderMap.set(testInfo.testId, recorder);
    }

    await use();

    if (recorder) {
      recorderMap.delete(testInfo.testId);
      const captures = await recorder.stop();
      if (captures.length > 0) {
        const baseName = sanitize(testInfo.title);
        await artifactManager.writeArtifact('network', `${baseName}.json`, recorder.toJson());
        const curl = captures.slice(0, 20).map((c) => recorder.toCurl(c)).join('\n\n');
        await artifactManager.writeArtifact('network', `${baseName}.curl.txt`, curl);
        const fetchSnippets = captures.slice(0, 20).map((c) => recorder.toFetchSnippet(c)).join('\n\n');
        await artifactManager.writeArtifact('network', `${baseName}.fetch.js`, fetchSnippets);
      }
    }

    if (testInfo.status === 'failed') {
      frameworkLogger.error(`Test failed: ${testInfo.title}`);
      if (page && !page.isClosed()) {
        try {
          const screenshotPath = await artifactManager.writeArtifact(
            'screenshots',
            `${sanitize(testInfo.title)}-failure.png`,
            await page.screenshot({ fullPage: false })
          );
          frameworkLogger.warn(`Failure screenshot: ${screenshotPath}`);
        } catch (error) {
          frameworkLogger.error('Failed to capture failure screenshot', { error: String(error) });
        }
      }
    }

    const meta = getRunMetadata(frameworkConfig);
    await artifactManager.writeArtifact('reports', `${sanitize(testInfo.title)}.test-info.json`, JSON.stringify({
      title: testInfo.title,
      status: testInfo.status,
      durationMs: testInfo.duration,
      runId: meta.runId,
      environment: meta.environment,
      retry: testInfo.retry
    }, null, 2));

    frameworkLogger.info(`Test finished: ${testInfo.title} [${testInfo.status}]`);
  };

  return { _frameworkHooks: [fixture, { auto: true }] };
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 120);
}