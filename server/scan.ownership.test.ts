import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getClientByUserId: vi.fn(),
  getSessionByIdForClient: vi.fn(),
  updateSessionForClient: vi.fn(),
  createWebhookLog: vi.fn(),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(),
}));

vi.mock("./ghl", () => ({
  ghlUpsertAndTag: vi.fn(),
  ghlSendMagicLinkEmail: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const db = await import("./db");

function createClientContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "client-user",
    email: "client@example.com",
    name: "Client User",
    loginMethod: "magic_link",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: { host: "example.com" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("scan session ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getClientByUserId).mockResolvedValue({
      id: 7,
      userId: 42,
      name: "Client User",
      email: "client@example.com",
      program: "rebuild",
      startDate: new Date(),
      ageBracket: 35,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("does not return a session unless it belongs to the current client", async () => {
    vi.mocked(db.getSessionByIdForClient).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createClientContext());

    await expect(caller.scan.getById({ id: 123 })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Session not found.",
    } satisfies Partial<TRPCError>);

    expect(db.getSessionByIdForClient).toHaveBeenCalledWith(123, 7);
  });

  it("does not generate a PDF for another client's session", async () => {
    vi.mocked(db.getSessionByIdForClient).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createClientContext());

    await expect(caller.scan.getPdf({ sessionId: 123 })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Session not found.",
    } satisfies Partial<TRPCError>);

    expect(db.getSessionByIdForClient).toHaveBeenCalledWith(123, 7);
  });

  it("does not update feedback for another client's session", async () => {
    vi.mocked(db.getSessionByIdForClient).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createClientContext());

    await expect(caller.scan.submitFeedback({ sessionId: 123, feedback: "Felt tight." })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Session not found.",
    } satisfies Partial<TRPCError>);

    expect(db.updateSessionForClient).not.toHaveBeenCalled();
  });
});
