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

// INVARIANT: migrations must finish before the server can become ready, and
// the server must emit "listening" before requests are allowed through.
// Keeping these gates separate prevents a failed bind from being reported as
// a ready API.
const server = app.listen(port);

server.once("listening", () => {
  setReady(true);
  logger.info({ port }, "Migrations complete; server is ready to accept requests");
});

server.once("error", (err) => {
  setReady(false);
  logger.fatal({ err, port }, "API server failed to start");
  process.exit(1);
});
