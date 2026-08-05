'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const VERSION = 1;
const KEY_BYTES = 32;
const IV_BYTES = 12;

function loadVaultKey() {
  const encoded = process.env.INFINITY_VAULT_KEY;
  if (!encoded) {
    throw new Error('INFINITY_VAULT_KEY is required for private vault operations.');
  }

  let key;
  try {
    key = Buffer.from(encoded, 'base64');
  } catch {
    throw new Error('INFINITY_VAULT_KEY must be valid base64.');
  }

  if (key.length !== KEY_BYTES) {
    throw new Error(`INFINITY_VAULT_KEY must decode to exactly ${KEY_BYTES} bytes.`);
  }

  return key;
}

function encryptRecord(record, context = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('record must be a non-null object.');
  }

  const key = loadVaultKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const aad = Buffer.from(JSON.stringify({
    version: VERSION,
    knowledgeId: context.knowledgeId || null,
    ownerId: context.ownerId || null,
    knowledgeClass: context.knowledgeClass || 'user_private',
  }), 'utf8');

  cipher.setAAD(aad);
  const plaintext = Buffer.from(JSON.stringify(record), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: VERSION,
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    aad: aad.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    encryptedAt: new Date().toISOString(),
  };
}

function decryptRecord(envelope, expectedContext = {}) {
  if (!envelope || typeof envelope !== 'object') {
    throw new TypeError('encrypted envelope is required.');
  }
  if (envelope.version !== VERSION || envelope.algorithm !== ALGORITHM) {
    throw new Error('Unsupported vault encryption format.');
  }

  const key = loadVaultKey();
  const iv = Buffer.from(envelope.iv, 'base64');
  const authTag = Buffer.from(envelope.authTag, 'base64');
  const aad = Buffer.from(envelope.aad, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  const storedContext = JSON.parse(aad.toString('utf8'));
  for (const field of ['knowledgeId', 'ownerId', 'knowledgeClass']) {
    if (expectedContext[field] !== undefined && expectedContext[field] !== storedContext[field]) {
      throw new Error(`Encrypted record context mismatch: ${field}.`);
    }
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString('utf8'));
}

function generateVaultKey() {
  return crypto.randomBytes(KEY_BYTES).toString('base64');
}

module.exports = {
  decryptRecord,
  encryptRecord,
  generateVaultKey,
};
