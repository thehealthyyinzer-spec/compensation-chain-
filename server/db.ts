import { eq, desc, and, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, clients, magicLinks, sessions, webhookLogs, freeScanSubmissions, type InsertClient, type InsertSession, type InsertFreeScanSubmission } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== CLIENT HELPERS ====================

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(data);
  return result[0].insertId;
}

export async function getClientByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getClientByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllClients() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).where(eq(clients.active, true));
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set(data).where(eq(clients.id, id));
}

// ==================== MAGIC LINK HELPERS ====================

export async function createMagicLink(email: string, token: string, expiresAt: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(magicLinks).values({ email, token, expiresAt });
}

export async function getMagicLinkByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(magicLinks)
    .where(and(eq(magicLinks.token, token), eq(magicLinks.used, false)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function markMagicLinkUsed(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(magicLinks).set({ used: true }).where(eq(magicLinks.token, token));
}

// ==================== SESSION HELPERS ====================

export async function createSession(data: InsertSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(sessions).values(data);
  return result[0].insertId;
}

export async function getSessionsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions)
    .where(eq(sessions.clientId, clientId))
    .orderBy(desc(sessions.date));
}

export async function getSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSessionByIdForClient(id: number, clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.clientId, clientId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateSession(id: number, data: Partial<InsertSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sessions).set(data).where(eq(sessions.id, id));
}

export async function updateSessionForClient(id: number, clientId: number, data: Partial<InsertSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sessions).set(data).where(and(eq(sessions.id, id), eq(sessions.clientId, clientId)));
}

export async function getLatestSessionForClient(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sessions)
    .where(eq(sessions.clientId, clientId))
    .orderBy(desc(sessions.date))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== WEBHOOK HELPERS ====================

export async function createWebhookLog(sessionId: number, payload: unknown) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(webhookLogs).values({ sessionId, payload });
}

export async function getPendingWebhooks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webhookLogs)
    .where(and(eq(webhookLogs.status, "pending"), lt(webhookLogs.attempts, 3)));
}

export async function updateWebhookLog(id: number, data: { status: "sent" | "failed"; attempts: number; responseCode?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(webhookLogs).set({ ...data, lastAttemptAt: new Date() }).where(eq(webhookLogs.id, id));
}

export async function createFreeScanSubmission(data: { email: string; firstName: string; quizResult: "rebuild" | "restart"; scanData: Record<string, any> }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(freeScanSubmissions).values({
    email: data.email,
    firstName: data.firstName,
    quizResult: data.quizResult,
    scanData: data.scanData,
  });
}

export async function getAllFreeScanSubmissions() {
  const db = await getDb();
  if (!db) return [];
  const { desc } = await import("drizzle-orm");
  return db.select().from(freeScanSubmissions).orderBy(desc(freeScanSubmissions.createdAt)).limit(200);
}

export async function deleteClient(clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { eq } = await import("drizzle-orm");
  // Delete sessions first (foreign key), then client record
  await db.delete(sessions).where(eq(sessions.clientId, clientId));
  await db.delete(clients).where(eq(clients.id, clientId));
}
