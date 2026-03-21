-- Audit logs table for tracking security-sensitive operations
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fingerprint" varchar NOT NULL,
  "action" text NOT NULL,
  "user_id" varchar,
  "username" varchar(200),
  "ip" varchar(100),
  "user_agent" varchar(1000),
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" USING btree ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_ip_idx" ON "audit_logs" USING btree ("ip");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");
