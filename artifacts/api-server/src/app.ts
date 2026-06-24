import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import { pool } from "@workspace/db";

const app: Express = express();

let isReady = false;

export function setReady(value: boolean): void {
  isReady = value;
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

app.get("/health", async (_req: Request, res: Response) => {
  if (!isReady) {
    res.status(503).json({ status: "not ready" });
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
    res.status(503).json({ status: "not ready" });
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
