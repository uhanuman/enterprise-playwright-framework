import { loadEnv } from './env.js';

export interface SecretMap {
  [key: string]: string;
}

export function loadSecrets(): SecretMap {
  const env = loadEnv();
  const secrets: SecretMap = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (!key || !value) continue;
    if (/PASSWORD|SECRET|TOKEN|API_KEY|CREDENTIAL/i.test(key)) {
      secrets[key] = value;
    }
  }

  if (env.AI_API_KEY) secrets.AI_API_KEY = env.AI_API_KEY;

  return secrets;
}

export function getSecret(name: string): string | undefined {
  return process.env[name] ?? loadSecrets()[name];
}
