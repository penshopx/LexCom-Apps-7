import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/auth", () => ({
  getSessionId: vi.fn(),
  getSession: vi.fn(),
  clearSession: vi.fn(),
  updateSession: vi.fn(),
  getOidcConfig: vi.fn(),
}));

import * as auth from "../lib/auth";
import { authMiddleware } from "./authMiddleware";
import type { Request, Response, NextFunction } from "express";

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  return {
    clearCookie: vi.fn(),
  } as unknown as Response;
}

const NOW_SECONDS = Math.floor(Date.now() / 1000);

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proceeds as unauthenticated when there is no session cookie", async () => {
    vi.mocked(auth.getSessionId).mockReturnValue(undefined);

    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it("attaches the correct user to the request for a valid session", async () => {
    const sid = "valid-session-id";
    const user = {
      id: "user-123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      profileImageUrl: null,
    };
    const session: auth.SessionData = {
      user,
      access_token: "token-abc",
      expires_at: NOW_SECONDS + 3600,
    };

    vi.mocked(auth.getSessionId).mockReturnValue(sid);
    vi.mocked(auth.getSession).mockResolvedValue(session);

    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual(user);
  });

  it("clears the session and proceeds as unauthenticated when session is expired with no refresh token", async () => {
    const sid = "expired-session-id";
    const user = {
      id: "user-456",
      email: "expired@example.com",
      firstName: "Expired",
      lastName: "User",
      profileImageUrl: null,
    };
    const session: auth.SessionData = {
      user,
      access_token: "old-token",
      expires_at: NOW_SECONDS - 1,
    };

    vi.mocked(auth.getSessionId).mockReturnValue(sid);
    vi.mocked(auth.getSession).mockResolvedValue(session);
    vi.mocked(auth.clearSession).mockResolvedValue(undefined);

    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await authMiddleware(req, res, next);

    expect(auth.clearSession).toHaveBeenCalledWith(res, sid);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });
});
