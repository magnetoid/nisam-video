import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db.js";
import { systemRules, systemSkills, insertSystemRuleSchema, insertSystemSkillSchema } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";

export const systemRulesSkillsRouter = Router();

// Rules endpoints
systemRulesSkillsRouter.get("/rules", requireAuth, async (req, res) => {
  try {
    const rules = await db.select().from(systemRules).orderBy(systemRules.createdAt);
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

systemRulesSkillsRouter.post("/rules", requireAuth, async (req, res) => {
  try {
    const parsed = insertSystemRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: fromZodError(parsed.error).message });
    }
    const [rule] = await db.insert(systemRules).values(parsed.data).returning();
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: "Failed to create rule" });
  }
});

systemRulesSkillsRouter.put("/rules/:id", requireAuth, async (req, res) => {
  try {
    const parsed = insertSystemRuleSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: fromZodError(parsed.error).message });
    }
    const [rule] = await db
      .update(systemRules)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(systemRules.id, req.params.id))
      .returning();
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: "Failed to update rule" });
  }
});

systemRulesSkillsRouter.delete("/rules/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(systemRules).where(eq(systemRules.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

// Skills endpoints
systemRulesSkillsRouter.get("/skills", requireAuth, async (req, res) => {
  try {
    const skills = await db.select().from(systemSkills).orderBy(systemSkills.createdAt);
    res.json(skills);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch skills" });
  }
});

systemRulesSkillsRouter.post("/skills", requireAuth, async (req, res) => {
  try {
    const parsed = insertSystemSkillSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: fromZodError(parsed.error).message });
    }
    const [skill] = await db.insert(systemSkills).values(parsed.data).returning();
    res.json(skill);
  } catch (error) {
    res.status(500).json({ error: "Failed to create skill" });
  }
});

systemRulesSkillsRouter.put("/skills/:id", requireAuth, async (req, res) => {
  try {
    const parsed = insertSystemSkillSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: fromZodError(parsed.error).message });
    }
    const [skill] = await db
      .update(systemSkills)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(systemSkills.id, req.params.id))
      .returning();
    res.json(skill);
  } catch (error) {
    res.status(500).json({ error: "Failed to update skill" });
  }
});

systemRulesSkillsRouter.delete("/skills/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(systemSkills).where(eq(systemSkills.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete skill" });
  }
});
