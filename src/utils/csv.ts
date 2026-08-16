import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { readTextFile, writeTextFile } from './file.js';

export interface CsvParseOptions {
  delimiter?: string;
  columns?: string[] | boolean;
  skipEmptyLines?: boolean;
}

export interface CsvStringifyOptions {
  delimiter?: string;
  header?: boolean;
}

export function parseCsv<T = Record<string, string>>(content: string, options: CsvParseOptions = {}): T[] {
  const {
    delimiter = ',',
    columns = true,
    skipEmptyLines = true
  } = options;

  return parse(content, {
    delimiter,
    columns,
    skip_empty_lines: skipEmptyLines,
    bom: true
  }) as T[];
}

export function generateCsv(records: Record<string, unknown>[], options: CsvStringifyOptions = {}): string {
  const { delimiter = ',', header = true } = options;
  return stringify(records, { delimiter, header });
}

export async function readCsvFile<T = Record<string, string>>(filePath: string, options: CsvParseOptions = {}): Promise<T[]> {
  const content = await readTextFile(filePath);
  return parseCsv<T>(content, options);
}

export async function writeCsvFile(filePath: string, records: Record<string, unknown>[], options: CsvStringifyOptions = {}): Promise<void> {
  const content = generateCsv(records, options);
  await writeTextFile(filePath, content);
}

export function csvToJson(records: Record<string, string>[]): Record<string, string>[] {
  return records;
}

export function jsonToCsv(records: Record<string, unknown>[]): string {
  return generateCsv(records);
}