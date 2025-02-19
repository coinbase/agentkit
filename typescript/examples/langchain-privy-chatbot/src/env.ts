/**
 * Throws an error indicating that an environment variable is required
 *
 * @param name - The name of the required environment variable
 * @throws Error with a message indicating which environment variable is missing
 */
export function envIsRequired(name: string) {
  throw new Error(`Environment variable ${name} is required`);
}

/**
 * Validates that required environment variables are set
 *
 * @param requiredVars - Array of environment variable names that must be set
 * @throws {Error} - If required environment variables are missing
 */
export function validateEnvironment(requiredVars: readonly string[]) {
  const missingVars: string[] = [];

  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      console.error(`Required env var: ${varName}`);
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    throw new Error("Missing required environment variables");
  }
}
