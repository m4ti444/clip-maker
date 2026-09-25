/**
 * Client-side AES-GCM encryption for localStorage credentials.
 * Uses the Web Crypto API (built into all modern browsers, no dependencies needed).
 */

// Derive a CryptoKey from a passphrase using PBKDF2
async function deriveKey(passphrase) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  // Use a fixed salt derived from the passphrase itself (client-side, this is acceptable)
  const salt = encoder.encode('clipengine-salt-v1-' + passphrase.slice(0, 8));
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Get or generate a device-specific passphrase
function getDevicePassphrase() {
  let passphrase = localStorage.getItem('clipengine_device_id');
  if (!passphrase) {
    // Generate a random device ID on first use
    passphrase = crypto.randomUUID() + '-' + Date.now();
    localStorage.setItem('clipengine_device_id', passphrase);
  }
  return passphrase;
}

/**
 * Encrypt a plaintext string using AES-GCM.
 * Returns a base64 string containing IV + ciphertext.
 */
export async function encrypt(plaintext) {
  const passphrase = getDevicePassphrase();
  const key = await deriveKey(passphrase);
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );
  // Combine IV + ciphertext into a single array
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64 encoded string (IV + ciphertext).
 * Returns the plaintext string.
 */
export async function decrypt(encryptedBase64) {
  try {
    const passphrase = getDevicePassphrase();
    const key = await deriveKey(passphrase);
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('Decryption failed:', e);
    return null;
  }
}

/**
 * Store credentials securely (encrypted in localStorage).
 */
export async function storeCredentials(credentials) {
  const { provider, apiKey, model, ollamaUrl } = credentials;
  // Provider and model don't need encryption (not sensitive)
  localStorage.setItem('clipengine_provider', provider);
  localStorage.setItem('clipengine_model', model || '');
  localStorage.setItem('clipengine_ollama_url', ollamaUrl || '');
  // API key IS sensitive - encrypt it
  if (apiKey) {
    const encrypted = await encrypt(apiKey);
    localStorage.setItem('clipengine_api_key', encrypted);
    localStorage.setItem('clipengine_api_key_encrypted', 'true');
  }
}

/**
 * Retrieve decrypted credentials from localStorage.
 */
export async function getCredentials() {
  const provider = localStorage.getItem('clipengine_provider');
  const model = localStorage.getItem('clipengine_model');
  const ollamaUrl = localStorage.getItem('clipengine_ollama_url');
  const encryptedKey = localStorage.getItem('clipengine_api_key');
  const isEncrypted = localStorage.getItem('clipengine_api_key_encrypted') === 'true';
  
  let apiKey = '';
  if (encryptedKey) {
    if (isEncrypted) {
      apiKey = await decrypt(encryptedKey);
      // If decryption fails, key is corrupted - clear it
      if (apiKey === null) {
        clearCredentials();
        return null;
      }
    } else {
      // Legacy unencrypted key - encrypt it now
      apiKey = encryptedKey;
      const encrypted = await encrypt(apiKey);
      localStorage.setItem('clipengine_api_key', encrypted);
      localStorage.setItem('clipengine_api_key_encrypted', 'true');
    }
  }
  
  return { provider, apiKey, model, ollamaUrl };
}

/**
 * Clear all stored credentials.
 */
export function clearCredentials() {
  localStorage.removeItem('clipengine_provider');
  localStorage.removeItem('clipengine_api_key');
  localStorage.removeItem('clipengine_api_key_encrypted');
  localStorage.removeItem('clipengine_model');
  localStorage.removeItem('clipengine_ollama_url');
}

/**
 * Check if credentials exist.
 */
export function hasCredentials() {
  const provider = localStorage.getItem('clipengine_provider');
  if (provider === 'ollama') return true;
  return !!localStorage.getItem('clipengine_api_key');
}

/**
 * Get masked API key for display purposes.
 */
export async function getMaskedKey() {
  const creds = await getCredentials();
  if (!creds || !creds.apiKey) return '(no configurada)';
  const key = creds.apiKey;
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}
