import {
  mysqlTable,
  int,
  varchar,
  text,
  datetime,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  createdAt: datetime("createdAt").defaultNow().notNull(),
  updatedAt: datetime("updatedAt").defaultNow().notNull(),
});

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  projectId: varchar("projectId", { length: 64 }).notNull().unique(),
  userId: int("userId"),
  title: varchar("title", { length: 255 }).notNull(),
  originalIdea: text("originalIdea").notNull(),
  mode: varchar("mode", { length: 20 }).notNull().default("solo"),
  createdAt: datetime("createdAt").defaultNow().notNull(),
  updatedAt: datetime("updatedAt").defaultNow().notNull(),
});

export const projectEvents = mysqlTable("project_events", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull().unique(),
  projectId: varchar("projectId", { length: 64 }).notNull(),
  eventType: varchar("eventType", { length: 50 }).notNull(),
  author: varchar("author", { length: 50 }).notNull(),
  thought: text("thought").notNull(),
  timestamp: datetime("timestamp").notNull(),
  snapshot: json("snapshot"),
  createdAt: datetime("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export type ProjectEvent = typeof projectEvents.$inferSelect;
export type InsertProjectEvent = typeof projectEvents.$inferInsert;
