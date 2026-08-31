import { getOidcConfig } from "./lib/auth";
import { verifyDatabaseConnection } from "./app";

const REQUIRED_STARTUP_ENV = ["REPL_ID"] as const;

export function validateStartupEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const missing = REQUIRED_STARTUP_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}`,
    );
  }
}

export async function initializeServer(): Promise<void> {
  validateStartupEnvironment();
  await verifyDatabaseConnection();
  await getOidcConfig();
}
