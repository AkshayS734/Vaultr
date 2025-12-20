/**
 * Validation Examples - What Works and What Doesn't
 */

// ============================================================================
// EXAMPLE 1: PASSWORD METADATA - WHAT WORKS ✅
// ============================================================================

const goodPasswordMetadata = {
  type: 'PASSWORD',
  title: 'Gmail Account',           // ✅ Safe: Just a label
  username: 'john@gmail.com',       // ✅ Safe: Username is not sensitive
  passwordLength: 16,               // ✅ Safe: Only the length, no real chars
  website: 'https://gmail.com',     // ✅ Safe: Website URL
  hasNotes: true,                   // ✅ Safe: Boolean flag
};
// Result: ✅ ACCEPTED

// ============================================================================
// EXAMPLE 2: PASSWORD METADATA - WHAT DOESN'T WORK  
// ============================================================================

const badPasswordMetadata1 = {
  type: 'PASSWORD',
  title: 'Gmail Account',
  username: 'john@gmail.com',
  password: 'myRealPassword123',    //   REJECTED: Real secret value
  website: 'https://gmail.com',
  hasNotes: true,
};
// Result:   REJECTED - field "password" is forbidden

const badPasswordMetadata2 = {
  type: 'PASSWORD',
  title: 'Gmail Account',
  username: 'john@gmail.com',
  passwordMask: '***word',          //   REJECTED: Old format, reveals chars
  website: 'https://gmail.com',
  hasNotes: true,
};
// Result:   REJECTED - field "passwordMask" is forbidden

const badPasswordMetadata3 = {
  type: 'PASSWORD',
  title: 'Gmail Account',
  username: 'john@gmail.com',
  passwordLength: 16,
  website: 'https://gmail.com',
  hasNotes: true,
  preview: 'myRe',                  //   REJECTED: Partial secret
};
// Result:   REJECTED - custom fields with secret content

// ============================================================================
// EXAMPLE 3: API KEY METADATA - WHAT WORKS ✅
// ============================================================================

const goodApiKeyMetadata = {
  type: 'API_KEY',
  title: 'Production API Key',      // ✅ Safe: Label
  serviceName: 'OpenAI',            // ✅ Safe: Service name
  apiKeyLength: 48,                 // ✅ Safe: Only length
  environment: 'production',        // ✅ Safe: Environment name
  hasNotes: false,                  // ✅ Safe: Boolean
};
// Result: ✅ ACCEPTED

// ============================================================================
// EXAMPLE 4: API KEY METADATA - WHAT DOESN'T WORK  
// ============================================================================

const badApiKeyMetadata1 = {
  type: 'API_KEY',
  title: 'Production API Key',
  serviceName: 'OpenAI',
  apiKey: 'sk-proj-real-key-here',  //   REJECTED: Real secret
  environment: 'production',
  hasNotes: false,
};
// Result:   REJECTED - field "apikey" is forbidden

const badApiKeyMetadata2 = {
  type: 'API_KEY',
  title: 'Production API Key',
  serviceName: 'OpenAI',
  apiKeyMask: '***xyz1',            //   REJECTED: Old format
  environment: 'production',
  hasNotes: false,
};
// Result:   REJECTED - field "apikeyMask" is forbidden

const badApiKeyMetadata3 = {
  type: 'API_KEY',
  title: 'Production API Key',
  serviceName: 'OpenAI',
  apiKeyLength: 48,
  environment: 'production',
  hasNotes: false,
  suffix: '***xyz',                 //   REJECTED: Pattern reveals chars
};
// Result:   REJECTED - field contains partial secret pattern "***xyz"

// ============================================================================
// EXAMPLE 5: ENV VARS METADATA - WHAT WORKS ✅
// ============================================================================

const goodEnvVarsMetadata = {
  type: 'ENV_VARS',
  title: 'Production Config',       // ✅ Safe: Label
  description: 'Database and API',  // ✅ Safe: Description
  variableCount: 3,                 // ✅ Safe: Count
  variableKeys: [                   // ✅ Safe: KEYS ONLY, not values
    'DATABASE_URL',
    'API_KEY',
    'JWT_SECRET'
  ],
  hasNotes: true,                   // ✅ Safe: Boolean
};
// Result: ✅ ACCEPTED

// ============================================================================
// EXAMPLE 6: ENV VARS METADATA - WHAT DOESN'T WORK  
// ============================================================================

const badEnvVarsMetadata1 = {
  type: 'ENV_VARS',
  title: 'Production Config',
  description: 'Database and API',
  variables: [                       //   REJECTED: Contains values
    { key: 'DATABASE_URL', value: 'postgresql://user:pass@host/db' },
    { key: 'API_KEY', value: 'secret-key-123' }
  ],
  variableCount: 2,
  hasNotes: true,
};
// Result:   REJECTED - field "value" is forbidden

const badEnvVarsMetadata2 = {
  type: 'ENV_VARS',
  title: 'Production Config',
  description: 'Database and API',
  variableCount: 2,
  variableValues: [                 //   REJECTED: Contains values
    'postgresql://user:pass@host/db',
    'secret-key-123'
  ],
  hasNotes: true,
};
// Result:   REJECTED - field contains sensitive data

// ============================================================================
// SUMMARY TABLE
// ============================================================================

const ALLOWED_METADATA_FIELDS = {
  common: [
    'type',           // Secret type (PASSWORD, API_KEY, ENV_VARS)
    'title',          // Display title
    'hasNotes',       // Boolean: whether notes exist
  ],
  password: [
    'username',       // Username/email (if not sensitive)
    'website',        // Website URL
    'passwordLength', // Length only, no real chars
  ],
  apiKey: [
    'serviceName',    // Service name (OpenAI, AWS, etc.)
    'environment',    // Environment (production, staging, dev)
    'apiKeyLength',   // Length only, no real chars
  ],
  envVars: [
    'description',    // Description of the env vars
    'variableCount',  // Number of variables
    'variableKeys',   // Variable names only (NOT values)
  ],
};

const FORBIDDEN_METADATA_FIELDS = {
  exact: [
    'password',       // Real password value
    'apikey',         // Real API key
    'value',          // Generic secret value
    'secret',         // Generic secret
    'token',          // Token value
    'credential',     // Credential value
    'mask',           // Generic mask
    'passwordMask',   // Old format with real chars
    'apiKeyMask',     // Old format with real chars
  ],
  pattern: [
    '***word',        // Pattern revealing real characters
    '***local',       // Pattern revealing real characters
    '***xyz1',        // Pattern revealing real characters
  ],
};

// ============================================================================
// VALIDATION FLOW
// ============================================================================

/*
When you submit a new secret:

1. Frontend
   └─ buildMetadata(type, input)
      └─ Returns: {type, title, username, passwordLength, ...}

2. validateMetadataSafety(metadata)
   └─ Checks field names against forbiddenKeys Set
   └─ Checks string values for partial secret patterns
   └─ Returns: Error if forbidden, or undefined if safe

3. validateMetadataSecurity(metadata)
   └─ Zod schema validation
   └─ Pattern matching
   └─ Returns: Error if invalid, or undefined if valid

4. API Route saves to database
   └─ Only saves if both validations pass

Result: ✅ Safe metadata stored,   Dangerous metadata rejected
*/

// ============================================================================
// HOW TO DEBUG YOUR OWN METADATA
// ============================================================================

/*
If you get a validation error, check:

1. Field Names
   - Is there a forbidden field like "password", "apiKey", "value"?
   - Is there an old format like "passwordMask", "apiKeyMask"?
   - Check: const isForbidden = forbiddenKeys.has(fieldName.toLowerCase())

2. Field Values
   - Are there real secret characters?
   - Is the value like "***word" or "***xyz"?
   - Check: /^\*+[^*]+$/.test(value) // Matches "***word"

3. Structure
   - Is metadata built using buildMetadata() helper?
   - Does it match the Zod schema for your secret type?
   - Check the TypeScript interface

4. Common Mistakes
   -   Manually creating metadata instead of using buildMetadata()
   -   Storing env var values instead of keys
   -   Including custom fields with secret data
   -   Using old "Mask" fields

Fix by:
   ✅ Always use buildMetadata(type, input)
   ✅ Only include allowed fields
   ✅ Never include real secrets or fragments
   ✅ Update to use new Length fields
*/
