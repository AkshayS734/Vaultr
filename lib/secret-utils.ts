/**
 * Secret Management Utilities
 * 
 * SECURITY ARCHITECTURE:
 * - encryptedData: Contains ALL sensitive values, fully encrypted
 * - metadata: Contains ONLY non-sensitive, masked, or descriptive fields
 * 
 * STRICT RULES:
 * 1. NEVER store full or partial secrets in metadata
 * 2. Only last 4 characters for masking (consistent standard)
 * 3. Search and filtering operate ONLY on metadata and never on secrets
 * 4. No logging, indexing, or partial encryption of secrets
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
export interface PasswordMetadata {
  type: SecretType.PASSWORD;
  title: string;
  username: string;
  passwordMask: string;
  website: string;
  hasNotes: boolean;
}

export interface ApiKeyMetadata {
  type: SecretType.API_KEY;
  title: string;
  serviceName: string;
  apiKeyMask: string;
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
 * Mask a secret value - show only last 4 characters
 * SECURITY: Never show more than last 4 chars
 */
export function maskSecret(value: string): string {
  if (!value || value.length === 0) return '';
  if (value.length <= 4) return '****';
  return '***' + value.slice(-4);
}

/**
 * Build metadata for a PASSWORD secret
 * ONLY non-sensitive, masked, or descriptive fields
 */
export function buildPasswordMetadata(input: PasswordInput): PasswordMetadata {
  return {
    type: SecretType.PASSWORD,
    title: input.title,
    username: input.username || '',
    passwordMask: maskSecret(input.password),
    website: input.website || '',
    hasNotes: Boolean(input.notes && input.notes.length > 0),
  };
}

/**
 * Build metadata for an API_KEY secret
 * ONLY non-sensitive, masked, or descriptive fields
 */
export function buildApiKeyMetadata(input: ApiKeyInput): ApiKeyMetadata {
  return {
    type: SecretType.API_KEY,
    title: input.title,
    serviceName: input.serviceName,
    apiKeyMask: maskSecret(input.apiKey),
    environment: input.environment || 'production',
    hasNotes: Boolean(input.notes && input.notes.length > 0),
  };
}

/**
 * Build metadata for ENV_VARS secret
 * ONLY non-sensitive, masked, or descriptive fields
 */
export function buildEnvVarsMetadata(input: EnvVarsInput): EnvVarsMetadata {
  return {
    type: SecretType.ENV_VARS,
    title: input.title,
    description: input.description || '',
    variableCount: input.variables.length,
    variableKeys: input.variables.map(v => v.key), // Keys are not sensitive
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
 * This is a safety check to prevent accidental secret leakage
 * 
 * @param metadata - Metadata object to validate
 * @throws Error if metadata contains forbidden fields
 */
export function validateMetadataSafety(metadata: Record<string, unknown>): void {
  const forbiddenKeys = ['password', 'apiKey', 'value', 'secret', 'token'];
  
  const checkObject = (obj: Record<string, unknown>, path = ''): void => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      
      // Check for forbidden key names
      if (forbiddenKeys.some(forbidden => key.toLowerCase().includes(forbidden))) {
        // Allow masked versions
        if (!key.toLowerCase().includes('mask')) {
          throw new Error(
            `Security violation: Metadata contains forbidden field "${fullPath}". ` +
            `Sensitive data must ONLY be in encryptedData.`
          );
        }
      }
      
      // Recursively check nested objects
      if (typeof value === 'object' && value !== null) {
        checkObject(value as Record<string, unknown>, fullPath);
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
        passwordMask: maskSecret(String(decryptedData.password || '')),
        website: String(decryptedData.website || ''),
        hasNotes: Boolean(decryptedData.notes && typeof decryptedData.notes === 'string' && decryptedData.notes.length > 0),
      };
      
    case SecretType.API_KEY:
      return {
        type: SecretType.API_KEY,
        title: String(decryptedData.title || ''),
        serviceName: String(decryptedData.serviceName || ''),
        apiKeyMask: maskSecret(String(decryptedData.apiKey || '')),
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
