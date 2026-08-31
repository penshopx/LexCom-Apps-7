import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import { pool } from "@workspace/db";

const app: Express = express();

let isReady = false;
let startupError: string | null = null;

export function setReady(value: boolean): void {
  isReady = value;
  startupError = null;
}

function formatStartupError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

export function setStartupError(error: unknown): void {
  isReady = false;
  startupError = formatStartupError(error);
}

export function getStartupError(): string | null {
  return startupError;
}

/**
 * Run the final startup gate. Keeping this separate from the listener event
 * makes it impossible for a failed initialization promise to become an
 * unhandled rejection while leaving the API marked ready.
 */
export async function completeStartup(
  initialize: () => Promise<void>,
): Promise<boolean> {
  try {
    await initialize();
    setReady(true);
    return true;
  } catch (error) {
    setStartupError(error);
    return false;
  }
}

const DEFAULT_DB_PING_CACHE_TTL_MS = 2000;
const _parsedTtl = Number(process.env.DB_PING_CACHE_TTL_MS);
export const DB_PING_CACHE_TTL_MS =
  Number.isFinite(_parsedTtl) && _parsedTtl >= 0
    ? _parsedTtl
    : DEFAULT_DB_PING_CACHE_TTL_MS;

let dbPingCache: { result: boolean; expiresAt: number } | null = null;

export function resetDbPingCache(): void {
  dbPingCache = null;
}

async function pingDatabase(): Promise<boolean> {
  const now = Date.now();
  if (dbPingCache !== null && now < dbPingCache.expiresAt) {
    return dbPingCache.result;
  }
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("db ping timeout")), 100);
  });
  let result: boolean;
  try {
    await Promise.race([pool.query("SELECT 1"), timeout]);
    result = true;
  } catch {
    result = false;
  } finally {
    clearTimeout(timeoutId);
  }
  dbPingCache = { result, expiresAt: Date.now() + DB_PING_CACHE_TTL_MS };
  return result;
}

export async function verifyDatabaseConnection(): Promise<void> {
  if (!(await pingDatabase())) {
    throw new Error("database unreachable during startup");
  }
}

function getNotReadyResponse(): { status: string; error?: string } {
  return {
    status: "not ready",
    ...(startupError ? { error: startupError } : {}),
  };
}

app.get("/health", async (_req: Request, res: Response) => {
  if (!isReady) {
    res.status(503).json(getNotReadyResponse());
    return;
  }
  const dbOk = await pingDatabase();
  if (dbOk) {
    res.status(200).json({ status: "ok" });
  } else {
    res.status(503).json({ status: "db unreachable" });
  }
});

app.use((_req: Request, res: Response, next: NextFunction) => {
  if (!isReady) {
    res.status(503).json(getNotReadyResponse());
    return;
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
