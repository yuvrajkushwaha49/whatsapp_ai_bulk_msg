import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Derive 32-byte encryption key safely from environment secret
 */
function getEncryptionKey() {
  const secret = process.env.META_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default_super_secure_encryption_key_32bytes!';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypt access token at rest using AES-256-GCM
 * @param {string} text - Plaintext token
 * @returns {string} - Encrypted string formatted as iv:authTag:encryptedHex
 */
export function encryptToken(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt access token
 * @param {string} cipherText - Encrypted string formatted as iv:authTag:encryptedHex
 * @returns {string} - Plaintext token
 */
export function decryptToken(cipherText) {
  if (!cipherText) return null;
  
  // If not encrypted (e.g. legacy plain text token), return as-is
  if (!cipherText.includes(':')) {
    return cipherText;
  }

  try {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) return cipherText;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // Fallback: If decryption fails, return as-is or null
    return cipherText;
  }
}

export default {
  encryptToken,
  decryptToken
};
