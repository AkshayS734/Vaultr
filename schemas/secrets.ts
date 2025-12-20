/**
 * Zod validation schemas for secret management
 * 
 * CRITICAL SECURITY RULES:
 * - Metadata schemas must NEVER accept full secrets
 * - Only masked or descriptive fields allowed in metadata
 * - Encrypted payload schemas contain ALL sensitive data
 */

import { z } from 'zod';

// ============================================================================
// SECRET TYPE ENUM
// ============================================================================

export const SecretTypeSchema = z.enum(['PASSWORD', 'API_KEY', 'ENV_VARS']);

// ============================================================================
// PASSWORD SCHEMAS
// ============================================================================

/**
 * Password encrypted payload (ALL sensitive data)
 */
export const PasswordEncryptedPayloadSchema = z.object({
  type: z.literal('PASSWORD'),
  title: z.string().min(1, 'Title is required'),
  username: z.string().optional().default(''),
  password: z.string().min(1, 'Password is required'),
  website: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

/**
 * Password metadata (ONLY non-sensitive data)
 * SECURITY CRITICAL: No full passwords or partial secrets allowed
 * Only non-reversible derived information (length, counts, flags)
 */
export const PasswordMetadataSchema = z.object({
  type: z.literal('PASSWORD'),
  title: z.string().min(1),
  username: z.string().optional().default(''),
  passwordLength: z.number().int().min(0), // Safe: only length, no real characters
  website: z.string().optional().default(''),
  hasNotes: z.boolean(),
}).strict(); // strict mode prevents additional fields

// ============================================================================
// API KEY SCHEMAS
// ============================================================================

/**
 * API Key encrypted payload (ALL sensitive data)
 */
export const ApiKeyEncryptedPayloadSchema = z.object({
  type: z.literal('API_KEY'),
  title: z.string().min(1, 'Title is required'),
  serviceName: z.string().min(1, 'Service name is required'),
  apiKey: z.string().min(1, 'API key is required'),
  environment: z.string().optional().default('production'),
  notes: z.string().optional().default(''),
});

/**
 * API Key metadata (ONLY non-sensitive data)
 * SECURITY CRITICAL: No full API keys or partial secrets allowed
 * Only non-reversible derived information (length, counts, flags)
 */
export const ApiKeyMetadataSchema = z.object({
  type: z.literal('API_KEY'),
  title: z.string().min(1),
  serviceName: z.string().min(1),
  apiKeyLength: z.number().int().min(0), // Safe: only length, no real characters
  environment: z.string().optional().default('production'),
  hasNotes: z.boolean(),
}).strict();

// ============================================================================
// ENVIRONMENT VARIABLES SCHEMAS
// ============================================================================

/**
 * Environment variable (key-value pair)
 */
export const EnvVariableSchema = z.object({
  key: z.string().min(1, 'Variable key cannot be empty'),
  value: z.string(), // Value can be empty string
});

/**
 * Environment Variables encrypted payload (ALL sensitive data)
 */
export const EnvVarsEncryptedPayloadSchema = z.object({
  type: z.literal('ENV_VARS'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  variables: z.array(EnvVariableSchema).min(1, 'At least one variable is required'),
  notes: z.string().optional().default(''),
}).refine(
  (data) => {
    // Check for duplicate keys
    const keys = data.variables.map(v => v.key);
    const uniqueKeys = new Set(keys);
    return keys.length === uniqueKeys.size;
  },
  {
    message: 'Duplicate environment variable keys are not allowed',
  }
);

/**
 * Environment Variables metadata (ONLY non-sensitive data)
 * SECURITY: No variable values allowed, only keys
 */
export const EnvVarsMetadataSchema = z.object({
  type: z.literal('ENV_VARS'),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  variableCount: z.number().int().min(0),
  variableKeys: z.array(z.string()), // Keys are not sensitive
  hasNotes: z.boolean(),
}).strict();

// ============================================================================
// UNIFIED SCHEMAS
// ============================================================================

/**
 * Union for all encrypted payloads
 */
export const EncryptedPayloadSchema = z.union([
  PasswordEncryptedPayloadSchema,
  ApiKeyEncryptedPayloadSchema,
  EnvVarsEncryptedPayloadSchema,
]);

/**
 * Union for all metadata schemas
 */
export const MetadataSchema = z.union([
  PasswordMetadataSchema,
  ApiKeyMetadataSchema,
  EnvVarsMetadataSchema,
]);

// ============================================================================
// API REQUEST SCHEMAS
// ============================================================================

/**
 * Create secret request (client to server)
 */
export const CreateSecretRequestSchema = z.object({
  encryptedData: z.string().min(1, 'Encrypted data is required'),
  iv: z.string().min(1, 'IV is required'),
  metadata: MetadataSchema.optional(),
  secretType: SecretTypeSchema.default('PASSWORD'),
});

/**
 * Update secret request (client to server)
 */
export const UpdateSecretRequestSchema = z.object({
  encryptedData: z.string().min(1, 'Encrypted data is required'),
  iv: z.string().min(1, 'IV is required'),
  metadata: MetadataSchema.optional(),
  secretType: SecretTypeSchema.optional(),
});

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

/**
 * Validate that metadata does NOT contain forbidden sensitive fields
 * SECURITY CRITICAL: Runtime safety check beyond Zod validation
 * 
 * Detects and rejects:
 * - Forbidden field names (password, apiKey, secret, token, etc.)
 * - Partial secret patterns (e.g., "***word" that reveals real characters)
 * - Any nested secret data
 */
export function validateMetadataSecurity(metadata: unknown): void {
  if (!metadata || typeof metadata !== 'object') {
    return;
  }

  // Forbidden field names (exact match to avoid false positives like passwordLength)
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

  // Allowed field names for metadata
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
          `Full secrets must ONLY be in encryptedData, never in metadata.`
        );
      }

      // Check string values for partial secret patterns
      if (typeof value === 'string' && value.length > 0) {
        // Detect patterns like "***word" that expose real characters
        if (/^\*+[^*]+$/.test(value)) {
          throw new Error(
            `SECURITY VIOLATION: Metadata field "${fullPath}" contains a partial secret ` +
            `pattern ("${value}") that reveals real characters. This is strictly forbidden.`
          );
        }
      }

      // Check for suspiciously long strings (potential secrets)
      if (typeof value === 'string' && value.length > 100) {
        // Allow URLs and descriptions
        if (!key.toLowerCase().includes('url') && 
            !key.toLowerCase().includes('description') &&
            !key.toLowerCase().includes('note')) {
          console.warn(
            `Warning: Metadata field "${fullPath}" contains a long string (${value.length} chars). ` +
            `Ensure this is not sensitive data.`
          );
        }
      }

      // Recursively check nested objects and arrays
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              checkObject(item as Record<string, unknown>, `${fullPath}[${index}]`);
            }
            // Also check string array items for secret patterns
            if (typeof item === 'string' && /^\*+[^*]+$/.test(item)) {
              throw new Error(
                `SECURITY VIOLATION: Array item at "${fullPath}[${index}]" contains ` +
                `a partial secret pattern that reveals real characters.`
              );
            }
          });
        } else {
          checkObject(value as Record<string, unknown>, fullPath);
        }
      }
    }
  };

  checkObject(metadata as Record<string, unknown>);
}

/**
 * Validate encrypted payload structure
 */
export function validateEncryptedPayload(payload: unknown) {
  return EncryptedPayloadSchema.parse(payload);
}

/**
 * Validate metadata structure
 */
export function validateMetadata(metadata: unknown) {
  // First validate structure with Zod
  const validated = MetadataSchema.parse(metadata);
  
  // Then perform additional security checks
  validateMetadataSecurity(validated);
  
  return validated;
}

/**
 * Validate create secret request
 */
export function validateCreateSecretRequest(data: unknown) {
  return CreateSecretRequestSchema.parse(data);
}

/**
 * Validate update secret request
 */
export function validateUpdateSecretRequest(data: unknown) {
  return UpdateSecretRequestSchema.parse(data);
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SecretType = z.infer<typeof SecretTypeSchema>;
export type PasswordEncryptedPayload = z.infer<typeof PasswordEncryptedPayloadSchema>;
export type PasswordMetadata = z.infer<typeof PasswordMetadataSchema>;
export type ApiKeyEncryptedPayload = z.infer<typeof ApiKeyEncryptedPayloadSchema>;
export type ApiKeyMetadata = z.infer<typeof ApiKeyMetadataSchema>;
export type EnvVarsEncryptedPayload = z.infer<typeof EnvVarsEncryptedPayloadSchema>;
export type EnvVarsMetadata = z.infer<typeof EnvVarsMetadataSchema>;
export type EncryptedPayload = z.infer<typeof EncryptedPayloadSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type CreateSecretRequest = z.infer<typeof CreateSecretRequestSchema>;
export type UpdateSecretRequest = z.infer<typeof UpdateSecretRequestSchema>;
