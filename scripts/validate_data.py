"""Validate analytical inputs and browser payload for the Safety 360 MVP.

Run from the application folder:
    python3 scripts/validate_data.py
"""
import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
EPSILON = 1e-5


def check(condition, message):
    if not condition:
        raise AssertionError(message)
    print(f"PASS  {message}")


projects = pd.read_csv(DATA / "project_summary.csv")
monthly = pd.read_csv(DATA / "project_monthly.csv")
incidents = pd.read_csv(DATA / "safety_incidents.csv", encoding="utf-8-sig")
payload = json.loads((DATA / "app_data.json").read_text(encoding="utf-8"))

check(projects["job_id"].is_unique, "project summary has one row per project")
check(set(projects["job_id"]) == set(monthly["job_id"]), "monthly and project tables contain the same projects")
check(len(payload["projects"]) == len(projects), "browser payload contains every project")
check({x["job_id"] for x in payload["projects"]} == set(projects["job_id"]), "browser payload project IDs match source")

summary = projects.set_index("job_id").sort_index()
monthly_totals = monthly.groupby("job_id")[["total_hours", "recordable_incidents", "lta_incidents"]].sum().sort_index()
for field in ["total_hours", "recordable_incidents", "lta_incidents"]:
    difference = (summary[field] - monthly_totals[field]).abs().max()
    check(difference < EPSILON, f"monthly {field} reconciles to project summary")

expected_recordable_rate = summary["recordable_incidents"] * 200000 / summary["total_hours"]
expected_lta_rate = summary["lta_incidents"] * 200000 / summary["total_hours"]
check((summary["recordable_incident_rate"] - expected_recordable_rate).abs().max() < EPSILON, "recordable rate uses 200,000-hour formula")
check((summary["lta_rate"] - expected_lta_rate).abs().max() < EPSILON, "LTA rate uses 200,000-hour formula")

recordable_classes = {"REC", "RECR", "Lost Time Accident"}
incident_recordables = incidents[incidents["INCIDENT_CLASSIFICATION"].isin(recordable_classes)].groupby("JOB_ID").size()
incident_ltas = incidents[incidents["INCIDENT_CLASSIFICATION"].eq("Lost Time Accident")].groupby("JOB_ID").size()
check((summary["recordable_incidents"] - incident_recordables.reindex(summary.index, fill_value=0)).abs().max() == 0, "project recordable counts reconcile to incident classifications")
check((summary["lta_incidents"] - incident_ltas.reindex(summary.index, fill_value=0)).abs().max() == 0, "project LTA counts reconcile to incident classifications")

payload_projects = pd.DataFrame(payload["projects"]).set_index("job_id").sort_index()
for field in ["total_hours", "recordable_incidents", "lta_incidents", "issues_marked_overdue", "issues_currently_open_or_in_progress", "good_catch_follow_ups_open"]:
    difference = (summary[field] - payload_projects[field]).abs().max()
    check(difference < EPSILON, f"browser payload {field} matches project summary")

print("\nValidation complete.")
print(f"Projects: {len(projects)} | Hours: {projects['total_hours'].sum():,.1f} | Recordables: {projects['recordable_incidents'].sum():.0f} | LTAs: {projects['lta_incidents'].sum():.0f}")
