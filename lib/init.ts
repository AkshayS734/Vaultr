/**
 * This file runs at Next.js startup to validate the environment
 * Import this in your root layout
 */

import { validateEnvironment } from './env'

// Run validation on import
validateEnvironment()

export default validateEnvironment
