import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockService } = vi.hoisted(() => ({
  mockService: {
    preflight: vi.fn(),
    start: vi.fn(),
    getJob: vi.fn(),
    cutover: vi.fn(),
    rollback: vi.fn(),
  },
}));

vi.mock("../server/middleware/auth.js", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../server/services/admin-migration.js", () => ({
  adminMigrationService: mockService,
}));

import adminMigrationRouter from "../server/routes/admin-migration";

const app = express();
app.use(express.json());
app.use("/api/admin/migration", adminMigrationRouter);

describe("Admin Migration Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /preflight returns preflight data", async () => {
    mockService.preflight.mockResolvedValue({ ok: true, checks: [], context: { source: { configured: true, maskedUrl: "postgres://x", sslEnabled: false }, target: { configured: true, maskedUrl: "postgres://y", sslEnabled: false }, migrationsFolder: "/app/migrations" } });
    const res = await request(app).post("/api/admin/migration/preflight");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /start validates request", async () => {
    const res = await request(app).post("/api/admin/migration/start").send({});
    expect(res.status).toBe(400);
  });

  it("POST /start returns jobId on success", async () => {
    mockService.start.mockReturnValue({ ok: true, jobId: "job-1" });
    const res = await request(app)
      .post("/api/admin/migration/start")
      .send({ mode: "full", confirmText: "MIGRATE NOW" });
    expect(res.status).toBe(200);
    expect(res.body.jobId).toBe("job-1");
  });

  it("GET /jobs/:jobId returns 404 when missing", async () => {
    mockService.getJob.mockReturnValue(null);
    const res = await request(app).get("/api/admin/migration/jobs/missing");
    expect(res.status).toBe(404);
  });

  it("POST /cutover validates request", async () => {
    const res = await request(app).post("/api/admin/migration/cutover").send({});
    expect(res.status).toBe(400);
  });

  it("POST /rollback validates request", async () => {
    const res = await request(app).post("/api/admin/migration/rollback").send({});
    expect(res.status).toBe(400);
  });
});

