-- Migration: Add automation workflows table for visual builder
CREATE TABLE IF NOT EXISTS "automation_workflows" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  flow JSONB NOT NULL DEFAULT '[]'::jsonb, -- Serialized nodes/edges
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_automation_workflows_active ON automation_workflows (is_active);
CREATE INDEX idx_automation_workflows_updated ON automation_workflows (updated_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_automation_workflows_updated_at BEFORE UPDATE
  ON automation_workflows FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
