# Admin Data Migration & Safe DB Cutover — Page Design

## Global Styles (desktop-first)
- Layout system: CSS Grid for page regions + Flexbox for inline controls.
- Max content width: 1200px; center aligned; 24px gutters.
- Color tokens:
  - Background: #0B1220 (app shell) / #0F172A (panels)
  - Text: #E5E7EB; Muted: #94A3B8
  - Primary: #3B82F6 (buttons/links)
  - Danger: #EF4444 (destructive actions)
  - Warning: #F59E0B (risk banners)
  - Success: #22C55E
- Typography:
  - H1 24/32, H2 18/26, body 14/20, monospace for logs.
- Buttons:
  - Primary / Secondary / Danger variants; disabled state clearly muted; hover uses +6% brightness.
- Links: underlined on hover only; open external docs in new tab.

## Page: Admin Sign-in
### Meta Information
- Title: “Admin Sign-in”
- Description: “Authenticate to access administrative tools.”

### Page Structure
- Centered card layout (single column).

### Sections & Components
1. Header
   - App logo + “Admin Console”.
2. Sign-in Card
   - Primary sign-in method (existing SSO button or email/password form).
   - Error region (inline, persistent until dismissed).
3. Security Note
   - Short note: “Admin actions are audited.”

### Responsive behavior
- On <768px: card uses full width with 16px padding.

---

## Page: Migration & Cutover
### Meta Information
- Title: “Migration & Cutover”
- Description: “Run data migration and safely switch the app database connection.”
- Open Graph: title + description, no sensitive environment identifiers.

### Page Structure
- Two-column dashboard grid (desktop):
  - Left (8/12): workflow + progress
  - Right (4/12): safety controls + system status
- Mobile/tablet: collapses to a single stacked column; right column moves below.

### Sections & Components
1. Top Bar
   - Page title + environment badge (e.g., “Production” / “Staging”).
   - “Last run” summary chip (state + timestamp).

2. Critical Warning Banner (always visible)
   - Yellow warning panel: “This operation can cause downtime. Proceed only during a planned window.”
   - Link: “Runbook / checklist” (optional).

3. Connection Context (read-only)
   - Card with two rows:
     - Source: Old DB identifier (name/host masked) + “Connected/Not connected”.
     - Target: Current DB identifier (name/host masked) + “Connected/Not connected”.
   - No credentials displayed.

4. Preflight Checklist
   - Button: “Run Preflight”.
   - Checklist items with status pills (Pass/Fail/Skipped) and expandable error details.
   - Hard block: disable “Start Migration” until preflight passes.

5. Migration Control Panel
   - Mode selector: Full / Incremental (radio buttons).
   - Primary CTA: “Start Migration”.
   - Confirmation modal (blocking):
     - Requires typing exact phrase (e.g., “MIGRATE NOW”).
     - Shows what will happen next (high level).

6. Progress & Timeline
   - Stepper with phases: Preparing → Copying → Incremental Sync → Validating → Ready for Cutover → Cutover → Done.
   - Progress bar + counters table (key tables/records migrated).
   - Status banner for failure with “Retry / Resume” (only if supported).

7. Logs Panel
   - Scrollable console (monospace) with level filters.
   - Auto-follow toggle; “Copy logs” button.

8. Validation Results
   - Summary: Pass/Fail.
   - If failed: list mismatched entities + recommended action (re-run incremental sync / investigate).

9. Safe Cutover (right column, danger zone)
   - Card styled with subtle red border.
   - Cutover prerequisites list (all must be green):
     - Migration succeeded
     - Validation passed
     - Admin confirms downtime window
   - Button: “Enter Maintenance / Read-only Mode” (toggle) + status indicator.
   - Button (Danger): “Cut Over Now”
     - Confirmation modal requires typing phrase (e.g., “CUTOVER”).
     - Shows exact cutover sequence in bullets and estimated impact.

10. Rollback (right column, danger zone)
   - Button (Danger outline): “Rollback to Previous DB”
   - Requires reason text + confirmation phrase.

11. Audit Footer
   - Small text: “All actions are logged with your admin identity and timestamp.”

### Interaction & state guidelines
- All destructive actions require:
  - explicit typed confirmation
  - disabled state until prerequisites met
  - server-returned operation ID for traceability
- Polling strategy:
  - Job status: 2–5s while running; stop on terminal state.
  - Logs: append-only; virtualized rendering for large output.

### Accessibility
- Full keyboard navigation (tab order: left-to-right, top-to-bottom).
- Status changes announced via ARIA live region (job phase/state).
- Color never the only indicator: include icons + text labels for pass/fail.