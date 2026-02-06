import { dbUrl } from "../db.js";
import { DatabaseStorage } from "./database.js";
import { MemStorage } from "./memory.js";

export * from "./types.js";
export * from "./database.js";
export * from "./memory.js";

export const storage = dbUrl ? new DatabaseStorage() : new MemStorage();
