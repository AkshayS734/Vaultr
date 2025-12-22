/**
 * Security Validation Tests
 * 
 * These tests demonstrate the security improvements in metadata handling.
 * They verify encryption boundaries are enforced.
 */

import { 
  createGenericMask, 
  getSecretLength,
  validateMetadataSafety,
  buildPasswordMetadata,
  buildApiKeyMetadata,
  buildEnvVarsMetadata,
  type PasswordInput,
  type ApiKeyInput,
  type EnvVarsInput
} from '@/lib/secret-utils';

import { validateMetadataSecurity } from '@/schemas/secrets';

describe('Security Validation', () => {
  // ============================================================================
  // TEST 1: Generic Masking (No Real Characters)
  // ============================================================================

  describe('Generic Masking', () => {
    test('generic mask reveals no real characters', () => {
      const password = 'mySecretPassword123';
      const mask = createGenericMask(password);
      
      // Should not contain any characters from the original password
      expect(mask).toBe('********');
      expect(mask).not.toContain('Secret');
      expect(mask).not.toContain('Password');
      expect(mask).not.toContain('123');
    });

    test('secret length is non-reversible', () => {
      const password = 'mySecretPassword123';
      const length = getSecretLength(password);
      
      // Length alone should not reveal the password
      expect(length).toBe(19);
      expect(length).not.toBeLessThan(0);
    });
  });

  // ============================================================================
  // TEST 2: Metadata Builders Produce Safe Metadata
  // ============================================================================

  describe('Metadata Builders', () => {
    test('password metadata contains no real password', () => {
      const passwordInput: PasswordInput = {
        title: 'My Password',
        username: 'john@example.com',
        password: 'superSecretPassword',
        website: 'https://example.com',
        notes: 'Important notes'
      };

      const metadata = buildPasswordMetadata(passwordInput);
      
      expect(metadata.passwordLength).toBe(19);
      expect(metadata.title).toBe('My Password');
      expect(metadata.username).toBe('john@example.com');
      expect(JSON.stringify(metadata)).not.toContain('superSecretPassword');
    });

    test('API key metadata contains no real API key', () => {
      const apiKeyInput: ApiKeyInput = {
        title: 'Production API Key',
        serviceName: 'OpenAI',
        apiKey: 'sk-proj-real-api-key-here-12345',
        environment: 'production',
        notes: 'Main API key'
      };

      const metadata = buildApiKeyMetadata(apiKeyInput);
      
      expect(metadata.apiKeyLength).toBe(31);
      expect(metadata.title).toBe('Production API Key');
      expect(metadata.serviceName).toBe('OpenAI');
      expect(JSON.stringify(metadata)).not.toContain('sk-proj');
      expect(JSON.stringify(metadata)).not.toContain('real-api-key');
    });

    test('env vars metadata stores keys only, not values', () => {
      const envVarsInput: EnvVarsInput = {
        title: 'Production Env Vars',
        description: 'Database and API credentials',
        variables: [
          { key: 'DATABASE_URL', value: 'postgresql://user:pass@host/db' },
          { key: 'API_KEY', value: 'secret-api-key-123' },
          { key: 'JWT_SECRET', value: 'super-secret-jwt-token' }
        ]
      };

      const metadata = buildEnvVarsMetadata(envVarsInput);
      
      expect(metadata.variableCount).toBe(3);
      expect(metadata.variableKeys).toEqual(['DATABASE_URL', 'API_KEY', 'JWT_SECRET']);
      expect(JSON.stringify(metadata)).not.toContain('postgresql://');
      expect(JSON.stringify(metadata)).not.toContain('secret-api-key');
      expect(JSON.stringify(metadata)).not.toContain('super-secret-jwt-token');
    });
  });

  // ============================================================================
  // TEST 3: Validation Rejects Forbidden Patterns
  // ============================================================================

  describe('Validation Rejects Forbidden Patterns', () => {
    test('rejects partial secret masks', () => {
      const badMetadata = {
        type: 'PASSWORD',
        title: 'Test',
        username: 'user',
        passwordMask: '***word',
        website: '',
        hasNotes: false
      };
      
      expect(() => {
        validateMetadataSafety(badMetadata as Record<string, unknown>);
      }).toThrow();
    });

    test('rejects apiKey field', () => {
      const badMetadata = {
        type: 'API_KEY',
        title: 'Test',
        serviceName: 'Service',
        apiKey: 'sk-real-key',
        environment: 'prod',
        hasNotes: false
      };
      
      expect(() => {
        validateMetadataSafety(badMetadata as Record<string, unknown>);
      }).toThrow();
    });

    test('rejects partial secret patterns in validation', () => {
      const badMetadata = {
        type: 'PASSWORD',
        title: 'Test',
        username: 'user',
        customField: '***local',
        passwordLength: 12,
        website: '',
        hasNotes: false
      };
      
      expect(() => {
        validateMetadataSecurity(badMetadata);
      }).toThrow();
    });

    test('accepts safe metadata', () => {
      const goodMetadata = {
        type: 'PASSWORD',
        title: 'My Password',
        username: 'john@example.com',
        passwordLength: 20,
        website: 'https://example.com',
        hasNotes: true
      };
      
      expect(() => {
        validateMetadataSafety(goodMetadata as Record<string, unknown>);
        validateMetadataSecurity(goodMetadata);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // TEST 4: ENV_VARS Validation
  // ============================================================================

  describe('ENV_VARS Security', () => {
    test('rejects env var values', () => {
      const badEnvMetadata = {
        type: 'ENV_VARS',
        title: 'Env Vars',
        description: 'Test',
        variables: [
          { key: 'API_KEY', value: 'secret123' }
        ],
        variableCount: 1,
        hasNotes: false
      };
      
      expect(() => {
        validateMetadataSafety(badEnvMetadata as Record<string, unknown>);
      }).toThrow();
    });

    test('accepts env var keys only', () => {
      const goodEnvMetadata = {
        type: 'ENV_VARS',
        title: 'Production Vars',
        description: 'Database config',
        variableCount: 3,
        variableKeys: ['DATABASE_URL', 'API_KEY', 'JWT_SECRET'],
        hasNotes: true
      };
      
      expect(() => {
        validateMetadataSafety(goodEnvMetadata as Record<string, unknown>);
        validateMetadataSecurity(goodEnvMetadata);
      }).not.toThrow();
    });
  });
});
