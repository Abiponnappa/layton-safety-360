# Layton Safety 360

Custom, browser-based competition MVP built from the validated analytical tables.

## Run locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Rebuild analytical data

The source CSV files are retained in `data/raw`. To rebuild the browser dataset after a source-data change, run:

```bash
python3 scripts/rebuild_quality_adjusted_data.py
python3 scripts/build_data.py
python3 scripts/validate_data.py
```

The first script applies the documented competition data-quality rules without changing the raw files.

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

## Record interpretation

- Safety Issues and Good Catches represent successful hazard detection before injury or work stoppage; their reporting volume is not treated as a negative safety signal.
- Incidents are independent injury or work-stoppage events. The app compares record types by project, period, or hazard category but does not link an Issue or Good Catch to a later incident.
- Rate denominators exclude the documented weekend rows with zero regular hours; the raw source files remain unchanged in `data/raw`.
- Open or In Progress issues on completed projects are treated as closed, consistent with the competition clarification.
- Issue due dates and `OVERDUE_FLAG` are not used as organizational compliance measures or prioritization signals.
- Follow-through measures distinguish active unresolved Safety Issues and Good Catch follow-ups still open.

## Leadership decision logic

See [deep_analysis_methodology.md](deep_analysis_methodology.md) for the exposure-adjusted analysis approach, transparent prioritization logic, peer benchmark method, and limitations.

Safety 360 ranks projects using observed portfolio signals and selects a distinct action playbook:

- Serious outcome: fall, struck-by, or other serious-injury control verification.
- Active control review: active unresolved Safety Issues and Good Catch follow-up verification.
- Control completion gap: Daily PTP and Focus Walk recovery.
- Overtime exposure: fatigue-aware staffing, sequence, and supervision review.
- Elevated rate: targeted work-area and prevention-control review.
- First 90 Days readiness: review early PTP, Focus Walk, and injury-outcome signals using the provided project start date.
- Potential leading-control profile: identify a project with stronger preventive indicators, then validate field routines before scaling any practice.

Each recommendation names the evidence, accountable role, and verification condition. It is decision support based on observed relationships; it does not claim causation or predict future incidents.

## Validation

Run `python3 scripts/validate_data.py` to reconcile the project summary, monthly records, incident classifications, and browser payload before submission. See [DATA_VALIDATION.md](DATA_VALIDATION.md) for the checks and latest validation scope.
