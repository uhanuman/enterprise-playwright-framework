import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

export interface ZipOptions {
  preserveRoot?: boolean;
}

export function zipFolder(sourceDir: string, destinationZip: string, options: ZipOptions = {}): void {
  const zip = new AdmZip();
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      zip.addLocalFolder(fullPath, options.preserveRoot !== false ? entry.name : undefined);
    } else {
      zip.addLocalFile(fullPath);
    }
  }
  fs.mkdirSync(path.dirname(destinationZip), { recursive: true });
  zip.writeZip(destinationZip);
}

export function zipFiles(files: string[], destinationZip: string): void {
  const zip = new AdmZip();
  for (const file of files) {
    zip.addLocalFile(file);
  }
  fs.mkdirSync(path.dirname(destinationZip), { recursive: true });
  zip.writeZip(destinationZip);
}

export function unzipArchive(zipPath: string, destinationDir: string): void {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destinationDir, true);
}

export function addToZip(zipPath: string, content: string | Buffer, entryName: string): void {
  const zip = new AdmZip(fs.existsSync(zipPath) ? zipPath : undefined);
  zip.addFile(entryName, content);
  zip.writeZip(zipPath);
}

export function readZipEntry(zipPath: string, entryName: string): Buffer {
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry(entryName);
  if (!entry) throw new Error(`Zip entry not found: ${entryName}`);
  return entry.getData();
}

export function zipBufferToFile(content: Buffer, destinationZip: string): void {
  fs.mkdirSync(path.dirname(destinationZip), { recursive: true });
  fs.writeFileSync(destinationZip, content);
}