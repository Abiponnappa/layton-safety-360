"""Build browser-ready data from the validated analytical tables."""
import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
data = ROOT / "data"
projects = pd.read_csv(data / "project_summary.csv")
monthly = pd.read_csv(data / "project_monthly.csv")
jobs = pd.read_csv(data / "jobs.csv", encoding="utf-8-sig")
incidents = pd.read_csv(data / "safety_incidents.csv", encoding="utf-8-sig")

project_fields = ["job_id","project_type","state","contract_size_band","project_status","total_hours","quality_excluded_rows","quality_excluded_hours","recordable_incidents","lta_incidents","recordable_incident_rate","lta_rate","daily_ptp_compliance","weekly_focus_walk_compliance","active_unresolved_safety_issues","good_catches","good_catches_requiring_follow_up","good_catch_follow_ups_open","overtime_share","first_90_worked_days","first_90_total_hours","first_90_ptp_compliance","first_90_focus_walk_compliance","first_90_recordable_incidents","first_90_lta_incidents","first_90_recordable_incident_rate"]
monthly_fields = ["job_id","month_start","state","project_type","total_hours","recordable_incidents","lta_incidents","daily_ptp_compliance","recordable_incident_rate","lta_rate"]
incidents = incidents.merge(jobs[["JOB_ID","STATE","PROJECT_TYPE"]], on="JOB_ID", how="left")
deep_files = [
    "condition_overtime_profile",
    "condition_daily_ptp_profile",
    "condition_weekly_focus_walk_profile",
    "condition_weather_profile",
    "condition_work_activity_profile",
    "proactive_incident_theme_crosswalk",
    "issue_root_cause_profile",
]
payload = {
    "projects": projects[project_fields].to_dict(orient="records"),
    "monthly": monthly[monthly_fields].to_dict(orient="records"),
    "incidents": incidents[["JOB_ID","STATE","PROJECT_TYPE","INCIDENT_DATE","INCIDENT_CLASSIFICATION","OSHA_HAZARD_CATEGORY","HAZARD_SUBCATEGORY","BODY_PART_INJURED"]].to_dict(orient="records"),
    "deep": {name: pd.read_csv(data / f"{name}.csv").to_dict(orient="records") for name in deep_files},
    "quality": json.loads((data / "analysis_quality_metadata.json").read_text(encoding="utf-8")),
}
(data / "app_data.json").write_text(json.dumps(payload), encoding="utf-8")
