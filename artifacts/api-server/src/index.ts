import { execSync } from "child_process";
import app, { setReady } from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (process.env["NODE_ENV"] !== "production") {
  try {
    logger.info("Applying database schema (dev mode)...");
    execSync("pnpm --filter @workspace/db push", { stdio: "inherit" });
    logger.info("Database schema applied successfully");
  } catch (err) {
    logger.error({ err }, "Failed to apply database schema");
    process.exit(1);
  }
} else {
  try {
    logger.info("Production mode: applying database schema...");
    execSync("pnpm --filter @workspace/db push", { stdio: "inherit" });
    logger.info("Database schema applied successfully");
  } catch (err) {
    logger.error({ err }, "Failed to apply database schema");
    process.exit(1);
  }
}

// INVARIANT: setReady(true) must only be called after all migrations have
// fully completed — including any future async migration steps (which must be
// awaited before reaching this line). Calling setReady prematurely will allow
// requests to hit an incomplete schema.
setReady(true);
logger.info("Migrations complete, server is ready to accept requests");

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
