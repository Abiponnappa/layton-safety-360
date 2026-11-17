# Data Validation Summary

Run `python3 scripts/validate_data.py` before final submission. The script validates the analytical tables used by Safety 360 and the browser-ready payload.

## Latest validation scope

- 40 projects
- 652 project-month records
- 123 incident records
- 10,187,503.9 total worked hours
- 47 recordable incidents: 13 REC, 10 RECR, and 24 LTAs
- Portfolio recordable rate: 0.923 per 200,000 worked hours
- Portfolio LTA rate: 0.471 per 200,000 worked hours

## Checks performed

1. Project IDs reconcile between project summary, monthly records, and browser payload.
2. Monthly worked hours, recordable counts, and LTA counts reconcile to project totals.
3. Recordable and LTA rates reconcile to their 200,000-hour formulas.
4. Project recordable and LTA counts reconcile to the incident classifications.
5. Dashboard payload fields used for closure accountability reconcile to the validated project summary.

## Record interpretation safeguard

Safety Issues and Good Catches are successful detection records; incidents are independent injury or work-stoppage outcomes. The validation does not treat overdue issues as a subset of currently open/in-progress issues. These are intentionally reported as separate measures in the application.
