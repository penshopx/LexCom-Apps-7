import { execSync } from "child_process";
import app, { completeStartup, getStartupError, setStartupError } from "./app";
import { logger } from "./lib/logger";
import { initializeServer } from "./startup";

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
  void completeStartup(initializeServer).then((ready) => {
    if (ready) {
      logger.info(
        { port },
        "Startup checks complete; server is ready to accept requests",
      );
      return;
    }

    logger.error(
      { err: getStartupError(), port },
      "API server startup checks failed; server will remain not ready",
    );
  });
});

server.once("error", (err) => {
  setStartupError(err);
  logger.fatal({ err, port }, "API server failed to start");
  process.exit(1);
});
