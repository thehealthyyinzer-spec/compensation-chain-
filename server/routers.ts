import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { sdk } from "./_core/sdk";
import { generatePdfHtml } from "./pdf";
import { ghlUpsertAndTag, ghlSendMagicLinkEmail } from "./ghl";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== MAGIC LINK AUTH ====================
  magicLink: router({
    // Request a magic link — sends to email (for now, creates the link and returns it for testing)
    request: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const token = nanoid(48);
        const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes

        await db.createMagicLink(input.email, token, expiresAt);

        // In production, this would send an email via GHL or another service.
        // For now, return the token so the frontend can construct the link.
        return { success: true, token };
      }),

    // Admin sends a magic link directly to a client's email
    sendToClient: adminProcedure
      .input(z.object({ email: z.string().email(), origin: z.string() }))
      .mutation(async ({ input }) => {
        const token = nanoid(48);
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        await db.createMagicLink(input.email, token, expiresAt);

        const loginUrl = `${input.origin}/verify?token=${token}`;

        // Look up client name for the email
        const clientRecord = await db.getClientByEmail(input.email);
        const firstName = clientRecord?.name?.split(" ")[0] || "there";

        // Send the magic link via GHL email (fires async, doesn't block response)
        ghlSendMagicLinkEmail({ email: input.email, firstName, loginUrl })
          .catch((e) => console.error("[GHL] Magic link email failed:", e));

        // Also notify owner
        await notifyOwner({
          title: `Magic link sent to ${input.email}`,
          content: `Login link sent via GHL email (expires in 24h):\n${loginUrl}`,
        });

        return { success: true, loginUrl, token };
      }),

    // Verify a magic link token and create a session
    verify: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const link = await db.getMagicLinkByToken(input.token);

        if (!link) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired link." });
        }

        if (link.expiresAt < Date.now()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This link has expired. Request a new one." });
        }

        // Mark as used
        await db.markMagicLinkUsed(input.token);

        // Find or create user + client
        const existingClient = await db.getClientByEmail(link.email);
        let userId: number;

        if (existingClient) {
          userId = existingClient.userId;
        } else {
          // Create a new user with a magic-link openId
          const openId = `magic_${nanoid(16)}`;
          await db.upsertUser({
            openId,
            email: link.email,
            loginMethod: "magic_link",
            lastSignedIn: new Date(),
          });
          const user = await db.getUserByOpenId(openId);
          if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user." });
          userId = user.id;

          // Create client profile
          await db.createClient({
            userId: user.id,
            name: link.email.split("@")[0],
            email: link.email,
            program: "rebuild",
            startDate: new Date(),
          });
        }

        // Get user for session token
        const user = await db.getUserByOpenId(
          existingClient
            ? (await db.getUserByOpenId(""))?.openId || ""
            : `magic_${nanoid(16)}`
        );

        // Find user by ID instead
        const dbInstance = await db.getDb();
        if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const userResult = await dbInstance.select().from(users).where(eq(users.id, userId)).limit(1);
        const foundUser = userResult[0];

        if (!foundUser) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "User not found." });

        // Create session token
        const sessionToken = await sdk.createSessionToken(foundUser.openId, { name: foundUser.name || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

        return { success: true, name: foundUser.name || link.email.split("@")[0] };
      }),
  }),

  // ==================== CLIENT PROCEDURES ====================
  clientProfile: router({
    // Get current client's profile
    me: protectedProcedure.query(async ({ ctx }) => {
      const client = await db.getClientByUserId(ctx.user.id);
      return client || null;
    }),

    // Update client profile
    update: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        ageBracket: z.number().optional(),
        program: z.enum(["rebuild", "restart", "perform"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientByUserId(ctx.user.id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client profile not found." });
        await db.updateClient(client.id, input);
        return { success: true };
      }),
  }),

  // ==================== SESSION / SCAN PROCEDURES ====================
  scan: router({
    // Save a new scan session
    save: protectedProcedure
      .input(z.object({
        date: z.string(),
        week: z.number(),
        checkpoint: z.string(),
        checkpointId: z.string(),
        isBaseline: z.boolean(),
        results: z.array(z.object({
          key: z.string(),
          vals: z.record(z.string(), z.number()),
        })),
        note: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientByUserId(ctx.user.id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client profile not found." });

        const sessionId = await db.createSession({
          clientId: client.id,
          date: new Date(input.date),
          week: input.week,
          checkpoint: input.checkpoint,
          checkpointId: input.checkpointId,
          isBaseline: input.isBaseline,
          results: input.results,
          note: input.note,
        });

        // Notify Coach Nick
        await notifyOwner({
          title: `New Scan: ${client.name} — ${input.checkpoint}`,
          content: `${client.name} (${client.program}) completed their ${input.checkpoint} scan at week ${input.week}. ${input.isBaseline ? "This is their baseline." : ""}`,
        }).catch(() => {});

        // Push to GHL CRM via MCP connector
        if (client.email) {
          const scanTags = ["scan-complete", `program-${client.program}`];
          if (input.isBaseline) scanTags.push("baseline-complete");
          ghlUpsertAndTag({
            email: client.email,
            firstName: client.name.split(" ")[0],
            lastName: client.name.split(" ").slice(1).join(" ") || undefined,
            source: "chain-check-paid",
            tags: scanTags,
          }).catch((e) => console.error("[GHL] Paid scan upsert failed:", e));
        }

        return { success: true, sessionId };
      }),

    // Submit client feedback for a session
    submitFeedback: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        feedback: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientByUserId(ctx.user.id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });

        await db.updateSession(input.sessionId, { clientFeedback: input.feedback });

        // Create webhook log for GHL
        const session = await db.getSessionById(input.sessionId);
        if (session) {
          const payload = {
            clientName: client.name,
            email: client.email,
            program: client.program,
            checkpoint: session.checkpoint,
            week: session.week,
            feedback: input.feedback,
            results: session.results,
            note: session.note,
            date: session.date,
          };
          await db.createWebhookLog(input.sessionId, payload);
        }

        // Notify Coach Nick
        await notifyOwner({
          title: `Client Feedback: ${client.name}`,
          content: `${client.name} sent feedback after their ${session?.checkpoint || ""} scan:\n\n${input.feedback}`,
        }).catch(() => {});

        // Push to GHL CRM via MCP connector
        if (client.email) {
          ghlUpsertAndTag({
            email: client.email,
            firstName: client.name.split(" ")[0],
            source: "chain-check-feedback",
            tags: ["scan-feedback-received"],
          }).catch((e) => console.error("[GHL] Feedback upsert failed:", e));
        }

        return { success: true };
      }),

    // Get all sessions for current client
    mySessions: protectedProcedure.query(async ({ ctx }) => {
      const client = await db.getClientByUserId(ctx.user.id);
      if (!client) return [];
      return db.getSessionsByClientId(client.id);
    }),

    // Get a single session by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getSessionById(input.id);
      }),

    // Generate PDF HTML for a session
    getPdf: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        const client = await db.getClientById(session.clientId);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });

        const html = generatePdfHtml({
          clientName: client.name,
          program: client.program,
          checkpoint: session.checkpoint,
          week: session.week,
          date: session.date.toISOString(),
          results: session.results as any[],
          note: session.note || "",
        });

        return { html };
      }),
  }),

  // ==================== ADMIN / COACH PROCEDURES ====================
  admin: router({
    // Get all clients with their latest scan status
    clients: adminProcedure.query(async () => {
      const allClients = await db.getAllClients();
      const clientsWithStatus = await Promise.all(
        allClients.map(async (client) => {
          const latestSession = await db.getLatestSessionForClient(client.id);
          return {
            ...client,
            latestSession: latestSession || null,
          };
        })
      );
      return clientsWithStatus;
    }),

    // Get all sessions for a specific client (coach view)
    clientSessions: adminProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getSessionsByClientId(input.clientId);
      }),

    // Get a specific client's details
    clientDetail: adminProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getClientById(input.clientId);
      }),

    // Create a new client (admin adds them)
    createClient: adminProcedure
      .input(z.object({
        name: z.string(),
        email: z.string().email(),
        program: z.enum(["rebuild", "restart", "perform"]),
        startDate: z.string(),
        ageBracket: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        // Create user account for client
        const openId = `magic_${nanoid(16)}`;
        await db.upsertUser({
          openId,
          name: input.name,
          email: input.email,
          loginMethod: "magic_link",
          lastSignedIn: new Date(),
        });
        const user = await db.getUserByOpenId(openId);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const clientId = await db.createClient({
          userId: user.id,
          name: input.name,
          email: input.email,
          program: input.program,
          startDate: new Date(input.startDate),
          ageBracket: input.ageBracket || 30,
        });

        return { success: true, clientId };
      }),

    // Trigger GHL webhook manually
    triggerWebhook: adminProcedure
      .input(z.object({
        clientId: z.number(),
        tag: z.string().optional(),
        action: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });

        // Create a webhook log entry for GHL trigger
        const payload = {
          type: "manual_trigger",
          clientName: client.name,
          email: client.email,
          program: client.program,
          tag: input.tag || "",
          action: input.action || "tag_applied",
          triggeredAt: new Date().toISOString(),
        };

        // In production, this would fire to the GHL webhook URL
        // For now, log it and notify
        await notifyOwner({
          title: `GHL Trigger: ${client.name}`,
          content: `Manual GHL trigger for ${client.name}. Tag: ${input.tag || "none"}. Action: ${input.action || "tag_applied"}.`,
        }).catch(() => {});

        return { success: true, payload };
      }),

        // Update client details (admin)
    updateClient: adminProcedure
      .input(z.object({
        clientId: z.number(),
        name: z.string().optional(),
        program: z.enum(["rebuild", "restart", "perform"]).optional(),
        ageBracket: z.number().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { clientId, ...data } = input;
        await db.updateClient(clientId, data);
        return { success: true };
      }),
  }),

  // ==================== FREE CHAIN CHECK FUNNEL ====================
  freeChainCheck: router({
    submit: publicProcedure
      .input(z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        quizResult: z.enum(["rebuild", "restart"] as [string, ...string[]]),
        scanData: z.record(z.string(), z.any()),
      }))
      .mutation(async ({ input }) => {
        // Store in DB
        await db.createFreeScanSubmission({
          ...input,
          quizResult: input.quizResult as "rebuild" | "restart",
        });

        // Notify owner
        await notifyOwner({
          title: `Free Chain Check: ${input.firstName} (${input.email})`,
          content: `Quiz result: ${input.quizResult}\n\nScan data: ${JSON.stringify(input.scanData, null, 2)}`,
        });

        // Push to GHL CRM via MCP connector
        ghlUpsertAndTag({
          email: input.email,
          firstName: input.firstName,
          source: "chain-check-free-scan",
          tags: ["free-chain-check", `quiz-${input.quizResult}`],
        }).catch((e) => console.error("[GHL] Free scan upsert failed:", e));

        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
