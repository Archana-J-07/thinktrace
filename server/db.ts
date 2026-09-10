import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

import {
  InsertUser,
  users,
  projects,
  projectEvents,
  InsertProject,
  InsertProjectEvent,
} from "../drizzle/schema";

import { ENV } from "./_core/env";

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

/* -------------------- USER FUNCTIONS -------------------- */

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();

  if (!db) {
    console.warn("[Database] Database not available");
    return;
  }

  await db
    .insert(users)
    .values(user)
    .onDuplicateKeyUpdate({
      set: {
        name: user.name,
        email: user.email,
        loginMethod: user.loginMethod,
        updatedAt: new Date(),
      },
    });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();

  if (!db) {
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result[0];
}

/* -------------------- PROJECT FUNCTIONS -------------------- */

export async function createProject(
  project: InsertProject
): Promise<void> {
  const db = await getDb();

  if (!db) {
    console.warn("[Database] Database not available");
    return;
  }

  await db.insert(projects).values(project);
}

export async function getProjectById(projectId: string) {
  const db = await getDb();

  if (!db) {
    return null;
  }

  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.projectId, projectId))
    .limit(1);

  return result[0] ?? null;
}

export async function updateProject(
  projectId: string,
  data: Partial<InsertProject>
): Promise<void> {
  const db = await getDb();

  if (!db) {
    console.warn("[Database] Database not available");
    return;
  }

  await db
    .update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(projects.projectId, projectId));
}

export async function getAllProjects() {
  const db = await getDb();

  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(projects);
}

/* -------------------- PROJECT EVENT FUNCTIONS -------------------- */

export async function saveProjectEvent(
  event: InsertProjectEvent
): Promise<void> {
  const db = await getDb();

  if (!db) {
    console.warn("[Database] Database not available");
    return;
  }

  await db.insert(projectEvents).values(event);
}

export async function getProjectEvents(
  projectId: string
) {
  const db = await getDb();

  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(projectEvents)
    .where(eq(projectEvents.projectId, projectId));
}
