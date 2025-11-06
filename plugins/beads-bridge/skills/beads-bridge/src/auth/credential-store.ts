// src/auth/credential-store.ts
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { dirname } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';
import type { BackendType } from '../types/config.js';

export interface GitHubCredentials {
  token: string;
  scopes: string[];
  expiresAt?: Date;
}

export interface ShortcutCredentials {
  token: string;
}

export interface Credentials {
  github?: GitHubCredentials;
  shortcut?: ShortcutCredentials;
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
}

export class CredentialStore {
  private readonly filePath: string;
  private readonly algorithm = 'aes-256-gcm';

  constructor(filePath?: string) {
    this.filePath = filePath || process.env.CREDENTIAL_STORE_PATH || join(homedir(), '.config', 'beads-bridge', 'credentials.json');
  }

  /**
   * Derive encryption key from machine-specific data
   */
  private deriveKey(salt: Buffer): Buffer {
    // Use machine-specific data as password (hostname + homedir)
    const password = `${homedir()}:beads-bridge`;
    return scryptSync(password, salt, 32);
  }

  /**
   * Encrypt credentials
   */
  private encrypt(data: string): EncryptedData {
    const salt = randomBytes(32);
    const key = this.deriveKey(salt);
    const iv = randomBytes(16);

    const cipher = createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  /**
   * Decrypt credentials
   */
  private decrypt(encryptedData: EncryptedData): string {
    const salt = Buffer.from(encryptedData.salt, 'base64');
    const key = this.deriveKey(salt);
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');

    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Save credentials to disk (encrypted)
   */
  async save(credentials: Credentials): Promise<void> {
    const json = JSON.stringify(credentials);
    const encrypted = this.encrypt(json);

    // Ensure directory exists
    await mkdir(dirname(this.filePath), { recursive: true });

    // Write encrypted data
    await writeFile(this.filePath, JSON.stringify(encrypted, null, 2), 'utf-8');
  }

  /**
   * Load credentials from disk (decrypt)
   */
  async load(): Promise<Credentials> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      const encrypted: EncryptedData = JSON.parse(content);
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet
        return {};
      }
      throw error;
    }
  }

  /**
   * Clear all credentials
   */
  async clear(): Promise<void> {
    try {
      await unlink(this.filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if credentials exist
   */
  async exists(): Promise<boolean> {
    try {
      await readFile(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if credentials exist for a specific backend
   */
  async hasCredentials(backendType: BackendType): Promise<boolean> {
    try {
      const creds = await this.load();
      return backendType === 'github' ? !!creds.github : !!creds.shortcut;
    } catch {
      return false;
    }
  }
}
