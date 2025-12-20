/**
 * Secret Management Utilities
 * ============================
 * 
 * CRITICAL SECURITY ARCHITECTURE:
 * -------------------------------
 * This module enforces strict encryption boundaries to prevent secret leakage.
 * A database leak of Item.metadata alone MUST reveal ZERO usable secret information.
 * 
 * ENCRYPTION BOUNDARY RULES:
 * 
 * 1. encryptedData (Encrypted, Sensitive):
 *    - Contains ALL sensitive values: passwords, API keys, env var values, notes
 *    - Always encrypted with vault key before storage
 *    - Never logged, indexed, or transmitted unencrypted
 *    - Structure: JSON blob with complete secret information
 * 
 * 2. metadata (Unencrypted, Public):
 *    - Contains ONLY non-sensitive UI information
 *    - Can be safely logged, indexed, and exposed in listings
 *    - MUST NOT contain:
 *      ✗ Real secret values (passwords, API keys, tokens)
 *      ✗ Partial secrets or fragments (e.g., "***word" reveals last 4 chars)
 *      ✗ Masks with real characters
 *      ✗ Environment variable values
 *    - MAY contain:
 *      ✓ Titles / labels
 *      ✓ Usernames (if not sensitive)
 *      ✓ Service names
 *      ✓ Environment names (e.g., "production")
 *      ✓ Counts (e.g., number of env vars)
 *      ✓ Boolean flags (e.g., hasNotes)
 *      ✓ Non-reversible derived info (e.g., secret length)
 *      ✓ ENV_VARS: Variable KEYS only (never values)
 * 
 * FORBIDDEN PATTERNS:
 * - maskSecret('myPassword') → "***word"   EXPOSES REAL CHARACTERS
 * - metadata.apiKeyMask = "***local"   EXPOSES REAL CHARACTERS
 * - metadata.envVars = [{key: "API_KEY", value: "secret"}]   EXPOSES VALUES
 * 
 * SAFE PATTERNS:
 * - metadata.passwordLength = 12 ✓ Non-reversible
 * - metadata.variableKeys = ["API_KEY", "DB_URL"] ✓ Keys only, no values
 * - metadata.hasNotes = true ✓ Boolean flag
 * - Generic mask: "********" ✓ Reveals nothing
 * 
 * VALIDATION:
 * - All metadata creation uses centralized builders (buildMetadata)
 * - Runtime validation rejects forbidden fields (validateMetadataSafety)
 * - Zod schemas enforce structure (schemas/secrets.ts)
 * - API routes validate before storage
 * 
 * SEARCH AND FILTERING:
 * - Operates ONLY on metadata fields
 * - Never decrypts or searches within encryptedData
 * - Client-side filtering requires decryption (post-fetch)
 */

export enum SecretType {
  PASSWORD = 'PASSWORD',
  API_KEY = 'API_KEY',
  ENV_VARS = 'ENV_VARS',
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PasswordInput {
  title: string;
  username?: string;
  password: string;
  website?: string;
  notes?: string;
}

export interface ApiKeyInput {
  title: string;
  serviceName: string;
  apiKey: string;
  environment?: string; // e.g., 'production', 'staging'
  notes?: string;
}

export interface EnvVarsInput {
  title: string;
  description?: string;
  variables: Array<{
    key: string;
    value: string;
  }>;
  notes?: string;
}

export type SecretInput = PasswordInput | ApiKeyInput | EnvVarsInput;

// Encrypted payload types
export interface PasswordEncryptedPayload {
  type: SecretType.PASSWORD;
  title: string;
  username: string;
  password: string;
  website: string;
  notes: string;
}

export interface ApiKeyEncryptedPayload {
  type: SecretType.API_KEY;
  title: string;
  serviceName: string;
  apiKey: string;
  environment: string;
  notes: string;
}

export interface EnvVarsEncryptedPayload {
  type: SecretType.ENV_VARS;
  title: string;
  description: string;
  variables: Array<{ key: string; value: string }>;
  notes: string;
}

export type EncryptedPayload = PasswordEncryptedPayload | ApiKeyEncryptedPayload | EnvVarsEncryptedPayload;

// Metadata types
// SECURITY: Metadata must contain ONLY non-sensitive information
export interface PasswordMetadata {
  type: SecretType.PASSWORD;
  title: string;
  username: string;
  passwordLength: number; // Non-reversible: only length, no real characters
  website: string;
  hasNotes: boolean;
}

export interface ApiKeyMetadata {
  type: SecretType.API_KEY;
  title: string;
  serviceName: string;
  apiKeyLength: number; // Non-reversible: only length, no real characters
  environment: string;
  hasNotes: boolean;
}

export interface EnvVarsMetadata {
  type: SecretType.ENV_VARS;
  title: string;
  description: string;
  variableCount: number;
  variableKeys: string[];
  hasNotes: boolean;
}

export type Metadata = PasswordMetadata | ApiKeyMetadata | EnvVarsMetadata;

// ============================================================================
// ENCRYPTED PAYLOAD BUILDERS (ALL SENSITIVE DATA)
// ============================================================================

/**
 * Build encrypted payload for a PASSWORD secret
 * Contains ALL sensitive information that will be encrypted
 */
export function buildPasswordEncryptedPayload(input: PasswordInput): PasswordEncryptedPayload {
  return {
    type: SecretType.PASSWORD,
    title: input.title,
    username: input.username || '',
    password: input.password,
    website: input.website || '',
    notes: input.notes || '',
  };
}

/**
 * Build encrypted payload for an API_KEY secret
 * Contains ALL sensitive information that will be encrypted
 */
export function buildApiKeyEncryptedPayload(input: ApiKeyInput): ApiKeyEncryptedPayload {
  return {
    type: SecretType.API_KEY,
    title: input.title,
    serviceName: input.serviceName,
    apiKey: input.apiKey,
    environment: input.environment || 'production',
    notes: input.notes || '',
  };
}

/**
 * Build encrypted payload for ENV_VARS secret
 * Contains ALL sensitive information that will be encrypted
 */
export function buildEnvVarsEncryptedPayload(input: EnvVarsInput): EnvVarsEncryptedPayload {
  return {
    type: SecretType.ENV_VARS,
    title: input.title,
    description: input.description || '',
    variables: input.variables,
    notes: input.notes || '',
  };
}

/**
 * Main entry point: Build encrypted payload based on secret type
 * 
 * @param type - The type of secret
 * @param input - The secret input data
 * @returns Object containing ALL sensitive data (will be encrypted)
 */
export function buildEncryptedPayload(
  type: SecretType,
  input: SecretInput
): EncryptedPayload {
  switch (type) {
    case SecretType.PASSWORD:
      return buildPasswordEncryptedPayload(input as PasswordInput);
    case SecretType.API_KEY:
      return buildApiKeyEncryptedPayload(input as ApiKeyInput);
    case SecretType.ENV_VARS:
      return buildEnvVarsEncryptedPayload(input as EnvVarsInput);
    default:
      throw new Error(`Unknown secret type: ${type}`);
  }
}

// ============================================================================
// METADATA BUILDERS (ONLY NON-SENSITIVE DATA)
// ============================================================================

/**
 * Create a generic mask for a secret value
 * SECURITY CRITICAL: NEVER include any real characters from the secret
 * 
 * @param value - The secret value to mask
 * @returns A generic mask string that reveals NO secret information
 */
export function createGenericMask(value: string): string {
  if (!value || value.length === 0) return '';
  // Return a fixed generic mask - reveals NOTHING about the actual secret
  return '********';
}

/**
 * Get the length of a secret value (non-reversible metadata)
 * 
 * @param value - The secret value
 * @returns The length of the secret (safe to store in metadata)
 */
export function getSecretLength(value: string): number {
  return value ? value.length : 0;
}

/**
 * Build metadata for a PASSWORD secret
 * SECURITY CRITICAL: Contains ONLY non-sensitive, non-reversible information
 * NO real secret characters or fragments allowed
 */
export function buildPasswordMetadata(input: PasswordInput): PasswordMetadata {
  return {
    type: SecretType.PASSWORD,
    title: input.title,
    username: input.username || '',
    passwordLength: getSecretLength(input.password), // Safe: only length, no real chars
    website: input.website || '',
    hasNotes: Boolean(input.notes && input.notes.length > 0),
  };
}

/**
 * Build metadata for an API_KEY secret
 * SECURITY CRITICAL: Contains ONLY non-sensitive, non-reversible information
 * NO real secret characters or fragments allowed
 */
export function buildApiKeyMetadata(input: ApiKeyInput): ApiKeyMetadata {
  return {
    type: SecretType.API_KEY,
    title: input.title,
    serviceName: input.serviceName,
    apiKeyLength: getSecretLength(input.apiKey), // Safe: only length, no real chars
    environment: input.environment || 'production',
    hasNotes: Boolean(input.notes && input.notes.length > 0),
  };
}

/**
 * Build metadata for ENV_VARS secret
 * SECURITY CRITICAL: Contains ONLY non-sensitive information
 * Variable KEYS only (never values), counts, and descriptors
 */
export function buildEnvVarsMetadata(input: EnvVarsInput): EnvVarsMetadata {
  return {
    type: SecretType.ENV_VARS,
    title: input.title,
    description: input.description || '',
    variableCount: input.variables.length,
    variableKeys: input.variables.map(v => v.key), // Safe: Keys only, NEVER values
    hasNotes: Boolean(input.notes && input.notes.length > 0),
  };
}

/**
 * Main entry point: Build metadata based on secret type
 * 
 * @param type - The type of secret
 * @param input - The secret input data
 * @returns Object containing ONLY non-sensitive metadata
 */
export function buildMetadata(
  type: SecretType,
  input: SecretInput
): Metadata {
  switch (type) {
    case SecretType.PASSWORD:
      return buildPasswordMetadata(input as PasswordInput);
    case SecretType.API_KEY:
      return buildApiKeyMetadata(input as ApiKeyInput);
    case SecretType.ENV_VARS:
      return buildEnvVarsMetadata(input as EnvVarsInput);
    default:
      throw new Error(`Unknown secret type: ${type}`);
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that metadata does NOT contain any sensitive data
 * SECURITY CRITICAL: Runtime safety check to prevent secret leakage
 * 
 * @param metadata - Metadata object to validate
 * @throws Error if metadata contains forbidden fields or secret fragments
 */
export function validateMetadataSafety(metadata: Record<string, unknown>): void {
  // FORBIDDEN: Exact field names that could contain real secret data
  const forbiddenKeys = new Set([
    'password',
    'apikey',
    'api_key',
    'value',
    'secret',
    'token',
    'credential',
    'mask',
    'apikeyMask',
    'apiKeyMask',
    'passwordMask',
  ]);
  
  // ALLOWED: Safe fields that are explicitly permitted
  const allowedKeys = new Set([
    'type',
    'title',
    'username',
    'website',
    'serviceName',
    'environment',
    'description',
    'variableCount',
    'variableKeys',
    'hasNotes',
    'passwordLength',
    'apiKeyLength',
  ]);
  
  const checkObject = (obj: Record<string, unknown>, path = ''): void => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      const lowerKey = key.toLowerCase();
      
      // Check if key is explicitly forbidden (exact match)
      if (forbiddenKeys.has(lowerKey)) {
        throw new Error(
          `SECURITY VIOLATION: Metadata field "${fullPath}" is forbidden. ` +
          `Real secrets or fragments must ONLY exist in encryptedData, never in metadata.`
        );
      }
      
      // Warn about unexpected keys (not in allowed list and not forbidden)
      if (!allowedKeys.has(key) && !forbiddenKeys.has(lowerKey)) {
        console.warn(`Warning: Metadata field "${fullPath}" is not recognized. ` +
          `Ensure this is not sensitive data.`);
      }
      
      // Validate string values don't look like secrets
      if (typeof value === 'string' && value.length > 0) {
        // Check for patterns that look like partial secrets (e.g., "***word")
        if (/^\*+[^*]+$/.test(value)) {
          throw new Error(
            `SECURITY VIOLATION: Metadata field "${fullPath}" contains what appears to be ` +
            `a partial secret mask ("${value}"). This reveals real secret characters and is forbidden.`
          );
        }
      }
      
      // Recursively check nested objects and arrays
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, idx) => {
            if (typeof item === 'object' && item !== null) {
              checkObject(item as Record<string, unknown>, `${fullPath}[${idx}]`);
            }
          });
        } else {
          checkObject(value as Record<string, unknown>, fullPath);
        }
      }
    }
  };
  
  checkObject(metadata);
}

/**
 * Validate password input
 */
export function validatePasswordInput(input: PasswordInput): void {
  if (!input.title || input.title.trim().length === 0) {
    throw new Error('Title is required');
  }
  if (!input.password || input.password.length === 0) {
    throw new Error('Password is required');
  }
}

/**
 * Validate API key input
 */
export function validateApiKeyInput(input: ApiKeyInput): void {
  if (!input.title || input.title.trim().length === 0) {
    throw new Error('Title is required');
  }
  if (!input.serviceName || input.serviceName.trim().length === 0) {
    throw new Error('Service name is required');
  }
  if (!input.apiKey || input.apiKey.length === 0) {
    throw new Error('API key is required');
  }
}

/**
 * Validate environment variables input
 */
export function validateEnvVarsInput(input: EnvVarsInput): void {
  if (!input.title || input.title.trim().length === 0) {
    throw new Error('Title is required');
  }
  if (!input.variables || input.variables.length === 0) {
    throw new Error('At least one environment variable is required');
  }
  
  // Validate each variable
  for (const variable of input.variables) {
    if (!variable.key || variable.key.trim().length === 0) {
      throw new Error('Variable key cannot be empty');
    }
    if (variable.value === undefined || variable.value === null) {
      throw new Error(`Variable "${variable.key}" must have a value`);
    }
  }
  
  // Check for duplicate keys
  const keys = input.variables.map(v => v.key);
  const uniqueKeys = new Set(keys);
  if (keys.length !== uniqueKeys.size) {
    throw new Error('Duplicate environment variable keys are not allowed');
  }
}

/**
 * Validate secret input based on type
 */
export function validateSecretInput(type: SecretType, input: SecretInput): void {
  switch (type) {
    case SecretType.PASSWORD:
      validatePasswordInput(input as PasswordInput);
      break;
    case SecretType.API_KEY:
      validateApiKeyInput(input as ApiKeyInput);
      break;
    case SecretType.ENV_VARS:
      validateEnvVarsInput(input as EnvVarsInput);
      break;
    default:
      throw new Error(`Unknown secret type: ${type}`);
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY HELPERS
// ============================================================================

/**
 * Detect secret type from decrypted data
 * Used for backward compatibility with existing password items
 */
export function detectSecretType(decryptedData: Record<string, unknown>): SecretType {
  // Check if type is explicitly set
  if (decryptedData.type) {
    return decryptedData.type as SecretType;
  }
  
  // Detect based on structure (backward compatibility)
  if (decryptedData.variables && Array.isArray(decryptedData.variables)) {
    return SecretType.ENV_VARS;
  }
  if (decryptedData.apiKey || decryptedData.serviceName) {
    return SecretType.API_KEY;
  }
  
  // Default to PASSWORD (backward compatibility with existing items)
  return SecretType.PASSWORD;
}

/**
 * Build metadata from decrypted data (backward compatibility)
 * Used when metadata field is missing from existing items
 */
export function buildMetadataFromDecrypted(
  decryptedData: Record<string, unknown>
): Metadata {
  const type = detectSecretType(decryptedData);
  
  switch (type) {
    case SecretType.PASSWORD:
      return {
        type: SecretType.PASSWORD,
        title: String(decryptedData.title || ''),
        username: String(decryptedData.username || ''),
        passwordLength: getSecretLength(String(decryptedData.password || '')), // Safe: length only
        website: String(decryptedData.website || ''),
        hasNotes: Boolean(decryptedData.notes && typeof decryptedData.notes === 'string' && decryptedData.notes.length > 0),
      };
      
    case SecretType.API_KEY:
      return {
        type: SecretType.API_KEY,
        title: String(decryptedData.title || ''),
        serviceName: String(decryptedData.serviceName || ''),
        apiKeyLength: getSecretLength(String(decryptedData.apiKey || '')), // Safe: length only
        environment: String(decryptedData.environment || 'production'),
        hasNotes: Boolean(decryptedData.notes && typeof decryptedData.notes === 'string' && decryptedData.notes.length > 0),
      };
      
    case SecretType.ENV_VARS: {
      const variables = Array.isArray(decryptedData.variables) ? decryptedData.variables : [];
      return {
        type: SecretType.ENV_VARS,
        title: String(decryptedData.title || ''),
        description: String(decryptedData.description || ''),
        variableCount: variables.length,
        variableKeys: variables.map((v: unknown) => {
          if (typeof v === 'object' && v !== null && 'key' in v) {
            return String((v as { key: unknown }).key);
          }
          return '';
        }),
        hasNotes: Boolean(decryptedData.notes && typeof decryptedData.notes === 'string' && decryptedData.notes.length > 0),
      };
    }
      
    default:
      throw new Error(`Unknown secret type: ${type}`);
  }
}
