import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

export function base64Encode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64');
}

export function base64Decode(input: string): string {
  return Buffer.from(input, 'base64').toString('utf8');
}

export function urlEncode(input: string): string {
  return encodeURIComponent(input);
}

export function urlDecode(input: string): string {
  return decodeURIComponent(input);
}

export function hexEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('hex');
}

export function hexDecode(input: string): string {
  return Buffer.from(input, 'hex').toString('utf8');
}

export function generateSecretKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface EncryptedPayload {
  algorithm: string;
  iv: string;
  tag: string;
  data: string;
}

export function encryptAes256Gcm(plainText: string, keyHex: string): EncryptedPayload {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return {
    algorithm: ALGORITHM,
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: encrypted.toString('hex')
  };
}

export function decryptAes256Gcm(payload: EncryptedPayload, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.data, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

export function encryptJson(value: unknown, keyHex: string): EncryptedPayload {
  return encryptAes256Gcm(JSON.stringify(value), keyHex);
}

export function decryptJson<T>(payload: EncryptedPayload, keyHex: string): T {
  return JSON.parse(decryptAes256Gcm(payload, keyHex)) as T;
}