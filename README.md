# Layton Safety 360

Custom, browser-based competition MVP built from the validated analytical tables.

## Run locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy

Upload this folder to a GitHub repository and import it into Vercel. The app is a client-side interactive web app; no Python server is required for viewers.

## Scope

- The app opens with a static leadership Home image and an Enter Safety 360 path into the analytical workspace.
- Data and recommendations update for state and project selections.
- Safety Intelligence recomputes the trend, overtime comparison, state health, and risk/control visuals for the selected scope.
- Safety Actions are transparent rules based on selected portfolio evidence.
- Action Reports are editable Safety 360 drafts: leadership can revise the action, recipient, due date, closure verification, and message before routing.
- Field Capture is a working in-browser intake and supervisor-review workflow for the MVP. Reports can be edited or deleted before supervisor review. Production deployment would connect it to approved Layton systems and persistent storage.
- The Home background is illustrative prototype imagery. It is not Layton project imagery and contains no safety data.

## Leadership decision logic

See [deep_analysis_methodology.md](deep_analysis_methodology.md) for the exposure-adjusted analysis approach, transparent prioritization logic, peer benchmark method, and limitations.

Safety 360 ranks projects using observed portfolio signals and selects a distinct action playbook:

- Serious outcome: fall, struck-by, or other serious-injury control verification.
- Closure backlog: overdue-issue and Good Catch follow-up closure sprint.
- Control completion gap: Daily PTP and Focus Walk recovery.
- Overtime exposure: fatigue-aware staffing, sequence, and supervision review.
- Elevated rate: targeted work-area and prevention-control review.
- Potential leading-control profile: identify a project with stronger preventive indicators, then validate field routines before scaling any practice.

Each recommendation names the evidence, accountable role, and verification condition. It is decision support based on observed relationships; it does not claim causation or predict future incidents.
