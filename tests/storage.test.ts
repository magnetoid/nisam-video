import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseStorage } from '../server/storage';
import { db } from '../server/db';

// Mock the db module
vi.mock('../server/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dbUrl: 'postgres://mock',
}));

// Mock cache to prevent errors
vi.mock('../server/cache', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    invalidatePattern: vi.fn(),
  },
}));

describe('DatabaseStorage', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  describe('getChannel', () => {
    it('should return a channel if found', async () => {
      const mockChannel = { id: '1', name: 'Test Channel' };
      // Mock db.select().from().where() chain
      const whereMock = vi.fn().mockResolvedValue([mockChannel]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await storage.getChannel('1');
      expect(result).toEqual(mockChannel);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return undefined if not found', async () => {
      const whereMock = vi.fn().mockResolvedValue([]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await storage.getChannel('1');
      expect(result).toBeUndefined();
    });
  });

  describe('createChannel', () => {
    it('should create and return a channel', async () => {
        const mockChannel = { id: '1', name: 'New Channel' };
        const insertData = { name: 'New Channel', platform: 'youtube', channelId: '123', url: 'http' };
        
        const returningMock = vi.fn().mockResolvedValue([mockChannel]);
        const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
        (db.insert as any).mockReturnValue({ values: valuesMock });

        const result = await storage.createChannel(insertData as any);
        expect(result).toEqual(mockChannel);
    });
  });
});
