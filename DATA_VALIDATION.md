# Data Validation Summary

Run `python3 scripts/validate_data.py` before final submission. The script validates the analytical tables used by Safety 360 and the browser-ready payload.

## Latest validation scope

- 40 projects
- 652 project-month records
- 123 incident records
- 10,136,134.1 quality-adjusted worked hours
- 47 recordable incidents: 13 REC, 10 RECR, and 24 LTAs
- Portfolio recordable rate: 0.927 per 200,000 quality-adjusted worked hours
- Portfolio LTA rate: 0.474 per 200,000 quality-adjusted worked hours

## Checks performed

1. Project IDs reconcile between project summary, monthly records, and browser payload.
2. Monthly worked hours, recordable counts, and LTA counts reconcile to project totals.
3. Recordable and LTA rates reconcile to their 200,000-hour formulas using quality-adjusted exposure.
4. Project recordable and LTA counts reconcile to the incident classifications.
5. Weekend zero-regular-hour records are excluded from rate denominators and reconcile to the quality-exclusion fields.
6. Completed-project Open/In Progress issues are excluded from active unresolved-control counts.
7. Dashboard payload fields used for follow-through accountability and First 90 Days readiness reconcile to the validated project summary.

## Record interpretation safeguard

Safety Issues and Good Catches are successful detection records; incidents are independent injury or work-stoppage outcomes. Completed-project Open/In Progress issues are treated as closed. Synthetic issue due dates and the `OVERDUE_FLAG` are not used as organizational compliance measures or action-prioritization signals.
