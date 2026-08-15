import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export async function readTextFile(filePath: string): Promise<string> {
  return fsp.readFile(filePath, 'utf8');
}

export function readTextFileSync(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, 'utf8');
}

export function writeTextFileSync(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export async function appendTextFile(filePath: string, content: string): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.appendFile(filePath, content, 'utf8');
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function fileExistsSync(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fsp.mkdir(dirPath, { recursive: true });
}

export function ensureDirSync(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export async function listFiles(dirPath: string, extension?: string): Promise<string[]> {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath, extension)));
    } else if (!extension || entry.name.endsWith(extension)) {
      files.push(fullPath);
    }
  }
  return files;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 120);
}

export function getFileNameWithoutExtension(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

export function getFileExtension(filePath: string): string {
  return path.extname(filePath).replace('.', '');
}

export async function removeFile(filePath: string): Promise<void> {
  try {
    await fsp.unlink(filePath);
  } catch {
    // ignore missing files
  }
}

export async function copyFile(source: string, destination: string): Promise<void> {
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.copyFile(source, destination);
}