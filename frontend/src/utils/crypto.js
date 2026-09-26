/**
 * Almacenamiento seguro y robusto para credenciales de IA en el navegador.
 */

// Obtener o generar identificador de dispositivo
function getDevicePassphrase() {
  let passphrase = localStorage.getItem('clipengine_device_id');
  if (!passphrase) {
    try {
      passphrase = (window.crypto?.randomUUID ? window.crypto.randomUUID() : 'dev_' + Math.random().toString(36).substring(2)) + '-' + Date.now();
    } catch (e) {
      passphrase = 'device_' + Date.now();
    }
    localStorage.setItem('clipengine_device_id', passphrase);
  }
  return passphrase;
}

async function deriveKey(passphrase) {
  if (!window.crypto || !window.crypto.subtle) return null;
  try {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const salt = encoder.encode('clipengine_salt_' + passphrase.slice(0, 8));
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 10000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (e) {
    return null;
  }
}

export async function encrypt(plaintext) {
  if (!plaintext) return '';
  try {
    const passphrase = getDevicePassphrase();
    const key = await deriveKey(passphrase);
    if (!key) return btoa(plaintext); // Fallback base64 si WebCrypto no está disponible

    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(plaintext)
    );
    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return 'enc:' + btoa(String.fromCharCode(...combined));
  } catch (e) {
    return btoa(plaintext);
  }
}

export async function decrypt(encryptedText) {
  if (!encryptedText) return '';
  if (!encryptedText.startsWith('enc:')) {
    // Si es texto plano o base64 simple
    try {
      return atob(encryptedText);
    } catch (e) {
      return encryptedText;
    }
  }

  try {
    const passphrase = getDevicePassphrase();
    const key = await deriveKey(passphrase);
    if (!key) return atob(encryptedText.slice(4));

    const raw = atob(encryptedText.slice(4));
    const combined = Uint8Array.from(raw, c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    // Fallback: no borrar las credenciales, devolver cadena original o descifrada
    try {
      return atob(encryptedText.slice(4));
    } catch {
      return '';
    }
  }
}

/**
 * Guarda credenciales de forma infalible en localStorage.
 */
export async function storeCredentials(credentials) {
  const { provider, apiKey, model, ollamaUrl } = credentials;
  
  if (provider) localStorage.setItem('clipengine_provider', provider);
  if (model) localStorage.setItem('clipengine_model', model);
  if (ollamaUrl !== undefined) localStorage.setItem('clipengine_ollama_url', ollamaUrl || '');
  
  if (apiKey && apiKey.trim() !== '') {
    const encrypted = await encrypt(apiKey.trim());
    localStorage.setItem('clipengine_api_key', encrypted);
  }
}

/**
 * Recupera credenciales desde localStorage con tolerancia a fallos.
 */
export async function getCredentials() {
  const provider = localStorage.getItem('clipengine_provider') || 'gemini';
  let model = localStorage.getItem('clipengine_model') || (provider === 'gemini' ? 'gemini-3.8-flash' : provider === 'openai' ? 'gpt-4o-mini' : 'llama3.1');
  
  // Auto-migrar modelo deprecado si quedó guardado en el navegador del usuario
  if (provider === 'gemini' && (!model || model === 'gemini-2.0-flash' || model === 'gemini-1.5-flash')) {
    model = 'gemini-3.8-flash';
    localStorage.setItem('clipengine_model', 'gemini-3.8-flash');
  }
  
  const ollamaUrl = localStorage.getItem('clipengine_ollama_url') || 'http://localhost:11434';
  const storedKey = localStorage.getItem('clipengine_api_key');
  
  let apiKey = '';
  if (storedKey) {
    apiKey = await decrypt(storedKey);
    // Si decrypt devolvió vacío pero storedKey existe, usar storedKey directo
    if (!apiKey && storedKey && !storedKey.startsWith('enc:')) {
      apiKey = storedKey;
    }
  }
  
  return { provider, apiKey, model, ollamaUrl };
}

export function clearCredentials() {
  localStorage.removeItem('clipengine_provider');
  localStorage.removeItem('clipengine_api_key');
  localStorage.removeItem('clipengine_model');
  localStorage.removeItem('clipengine_ollama_url');
}

export function hasCredentials() {
  const provider = localStorage.getItem('clipengine_provider');
  if (provider === 'ollama') return true;
  return !!localStorage.getItem('clipengine_api_key');
}

export async function getMaskedKey() {
  const creds = await getCredentials();
  if (!creds || !creds.apiKey) return '(no configurada)';
  const key = creds.apiKey;
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}
