  /**
   * Cryptographic utilities for Vaultr
   * 
   * SECURITY ARCHITECTURE:
   * - Master Password (user input) → KDF → KEK (Key Encryption Key)
   * - KEK → Encrypts Vault Key using AES-GCM
   * - Vault Key → Encrypts password items using AES-GCM
   * 
   * KDF VERSIONING & IMPLEMENTATION:
   * - v1: PBKDF2-SHA256 (legacy-only; kept for backward compatibility)
   *   * 100,000 iterations (OWASP recommended)
   *   * Not GPU-resistant and no longer used for new vaults
   * - v2: scrypt (current default for new accounts)
   *   * scrypt-browser-v1 parameters
   *   * Memory-hard (~64 MiB) but browser-safe
   * - Argon2id may be added in the future if browser WASM support stabilizes
   * 
   * BACKWARD COMPATIBILITY:
   * - Unlock flow auto-detects KDF version from kdfParams.version
   * - Legacy vaults use v1 (PBKDF2)
   * - New vaults use v2 (scrypt)
   * - Argon2id may be considered later if stable
   */

  // ============================================================================
  // KDF VERSION CONSTANTS
  // ============================================================================
  import crypto from "crypto";
  const KDF_VERSION_PBKDF2 = 1;
  const KDF_VERSION_SCRYPT = 2;

  /**
   * scrypt parameters (current default, browser-safe).
   *
   * Parameters:
   * - N = 2^16 (65536)
   * - r = 8
   * - p = 1
   * - dkLen = 32 bytes (256 bits)
   *
   * Memory usage:
   * - Approximately N * r * 128 bytes ≈ 64 MiB
   * - Chosen to be memory-hard while remaining safe for modern browsers
   */
  const SCRYPT_PARAMS = {
    N: 2 ** 16,
    r: 8,
    p: 1,
    dkLen: 32,
    identifier: "scrypt-browser-v1",
  };

  // ============================================================================
  // SCRYPT WASM LOADER (browser-only)
  // ============================================================================

  let scryptWasmExports: WebAssembly.Exports | null = null;
  let scryptWasmInitPromise: Promise<void> | null = null;

  const wasmTextEncoder = new TextEncoder();
  const wasmTextDecoder = new TextDecoder();

  let cacheUint8: Uint8Array | null = null;
  let cacheUint32: Uint32Array | null = null;
  let cachedGlobalArgumentPtr: number | null = null;

  function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function fromHex(hex: string): Uint8Array {
    const result = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      result[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return result;
  }

  async function initScryptWasm(): Promise<void> {
    if (scryptWasmExports) return;
    if (!scryptWasmInitPromise) {
      scryptWasmInitPromise = (async () => {
        const response = await fetch("/scrypt_wasm_bg.wasm");
        const buffer = await response.arrayBuffer();
        
        // Provide required imports for WASM module
        const imports = {
          "./scrypt_wasm": {
            __wbindgen_throw: (ptr: number, len: number) => {
              if (!scryptWasmExports) throw new Error("WASM not initialized");
              throw new Error(getStringFromWasm(ptr, len));
            },
          },
        };
        
        const { instance } = await WebAssembly.instantiate(buffer, imports);
        scryptWasmExports = instance.exports;
      })();
    }
    return scryptWasmInitPromise;
  }

  function getUint8Memory(): Uint8Array {
    if (!scryptWasmExports) throw new Error("scrypt wasm not initialized");
    if (cacheUint8 === null || cacheUint8.buffer !== (scryptWasmExports.memory as WebAssembly.Memory).buffer) {
      cacheUint8 = new Uint8Array((scryptWasmExports.memory as WebAssembly.Memory).buffer);
    }
    return cacheUint8;
  }

  function getUint32Memory(): Uint32Array {
    if (!scryptWasmExports) throw new Error("scrypt wasm not initialized");
    if (cacheUint32 === null || cacheUint32.buffer !== (scryptWasmExports.memory as WebAssembly.Memory).buffer) {
      cacheUint32 = new Uint32Array((scryptWasmExports.memory as WebAssembly.Memory).buffer);
    }
    return cacheUint32;
  }

  function globalArgumentPtr(): number {
    if (!scryptWasmExports) throw new Error("scrypt wasm not initialized");
    if (cachedGlobalArgumentPtr === null) {
      cachedGlobalArgumentPtr = (scryptWasmExports.__wbindgen_global_argument_ptr as CallableFunction)();
    }
    return cachedGlobalArgumentPtr as number;
  }

  function passStringToWasm(str: string): [number, number] {
    if (!scryptWasmExports) throw new Error("scrypt wasm not initialized");
    const buf = wasmTextEncoder.encode(str);
    const ptr = (scryptWasmExports.__wbindgen_malloc as CallableFunction)(buf.length);
    getUint8Memory().set(buf, ptr);
    return [ptr, buf.length];
  }

  function getStringFromWasm(ptr: number, len: number): string {
    return wasmTextDecoder.decode(getUint8Memory().subarray(ptr, ptr + len));
  }

  async function scryptWasm(passwordHex: string, saltHex: string, params: typeof SCRYPT_PARAMS): Promise<Uint8Array> {
    await initScryptWasm();
    if (!scryptWasmExports) throw new Error("scrypt wasm not initialized");

    const [ptr0, len0] = passStringToWasm(passwordHex);
    const [ptr1, len1] = passStringToWasm(saltHex);
    const retptr = globalArgumentPtr();

    try {
      (scryptWasmExports.scrypt as CallableFunction)(
        retptr,
        ptr0,
        len0,
        ptr1,
        len1,
        params.N,
        params.r,
        params.p,
        params.dkLen
      );

      const mem = getUint32Memory();
      const rustPtr = mem[retptr / 4];
      const rustLen = mem[retptr / 4 + 1];
      const result = getStringFromWasm(rustPtr, rustLen).slice();
      (scryptWasmExports.__wbindgen_free as CallableFunction)(rustPtr, rustLen);
      return fromHex(result);
    } finally {
      (scryptWasmExports.__wbindgen_free as CallableFunction)(ptr0, len0);
      (scryptWasmExports.__wbindgen_free as CallableFunction)(ptr1, len1);
    }
  }

  /**
   * PBKDF2 parameters (legacy, for backward compatibility).
   * 
   * RATIONALE:
   * - iterations (100000): OWASP recommended minimum as of 2021
   * - hash ('SHA-256'): Industry standard
   * 
   * NOTE: PBKDF2 is NOT GPU-resistant. New accounts use scrypt.
   */
  const PBKDF2_PARAMS = {
    iterations: 100000,
    hash: 'SHA-256',
  };

  // ============================================================================
  // VAULT KEY GENERATION
  // ============================================================================

  export async function generateVaultKey(): Promise<CryptoKey> {
    return window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // ============================================================================
  // KEY DERIVATION: CURRENT DEFAULT (scrypt)
  // ============================================================================

  /**
   * Derive KEK using scrypt (memory-hard, browser-safe parameters).
   *
   * SECURITY:
   * - N = 2^16, r = 8, p = 1 → ~64 MiB memory
   * - dkLen = 32 bytes (AES-256 key length)
   * - Salt: 16 bytes random, stored with vault metadata
   */
  export async function deriveKeyFromPasswordScrypt(
    password: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    if (salt.length !== 16) {
      throw new Error('Salt must be exactly 16 bytes');
    }

    const enc = new TextEncoder();
    const passwordBytes = enc.encode(password);

    try {
      const derived = await scryptWasm(
        toHex(passwordBytes),
        toHex(salt),
        SCRYPT_PARAMS
      );

      const derivedKeyBytes = new Uint8Array(derived);

      const key = await window.crypto.subtle.importKey(
        "raw",
        derivedKeyBytes,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
      );

      // Clear sensitive buffers
      derivedKeyBytes.fill(0);
      derived.fill(0);
      passwordBytes.fill(0);

      return key;
    } catch (error) {
      passwordBytes.fill(0);
      throw error;
    }
  }

  // ============================================================================
  // KEY DERIVATION: LEGACY (PBKDF2-SHA256)
  // ============================================================================

  /**
   * Derive KEK using PBKDF2-SHA256 (legacy, for backward compatibility).
   * 
   * DEPRECATION NOTE:
   * - PBKDF2 is NOT GPU-resistant; new accounts use scrypt
   * - Existing PBKDF2-encrypted vaults continue to work
   * - Consider implementing automatic re-encryption to stronger KDFs in future
   * 
   * @param password - Master password
   * @param salt - 16-byte salt
   * @returns CryptoKey for AES-GCM operations
   */
  export async function deriveKeyFromPasswordPBKDF2(
    password: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const saltView = new Uint8Array(salt.buffer as ArrayBuffer);
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltView,
        iterations: PBKDF2_PARAMS.iterations,
        hash: PBKDF2_PARAMS.hash,
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true, // extractable
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    );
  }

  // ============================================================================
  // KEY DERIVATION: AUTO-DETECT (for unlock flow)
  // ============================================================================

  /**
   * Derive KEK using the appropriate algorithm based on stored kdfParams.
   * 
   * COMPATIBILITY:
   * - Reads kdfParams.version to determine which KDF to use
   * - Defaults to PBKDF2 (v1) if version not specified (legacy)
   * - Uses scrypt (v2) for current vaults
   * - Throws on unknown version (no silent downgrade)
   * 
   * @param password - Master password
   * @param salt - Base64-encoded salt
   * @param kdfParams - Stored KDF parameters from database
   * @returns CryptoKey for AES-GCM operations
   */
  type PBKDF2Params = {
    version: 1
    algorithm: 'PBKDF2'
    iterations: number
    hash: string
  }

  type ScryptParams = {
    version: 2
    algorithm: string
    N: number
    r: number
    p: number
    dkLen: number
  }

  type KdfParams = PBKDF2Params | ScryptParams

  export async function deriveKeyFromPasswordAuto(
    password: string,
    salt: string,
    kdfParams: KdfParams
  ): Promise<CryptoKey> {
    const saltBuffer = base64ToArrayBuffer(salt);
    const saltArray = new Uint8Array(saltBuffer);

    const version = kdfParams?.version ?? KDF_VERSION_PBKDF2;

    if (version === KDF_VERSION_SCRYPT) {
      return deriveKeyFromPasswordScrypt(password, saltArray);
    }

    if (version === KDF_VERSION_PBKDF2) {
      return deriveKeyFromPasswordPBKDF2(password, saltArray);
    }

    throw new Error(`Unknown KDF version: ${version}`);
  }

  /**
   * DEPRECATED: Use deriveKeyFromPasswordAuto for new code.
   * This function is kept for backward compatibility.
   * 
   * Previously derived keys using PBKDF2. Now calls deriveKeyFromPasswordPBKDF2.
   */
  export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    return deriveKeyFromPasswordPBKDF2(password, salt);
  }

  // ============================================================================
  // VAULT KEY ENCRYPTION
  // ============================================================================

  export async function encryptVaultKey(vaultKey: CryptoKey, kek: CryptoKey): Promise<string> {
    const exportedKey = await window.crypto.subtle.exportKey("raw", vaultKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      kek,
      exportedKey
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return arrayBufferToBase64(combined.buffer);
  }

  /**
   * Decrypt Vault Key using KEK.
   * 
   * INVERSE of encryptVaultKey:
   * - Extract IV (first 12 bytes) + ciphertext (rest)
   * - Decrypt with AES-GCM
   * - Import result as CryptoKey
   * 
   * @param encryptedVaultKey - Base64-encoded (IV + ciphertext)
   * @param kek - Key Encryption Key
   * @returns CryptoKey ready for item encryption/decryption
   */
  export async function decryptVaultKey(encryptedVaultKey: string, kek: CryptoKey): Promise<CryptoKey> {
    const buffer = base64ToArrayBuffer(encryptedVaultKey);
    const iv = new Uint8Array(buffer.slice(0, 12));
    const ciphertext = new Uint8Array(buffer.slice(12));

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      kek,
      ciphertext
    );

    return window.crypto.subtle.importKey(
      "raw",
      decryptedBuffer,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // ============================================================================
  // KDF PARAMETERS VERSIONING
  // ============================================================================

  /**
   * Generate kdfParams for PBKDF2 (legacy-only).
   *
   * @returns kdfParams object suitable for storage in database
   */
  export function generateKdfParamsPBKDF2(): PBKDF2Params {
    return {
      version: KDF_VERSION_PBKDF2,
      algorithm: "PBKDF2",
      iterations: PBKDF2_PARAMS.iterations,
      hash: PBKDF2_PARAMS.hash,
    };
  }

  /**
   * Generate kdfParams for scrypt (current default for new vaults).
   *
   * @returns kdfParams object suitable for storage in database
   */
  export function generateKdfParamsScrypt(): ScryptParams {
    return {
      version: KDF_VERSION_SCRYPT,
      algorithm: SCRYPT_PARAMS.identifier,
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
      dkLen: SCRYPT_PARAMS.dkLen,
    };
  }

  // ============================================================================
  // UTILITY: BASE64 ENCODING/DECODING
  // ============================================================================

  export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    try {
      // Trim whitespace and validate base64
      const trimmed = String(base64).trim();
      if (!trimmed) {
        throw new Error('Empty Base64 string');
      }
      const binary_string =
        typeof window !== 'undefined'
          ? window.atob(trimmed)
          : Buffer.from(trimmed, 'base64').toString('binary');
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (err) {
      throw new Error(`Failed to decode Base64: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ============================================================================
  // UTILITY: ITEM ENCRYPTION/DECRYPTION
  // ============================================================================

  /**
   * Encrypt a password item (title, username, password, etc.) using Vault Key.
   * 
   * FLOW:
   * 1. Serialize item to JSON
   * 2. Encrypt with AES-GCM
   * 3. Return Base64-encoded (IV + ciphertext)
   * 
   * @param item - Object with item data
   * @param vaultKey - Decrypted vault key (CryptoKey)
   * @returns { encryptedData: string, iv: string }
   */
  export async function encryptItem<T extends Record<string, unknown>>(
    item: T,
    vaultKey: CryptoKey
  ): Promise<{ encryptedData: string; iv: string }> {
    const payload = JSON.stringify(item);
    const enc = new TextEncoder();
    const encodedPayload = enc.encode(payload);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      vaultKey,
      encodedPayload
    );

    return {
      encryptedData: arrayBufferToBase64(encryptedBuffer),
      iv: arrayBufferToBase64(iv.buffer),
    };
  }

  /**
   * Decrypt a password item using Vault Key.
   * 
   * INVERSE of encryptItem.
   * 
   * @param encryptedData - Base64-encoded ciphertext
   * @param iv - Base64-encoded IV
   * @param vaultKey - Decrypted vault key
   * @returns Parsed item object
   */
  export async function decryptItem<T extends Record<string, unknown>>(
    encryptedData: string,
    iv: string,
    vaultKey: CryptoKey
  ): Promise<T> {
    const ivArray = new Uint8Array(base64ToArrayBuffer(iv));
    const ciphertextBuffer = base64ToArrayBuffer(encryptedData);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivArray },
      vaultKey,
      ciphertextBuffer
    );

    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBuffer);

    return JSON.parse(jsonStr) as T;
  }

  // ============================================================================
  // EMAIL VERIFICATION TOKEN UTILITIES (Server-side only)
  // ============================================================================

  /**
   * Generate a cryptographically secure random token for email verification
   * Returns 32 bytes (256 bits) as hex string (64 characters)
   * 
   * SECURITY:
   * - Uses crypto.randomBytes for CSPRNG
   * - 256 bits of entropy prevents brute force
   * - One-time use, expires in 24 hours
   */
  export function generateVerificationToken(): string {
    // Server-side only check
    if (typeof window !== 'undefined') {
      throw new Error('generateVerificationToken must only be called server-side')
    }
    
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Hash a verification token using SHA-256
   * Store the hash in the database, never the plain token
   * 
   * @param token - Plain verification token
   * @returns SHA-256 hash as hex string
   */
  export function hashVerificationToken(token: string): string {
    // Server-side only check
    if (typeof window !== 'undefined') {
      throw new Error('hashVerificationToken must only be called server-side')
    }
    
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  /**
   * Verify a token against its hash using constant-time comparison
   * Prevents timing attacks
   * 
   * @param token - Plain token to verify
   * @param hash - Stored hash to compare against
   * @returns True if token matches hash
   */
  export function verifyTokenHash(token: string, hash: string): boolean {
    // Server-side only check
    if (typeof window !== 'undefined') {
      throw new Error('verifyTokenHash must only be called server-side')
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    
    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(tokenHash, 'hex'),
      Buffer.from(hash, 'hex')
    )
  }
