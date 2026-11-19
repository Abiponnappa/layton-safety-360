"""Rebuild Safety 360 analytical tables with documented competition data-quality rules.

Raw files remain unchanged in data/raw. The rate denominator excludes only
Saturday/Sunday journal rows with zero regular hours. Issue due dates and
OVERDUE_FLAG are intentionally not used as a leadership-performance measure.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"


def rate(count, hours):
    return count * 200000 / hours if hours else 0.0


def completion(submitted, expected):
    return submitted / expected if expected else 0.0


def profile(frame, group_column, label_column="group"):
    grouped = frame.groupby(group_column, dropna=False).agg(
        worked_days_or_weeks=("JOB_ID", "size"),
        total_hours=("analysis_hours", "sum"),
        recordable_incidents=("recordable_incidents", "sum"),
        lta_incidents=("lta_incidents", "sum"),
        issues_opened=("issues_opened", "sum"),
        good_catches=("good_catches", "sum"),
    ).reset_index().rename(columns={group_column: label_column})
    grouped["recordable_incident_rate"] = grouped.apply(lambda x: rate(x.recordable_incidents, x.total_hours), axis=1)
    grouped["lta_rate"] = grouped.apply(lambda x: rate(x.lta_incidents, x.total_hours), axis=1)
    grouped["issues_per_100k_hours"] = grouped.apply(lambda x: x.issues_opened * 100000 / x.total_hours if x.total_hours else 0, axis=1)
    grouped["good_catches_per_100k_hours"] = grouped.apply(lambda x: x.good_catches * 100000 / x.total_hours if x.total_hours else 0, axis=1)
    grouped["meets_100k_hour_comparison_threshold"] = (grouped.total_hours >= 100000).astype(int)
    return grouped


def summarize_rows(rows, meta, grain, period):
    total_hours = rows.analysis_hours.sum()
    result = {
        "job_id": meta.JOB_ID,
        grain: period,
        "project_type": meta.PROJECT_TYPE,
        "city": meta.CITY,
        "state": meta.STATE,
        "contract_size": meta.CONTRACT_SIZE,
        "contract_size_band": meta.CONTRACT_SIZE_BAND,
        "project_status": meta.PROJECT_STATUS,
        "worked_days": len(rows),
        "quality_excluded_rows": int(rows.weekend_overtime_only.sum()),
        "quality_excluded_hours": round(rows.loc[rows.weekend_overtime_only, "TOTAL_HOURS"].sum(), 3),
        "headcount": round(rows.HEADCOUNT.sum(), 3),
        "regular_hours": round(rows.REGULAR_HOURS.sum(), 3),
        "overtime_hours": round(rows.OVERTIME_HOURS.sum(), 3),
        "total_hours": round(total_hours, 3),
        "daily_ptp_expected": int(len(rows)),
        "daily_ptp_submitted": int(rows.daily_ptp_submitted.sum()),
        "daily_ptp_missed": int((1 - rows.daily_ptp_submitted).sum()),
    }
    for field in ["issues_opened", "high_or_critical_issues_opened", "good_catches", "high_or_critical_good_catches", "good_catches_requiring_follow_up", "incidents_total", "first_aid_incidents", "rec_incidents", "recr_incidents", "lta_incidents", "recordable_incidents"]:
        result[field] = int(rows[field].sum())
    result["overtime_share"] = round(result["overtime_hours"] / total_hours, 6) if total_hours else 0
    result["daily_ptp_compliance"] = round(completion(result["daily_ptp_submitted"], result["daily_ptp_expected"]), 6)
    result["recordable_incident_rate"] = round(rate(result["recordable_incidents"], total_hours), 6)
    result["lta_rate"] = round(rate(result["lta_incidents"], total_hours), 6)
    result["good_catches_per_100k_hours"] = round(result["good_catches"] * 100000 / total_hours, 6) if total_hours else 0
    result["issues_per_100k_hours"] = round(result["issues_opened"] * 100000 / total_hours, 6) if total_hours else 0
    return result


def main():
    jobs = pd.read_csv(RAW / "jobs.csv", encoding="utf-8-sig")
    journals = pd.read_csv(RAW / "daily_journals.csv", encoding="utf-8-sig")
    checklists = pd.read_csv(RAW / "checklists.csv", encoding="utf-8-sig")
    issues = pd.read_csv(RAW / "issues.csv", encoding="utf-8-sig")
    catches = pd.read_csv(RAW / "good_catches.csv", encoding="utf-8-sig")
    incidents = pd.read_csv(RAW / "safety_incidents.csv", encoding="utf-8-sig")

    journals["date"] = pd.to_datetime(journals.JOURNAL_DATE)
    journals["month_start"] = journals.date.dt.to_period("M").astype(str) + "-01"
    journals["week_start"] = (journals.date - pd.to_timedelta(journals.date.dt.weekday, unit="D")).dt.strftime("%Y-%m-%d")
    journals["weekend_overtime_only"] = (journals.date.dt.dayofweek >= 5) & (journals.REGULAR_HOURS == 0)
    journals["analysis_hours"] = journals.TOTAL_HOURS.where(~journals.weekend_overtime_only, 0.0)
    journals["daily_key"] = journals.JOB_ID + "|" + journals.date.dt.strftime("%Y-%m-%d")

    checklists["date"] = pd.to_datetime(checklists.CHECKLIST_DATE)
    checklists["daily_key"] = checklists.JOB_ID + "|" + checklists.date.dt.strftime("%Y-%m-%d")
    checklists["week_start"] = (checklists.date - pd.to_timedelta(checklists.date.dt.weekday, unit="D")).dt.strftime("%Y-%m-%d")
    daily_ptp = set(checklists.loc[checklists.CHECKLIST_TYPE.eq("Daily PTP"), "daily_key"])
    focus_walk = set((checklists.loc[checklists.CHECKLIST_TYPE.eq("Weekly Focus Walk"), "JOB_ID"] + "|" + checklists.loc[checklists.CHECKLIST_TYPE.eq("Weekly Focus Walk"), "week_start"]).tolist())
    journals["daily_ptp_submitted"] = journals.daily_key.isin(daily_ptp).astype(int)
    journals["focus_key"] = journals.JOB_ID + "|" + journals.week_start
    journals["weekly_focus_walk_submitted"] = journals.focus_key.isin(focus_walk).astype(int)

    issues["date"] = pd.to_datetime(issues.OPEN_DATE)
    catches["date"] = pd.to_datetime(catches.REPORT_DATE)
    incidents["date"] = pd.to_datetime(incidents.INCIDENT_DATE)
    for source, field in [(issues, "issues_opened"), (catches, "good_catches"), (incidents, "incidents_total")]:
        source["daily_key"] = source.JOB_ID + "|" + source.date.dt.strftime("%Y-%m-%d")
        count = source.groupby("daily_key").size()
        journals[field] = journals.daily_key.map(count).fillna(0).astype(int)
    issues["high_or_critical"] = issues.SEVERITY.isin(["High", "Critical"])
    catches["high_or_critical"] = catches.POTENTIAL_SEVERITY.isin(["High", "Critical"])
    journals["high_or_critical_issues_opened"] = journals.daily_key.map(issues.groupby("daily_key").high_or_critical.sum()).fillna(0).astype(int)
    journals["high_or_critical_good_catches"] = journals.daily_key.map(catches.groupby("daily_key").high_or_critical.sum()).fillna(0).astype(int)
    journals["good_catches_requiring_follow_up"] = journals.daily_key.map(catches.assign(required=catches.FOLLOW_UP_REQUIRED_FLAG.eq("Y")).groupby("daily_key").required.sum()).fillna(0).astype(int)
    for name, classification in [("first_aid_incidents", "First Aid"), ("rec_incidents", "REC"), ("recr_incidents", "RECR"), ("lta_incidents", "Lost Time Accident")]:
        journals[name] = journals.daily_key.map(incidents.loc[incidents.INCIDENT_CLASSIFICATION.eq(classification)].groupby("daily_key").size()).fillna(0).astype(int)
    journals["recordable_incidents"] = journals.rec_incidents + journals.recr_incidents + journals.lta_incidents

    journal = journals.merge(jobs, on="JOB_ID", how="left", validate="many_to_one")
    project_rows, monthly_rows = [], []
    issue_status = issues.merge(jobs[["JOB_ID", "PROJECT_STATUS"]], on="JOB_ID", how="left")
    issue_status["active_unresolved"] = issue_status.PROJECT_STATUS.ne("Completed") & issue_status.STATUS.isin(["Open", "In Progress"])
    catch_open = catches.loc[catches.FOLLOW_UP_STATUS.eq("Open")].groupby("JOB_ID").size()
    active_issue_open = issue_status.groupby("JOB_ID").active_unresolved.sum()

    for meta in jobs.itertuples(index=False):
        project = journal.loc[journal.JOB_ID.eq(meta.JOB_ID)].copy()
        summary = summarize_rows(project, meta, "analysis_period", "2024-01-01_to_2026-09-30")
        weeks = project.groupby("week_start").weekly_focus_walk_submitted.max()
        summary["weekly_focus_walk_expected"] = int(len(weeks))
        summary["weekly_focus_walk_submitted"] = int(weeks.sum())
        summary["weekly_focus_walk_missed"] = int(len(weeks) - weeks.sum())
        summary["weekly_focus_walk_compliance"] = round(completion(weeks.sum(), len(weeks)), 6)
        summary["active_unresolved_safety_issues"] = int(active_issue_open.get(meta.JOB_ID, 0))
        summary["good_catch_follow_ups_open"] = int(catch_open.get(meta.JOB_ID, 0))

        start = pd.Timestamp(meta.PROJECT_START_DATE)
        early = project.loc[(project.date >= start) & (project.date < start + pd.Timedelta(days=90))].copy()
        early_weeks = early.groupby("week_start").weekly_focus_walk_submitted.max()
        summary["first_90_worked_days"] = int(len(early))
        summary["first_90_total_hours"] = round(early.analysis_hours.sum(), 3)
        summary["first_90_quality_excluded_hours"] = round(early.loc[early.weekend_overtime_only, "TOTAL_HOURS"].sum(), 3)
        summary["first_90_ptp_compliance"] = round(completion(early.daily_ptp_submitted.sum(), len(early)), 6)
        summary["first_90_focus_walk_compliance"] = round(completion(early_weeks.sum(), len(early_weeks)), 6)
        summary["first_90_recordable_incidents"] = int(early.recordable_incidents.sum())
        summary["first_90_lta_incidents"] = int(early.lta_incidents.sum())
        summary["first_90_recordable_incident_rate"] = round(rate(summary["first_90_recordable_incidents"], summary["first_90_total_hours"]), 6)
        project_rows.append(summary)

        for month, month_rows in project.groupby("month_start"):
            monthly_rows.append(summarize_rows(month_rows, meta, "month_start", month))

    summary = pd.DataFrame(project_rows)
    monthly = pd.DataFrame(monthly_rows)
    summary.to_csv(DATA / "project_summary.csv", index=False)
    monthly.to_csv(DATA / "project_monthly.csv", index=False)

    # Profile tables use the same quality-adjusted exposure denominator.
    journal["overtime_band"] = pd.cut(journal.OVERTIME_HOURS / journal.TOTAL_HOURS, [-0.001, 0, .10, .20, 1], labels=["0% overtime", "Under 10%", "10–20%", ">20%"], include_lowest=True).astype(str)
    profile(journal, "overtime_band").to_csv(DATA / "condition_overtime_profile.csv", index=False)
    profile(journal.assign(group=journal.daily_ptp_submitted.map({1: "Submitted", 0: "Missed"})), "group").to_csv(DATA / "condition_daily_ptp_profile.csv", index=False)
    weekly_profile = journal.copy()
    weekly_profile["group"] = weekly_profile.weekly_focus_walk_submitted.map({1: "Submitted", 0: "Missed"})
    profile(weekly_profile, "group").to_csv(DATA / "condition_weekly_focus_walk_profile.csv", index=False)
    profile(journal, "WEATHER").to_csv(DATA / "condition_weather_profile.csv", index=False)
    profile(journal, "WORK_ACTIVITY").to_csv(DATA / "condition_work_activity_profile.csv", index=False)

    # Unchanged source-based reference tables, copied with explicit provenance.
    pd.crosstab(issues.HAZARD_CATEGORY, issues.ROOT_CAUSE).reset_index().to_csv(DATA / "issue_root_cause_profile.csv", index=False)
    pd.crosstab(catches.HAZARD_CATEGORY, catches.POTENTIAL_SEVERITY).reset_index().to_csv(DATA / "proactive_incident_theme_crosswalk.csv", index=False)
    jobs.to_csv(DATA / "jobs.csv", index=False)
    incidents.to_csv(DATA / "safety_incidents.csv", index=False)

    quality = {
        "synthetic_data": True,
        "analysis_period": "2024-01-01 to 2026-09-30",
        "weekend_overtime_only_rows_excluded_from_rate_denominators": int(journal.weekend_overtime_only.sum()),
        "weekend_overtime_only_hours_excluded_from_rate_denominators": round(journal.loc[journal.weekend_overtime_only, "TOTAL_HOURS"].sum(), 1),
        "completed_project_open_or_in_progress_issues_treated_closed": int((issue_status.PROJECT_STATUS.eq("Completed") & issue_status.STATUS.isin(["Open", "In Progress"])).sum()),
        "issue_due_dates_used_as_compliance_measure": False,
        "lta_lesson_number_used": False,
    }
    (DATA / "analysis_quality_metadata.json").write_text(json.dumps(quality, indent=2), encoding="utf-8")
    print("Quality-adjusted tables rebuilt")
    print(json.dumps(quality, indent=2))


if __name__ == "__main__":
    main()
