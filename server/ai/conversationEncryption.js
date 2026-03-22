import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const key = process.env.CONVERSATION_ENCRYPTION_KEY;
  if (!key) throw new Error('CONVERSATION_ENCRYPTION_KEY env var is required');
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) throw new Error('CONVERSATION_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return buf;
}

export function encryptMessages(messages) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(messages);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decryptMessages(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return [];

  if (!ciphertext.includes(':')) {
    try {
      return typeof ciphertext === 'string' ? JSON.parse(ciphertext) : ciphertext;
    } catch {
      return [];
    }
  }

  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return [];

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}
