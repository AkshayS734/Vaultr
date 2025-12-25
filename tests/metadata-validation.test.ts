/**
 * Test: Verify metadata validation accepts safe fields
 */

import { validateMetadataSafety } from '@/app/lib/secret-utils';
import { validateMetadataSecurity } from '@/app/schemas/secrets';

describe('Metadata Validation', () => {
  // Test 1: Password metadata should be accepted
  test('accepts password metadata with passwordLength', () => {
    const goodPasswordMetadata = {
      type: 'PASSWORD',
      title: 'Gmail',
      username: 'john@gmail.com',
      passwordLength: 16,  // ✓ SAFE: Length only
      website: 'https://gmail.com',
      hasNotes: true,
    };
    expect(() => {
      validateMetadataSafety(goodPasswordMetadata as Record<string, unknown>);
      validateMetadataSecurity(goodPasswordMetadata);
    }).not.toThrow();
  });

  // Test 2: API key metadata should be accepted
  test('accepts API key metadata with apiKeyLength', () => {
    const goodApiKeyMetadata = {
      type: 'API_KEY',
      title: 'OpenAI Key',
      serviceName: 'OpenAI',
      apiKeyLength: 48,  // ✓ SAFE: Length only
      environment: 'production',
      hasNotes: false,
    };
    expect(() => {
      validateMetadataSafety(goodApiKeyMetadata as Record<string, unknown>);
      validateMetadataSecurity(goodApiKeyMetadata);
    }).not.toThrow();
  });

  // Test 3: Env vars metadata should be accepted (keys only)
  test('accepts env vars metadata with variable keys only', () => {
    const goodEnvVarsMetadata = {
      type: 'ENV_VARS',
      title: 'Production Config',
      description: 'Database and API vars',
      variableCount: 3,
      variableKeys: ['DATABASE_URL', 'API_KEY', 'JWT_SECRET'],  // ✓ SAFE: Keys only
      hasNotes: true,
    };
    expect(() => {
      validateMetadataSafety(goodEnvVarsMetadata as Record<string, unknown>);
      validateMetadataSecurity(goodEnvVarsMetadata);
    }).not.toThrow();
  });

  // Test 4: Should REJECT old passwordMask field
  test('rejects old passwordMask field', () => {
    const badMetadata = {
      type: 'PASSWORD',
      title: 'Gmail',
      username: 'john@gmail.com',
      passwordMask: '***word',  //   FORBIDDEN: Old format with real chars
      website: 'https://gmail.com',
      hasNotes: true,
    };
    expect(() => {
      validateMetadataSafety(badMetadata as Record<string, unknown>);
    }).toThrow();
  });

  // Test 5: Should REJECT old apiKeyMask field
  test('rejects old apiKeyMask field', () => {
    const badMetadata = {
      type: 'API_KEY',
      title: 'OpenAI Key',
      serviceName: 'OpenAI',
      apiKeyMask: '***xyz1',  //   FORBIDDEN: Old format with real chars
      environment: 'production',
      hasNotes: false,
    };
    expect(() => {
      validateMetadataSafety(badMetadata as Record<string, unknown>);
    }).toThrow();
  });

  // Test 6: Should REJECT partial secret patterns
  test('rejects partial secret patterns', () => {
    const badMetadata = {
      type: 'PASSWORD',
      title: 'Test',
      customField: '***word',  //   FORBIDDEN: Partial secret pattern
      passwordLength: 12,
    };
    expect(() => {
      validateMetadataSecurity(badMetadata);
    }).toThrow();
  });

  // Test 7: Should REJECT real password values
  test('rejects real password values', () => {
    const badMetadata = {
      type: 'PASSWORD',
      title: 'Gmail',
      username: 'john@gmail.com',
      password: 'myRealPassword123',  //   FORBIDDEN: Real secret
      website: 'https://gmail.com',
    };
    expect(() => {
      validateMetadataSafety(badMetadata as Record<string, unknown>);
    }).toThrow();
  });

  // Test 8: Should REJECT real API key values
  test('rejects real API key values', () => {
    const badMetadata = {
      type: 'API_KEY',
      title: 'OpenAI Key',
      serviceName: 'OpenAI',
      apiKey: 'sk-proj-real-key',  //   FORBIDDEN: Real secret
      environment: 'production',
    };
    expect(() => {
      validateMetadataSafety(badMetadata as Record<string, unknown>);
    }).toThrow();
  });
});
