import { describe, it, expect, beforeEach, vi } from "vitest";

const { getOidcConfig, verifyDatabaseConnection } = vi.hoisted(() => ({
  getOidcConfig: vi.fn(),
  verifyDatabaseConnection: vi.fn(),
}));

vi.mock("./lib/auth", () => ({ getOidcConfig }));
vi.mock("./app", () => ({ verifyDatabaseConnection }));

const { initializeServer, validateStartupEnvironment } =
  await import("./startup");

describe("server startup checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOidcConfig.mockResolvedValue({});
    verifyDatabaseConnection.mockResolvedValue(undefined);
  });

  it("rejects startup when a required environment variable is missing", async () => {
    expect(() =>
      validateStartupEnvironment({} as NodeJS.ProcessEnv),
    ).toThrowError(/REPL_ID/);

    expect(verifyDatabaseConnection).not.toHaveBeenCalled();
    expect(getOidcConfig).not.toHaveBeenCalled();
  });

  it("runs database and OIDC checks before startup completes", async () => {
    await initializeServer();

    expect(verifyDatabaseConnection).toHaveBeenCalledOnce();
    expect(getOidcConfig).toHaveBeenCalledOnce();
  });

  it("propagates OIDC discovery failures to the readiness gate", async () => {
    getOidcConfig.mockRejectedValueOnce(new Error("OIDC discovery failed"));

    await expect(initializeServer()).rejects.toThrow("OIDC discovery failed");
  });
});
