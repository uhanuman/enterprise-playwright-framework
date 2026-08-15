import path from 'node:path';
import { writeTextFile, ensureDirSync } from '../src/utils/file.js';
import { createSpecLoader, OperationSpec, HttpMethod } from '../src/api/specLoader.js';

interface GenerateOptions {
  specPath: string;
  outputDir: string;
  baseURL?: string;
  filter?: string;
}

function scaffoldTest(operation: OperationSpec, baseURL: string, importPath: string): string {
  const method = operation.method.toUpperCase();
  const title = operation.operationId ?? `${method} ${operation.path}`;
  const urlTemplate = operation.path
    .split('/')
    .map((segment) => (segment.startsWith('{') ? `\${params.${segment.slice(1, -1)}}` : segment))
    .join('/');

  return `import { test, expect } from '${importPath}';

// Generated scaffold for ${method} ${operation.path}
test('${title} @api', async ({ apiClient, frameworkConfig }) => {
  const params: Record<string, string> = {}; // path params e.g. { id: '1' }
  const query: Record<string, string | number | boolean> = {}; // query params
  const body: Record<string, unknown> = {}; // request body

  const response = await apiClient
    .path('${operation.method}', '${urlTemplate}')
    .withPathParams(params)
    .withQuery(query)
    .withBody(body)
    .send();

  expect(response.status()).toBeGreaterThanOrEqual(200);
  expect(response.status()).toBeLessThan(500);
  console.log('Response status:', response.status());
});
`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const options: GenerateOptions = {
    specPath: args.spec ?? 'specs/openapi/openapi.yaml',
    outputDir: args.output ?? 'generated/api-tests',
    baseURL: args.baseUrl,
    filter: args.filter
  };

  if (!options.baseURL && !process.env.API_BASE_URL) {
    console.warn('No baseURL provided and API_BASE_URL not set; using placeholder in tests.');
  }

  const loader = createSpecLoader();
  const spec = await loader.load(options.specPath);
  const operations = spec.operations.filter((op) =>
    !options.filter || op.path.includes(options.filter) || (op.tags ?? []).includes(options.filter)
  );

  ensureDirSync(options.outputDir);
  const absoluteOutDir = path.resolve(options.outputDir);
  const relativeImport = path.relative(absoluteOutDir, path.join(process.cwd(), 'src', 'framework', 'testBase.js'))
    .replace(/\\/g, '/');
  const importPath = relativeImport.startsWith('.') ? relativeImport : `./${relativeImport}`;

  let count = 0;
  for (const operation of operations) {
    const name = sanitize(operation.operationId ?? `${operation.method}-${operation.path}`);
    const fileName = `${operation.method}-${name}.spec.ts`;
    const content = scaffoldTest(operation, options.baseURL ?? 'http://localhost:8080/api', importPath);
    await writeTextFile(path.join(options.outputDir, fileName), content);
    count++;
  }

  console.log(`Generated ${count} API test scaffolds from ${options.specPath} into ${options.outputDir}`);
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value !== undefined && !value.startsWith('--')) {
        result[key] = value;
        i++;
      } else {
        result[key] = 'true';
      }
    }
  }
  return result;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 100);
}

main();