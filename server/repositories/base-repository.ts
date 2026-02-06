import { eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { DatabaseError } from '../errors/custom-errors.js';

/**
 * Base repository interface defining common CRUD operations
 * @template T - The entity type
 * @template I - The insert type
 * @template U - The update type
 */
export interface IBaseRepository<T, I, U = Partial<I>> {
  findById(id: string): Promise<T | null>;
  findAll(limit?: number, offset?: number): Promise<T[]>;
  create(data: I): Promise<T>;
  update(id: string, data: U): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}

/**
 * Base repository class providing common database operations
 * @template T - The entity type
 * @template I - The insert type
 * @template U - The update type
 */
export abstract class BaseRepository<T, I, U = Partial<I>> implements IBaseRepository<T, I, U> {
  protected abstract table: any;
  protected abstract entityName: string;

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const result = await db.select().from(this.table).where(eq(this.table.id, id));
      return result[0] as T || null;
    } catch (error) {
      throw new DatabaseError(`Failed to find ${this.entityName} by ID`, { 
        entityName: this.entityName, 
        id, 
        cause: error 
      });
    }
  }

  /**
   * Find all entities with optional pagination
   */
  async findAll(limit?: number, offset?: number): Promise<T[]> {
    try {
      let query = db.select().from(this.table);
      
      if (limit) {
        query = query.limit(limit);
      }
      
      if (offset) {
        query = query.offset(offset);
      }
      
      return await query as T[];
    } catch (error) {
      throw new DatabaseError(`Failed to fetch all ${this.entityName}s`, { 
        entityName: this.entityName,
        cause: error 
      });
    }
  }

  /**
   * Create a new entity
   */
  async create(data: I): Promise<T> {
    try {
      const [result] = await db.insert(this.table).values(data).returning();
      return result as T;
    } catch (error) {
      throw new DatabaseError(`Failed to create ${this.entityName}`, { 
        entityName: this.entityName,
        data,
        cause: error 
      });
    }
  }

  /**
   * Update an existing entity
   */
  async update(id: string, data: U): Promise<T | null> {
    try {
      const updateData: Record<string, any> = { ...(data as any) };
      if (this.table?.updatedAt) {
        updateData.updatedAt = new Date();
      }
      const [result] = await db
        .update(this.table)
        .set(updateData)
        .where(eq(this.table.id, id))
        .returning();
      
      return result as T || null;
    } catch (error) {
      throw new DatabaseError(`Failed to update ${this.entityName}`, { 
        entityName: this.entityName,
        id,
        data,
        cause: error 
      });
    }
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await db.delete(this.table).where(eq(this.table.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      throw new DatabaseError(`Failed to delete ${this.entityName}`, { 
        entityName: this.entityName,
        id,
        cause: error 
      });
    }
  }

  /**
   * Count total entities
   */
  async count(): Promise<number> {
    try {
      const result = await db.select({ count: sql`count(*)` }).from(this.table);
      return Number(result[0]?.count) || 0;
    } catch (error) {
      throw new DatabaseError(`Failed to count ${this.entityName}s`, { 
        entityName: this.entityName,
        cause: error 
      });
    }
  }

  /**
   * Execute a transaction with proper error handling
   */
  protected async executeTransaction<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new DatabaseError(`Transaction failed for ${this.entityName}`, { 
        entityName: this.entityName,
        cause: error 
      });
    }
  }
}
