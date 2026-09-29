"""Plan the one-time Airtable -> Dataverse import of the LNI Production Schedule
(Expeditor) list. READ-ONLY: writes a plan + a review sheet; nothing touches
Dataverse until scripts/apply-airtable-import.ps1 -Apply runs the plan.

    python scripts/plan-airtable-import.py "<export.csv>" <bc_job_numbers.txt> <out_dir>

What it produces, per BC job number (Airtable rows are merged per job):
  - jobtrack: the crfdf_jobtrack fields (see scripts/create-jobtrack-table.ps1)
  - schedule: red date + production-complete override (Airtable "Mfg Target
    Modified") for crfdf_jobschedule - applied only where the app has none
  - include / complete / active: stepper department keys. Airtable "/" = the
    department is needed (included), "X" = done (completed); an "MFG - <dept>"
    Current Status marks that department active. "(Steel Copy)" / "(Paint Copy)"
    rows are Airtable's way of showing a job in two departments at once - they
    fold into the job as extra ACTIVE departments.

Department mapping (agreed with Alex, Sep 29 2026):
  Material Cut -> MC (new stepper dept; BC Substrate Cut/Prep)
  Metal -> MF, Paint Prep/Paint -> P, Assembly -> A
  Plex/Application + Vinyl Prod/Install/Patterns -> V (Vinyl)
  Routing Type "Routing Complete" -> R done; any other Routing Type -> R needed
"""
import csv, json, os, re, sys
from collections import Counter, defaultdict
from datetime import datetime

CSV_PATH, BC_JOBS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

DEPT_COLS = {
    "Material Cut": "MC",
    "Metal": "MF",
    "Paint Prep/Paint": "P",
    "Plex/Application": "V",
    "Vinyl Prod / Install/ Patterns": "V",
    "Assembly": "A",
}
# "MFG - <dept>" style statuses name the department the job is IN right now.
ACTIVE_BY_STATUS = {
    "MFG - Need Material Cut": "MC",
    "Steel MFG": "S",
    "MFG - Routing": "R",
    "MFG - Len Metal Fab": "MF", "MFG - Chris Metal Fab": "MF", "MFG - Terry Metal Fab": "MF",
    "MFG - Paint Prep / Paint": "P",
    "MFG - Vinyl Cut": "V", "MFG - Vinyl Application": "V", "MFG - Vinyl Install": "V",
    "MFG - Assembly": "A", "MFG - Assembly & Graphics": "A",
}
HOLD_STATUSES = {"Hold - Customer", "Hold - Permit", "Hold - Local", "Hold - Product Ready",
                 "Morton- Hold", "Service - Hold"}
# Statuses the lifecycle stepper can't express -> manual Current Status override.
OVERRIDE_STATUSES = {"Morton - National", "Morton- Hold", "Billboards", "LNI House Order",
                     "Equity Bank Upcoming", "Refurb - Awaiting Removal", "Needs Shipped",
                     "Ready to Send to NEK", "Ready to send to DC", "Outsourced - Vendor",
                     "Subcontracted", "Surveys"}

FIELD_MAP = {  # Airtable column -> crfdf_jobtrack column
    "Order Date (Received)": "crfdf_orderdate", "Mfg Final Date": "crfdf_mfgfinaldate",
    "Expeditor": "crfdf_expeditordate", "Date Installed": "crfdf_dateinstalled",
    "Date to Admin": "crfdf_datetoadmin", "Date to Hold": "crfdf_datetohold",
    "Date off Hold": "crfdf_dateoffhold", "Vendor": "crfdf_vendor", "P.O. #": "crfdf_ponumber",
    "Vendor Status": "crfdf_vendorstatus", "Storage Location": "crfdf_storagelocation",
    "Vendor Ship Date": "crfdf_vendorshipdate", "2nd Vendor Ship Date": "crfdf_vendorshipdate2",
    "Outsourced Arrival": "crfdf_outsourcedarrival", "Graphics": "crfdf_graphics",
    "Routing Type": "crfdf_routingtype", "Powerlines": "crfdf_powerlines", "Sales": "crfdf_sales",
    "Location": "crfdf_location", "Region": "crfdf_region", "MFG Region": "crfdf_mfgregion",
    "Install Region": "crfdf_installregion", "Priority": "crfdf_priority",
}
DATE_FIELDS = {"crfdf_orderdate", "crfdf_mfgfinaldate", "crfdf_expeditordate", "crfdf_dateinstalled",
               "crfdf_datetoadmin", "crfdf_datetohold", "crfdf_dateoffhold", "crfdf_vendorshipdate",
               "crfdf_vendorshipdate2", "crfdf_outsourcedarrival"}


def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()


def iso(s):
    s = clean(s)
    if not s:
        return ""
    try:
        return datetime.strptime(s, "%m/%d/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return ""


bc = {l.strip() for l in open(BC_JOBS, encoding="utf-8", errors="replace") if l.strip()}
rows = list(csv.DictReader(open(CSV_PATH, encoding="utf-8-sig", errors="replace")))
by_job = defaultdict(list)
for r in rows:
    name = clean(r["Job # / Name"])
    job = re.split(r"[\s/]+", name)[0]
    by_job[job].append((name, r))

plan, review = [], []
for job, entries in by_job.items():
    copies = [(n, r) for n, r in entries if re.search(r"\((\w+ )?Copy\)", n)]
    mains = [(n, r) for n, r in entries if (n, r) not in copies] or entries
    # The newest order's row leads when a job has two real rows.
    mains.sort(key=lambda e: iso(e[1]["Order Date (Received)"]), reverse=True)
    lead = mains[0][1]

    jt, conflicts = {"crfdf_jobno": job, "crfdf_name": job}, []
    for col, dv in FIELD_MAP.items():
        vals = [clean(r[col]) for _, r in mains if clean(r[col])]
        vals = [iso(v) for v in vals] if dv in DATE_FIELDS else vals
        vals = [v for v in vals if v]
        if vals:
            jt[dv] = vals[0]  # mains are newest-order first, so the lead row wins
            if len(set(vals)) > 1:
                conflicts.append(f"{col}: {' | '.join(dict.fromkeys(vals))}")
    notes = list(dict.fromkeys(clean(r["Job Notes"]) for _, r in entries if clean(r["Job Notes"])))
    if notes:
        jt["crfdf_notes"] = "\n".join(notes)[:4000]
    jt["crfdf_ulsign"] = any(clean(r.get("UL Sign")) for _, r in entries)
    statuses = list(dict.fromkeys(clean(r["Current Status"]) for _, r in mains + copies if clean(r["Current Status"])))
    processes = list(dict.fromkeys(clean(r["Process"]) for _, r in mains if clean(r["Process"])))
    jt["crfdf_legacystatus"] = " | ".join(statuses)[:100]
    jt["crfdf_legacyprocess"] = " | ".join(processes)[:50]
    lead_status = clean(lead["Current Status"])
    if lead_status in HOLD_STATUSES:
        jt["crfdf_holdreason"] = lead_status
    if lead_status in OVERRIDE_STATUSES:
        jt["crfdf_statusoverride"] = lead_status

    # Stepper: needed / done per department, merged across the job's rows.
    marks = defaultdict(set)
    for _, r in entries:
        for col, key in DEPT_COLS.items():
            v = clean(r[col]).upper()
            if v in ("/", "X"):
                marks[key].add(v)
        rt = clean(r["Routing Type"])
        if rt:
            marks["R"].add("X" if rt.lower() == "routing complete" else "/")
    include = sorted(marks)
    complete = sorted(k for k, v in marks.items() if v == {"X"})  # done only if nothing says still needed
    active = sorted({ACTIVE_BY_STATUS[s] for s in statuses if s in ACTIVE_BY_STATUS} - set(complete))
    include = sorted(set(include) | set(active))

    schedule = {}
    red = [iso(r["RED DATE"]) for _, r in mains if iso(r["RED DATE"])]
    if red:
        schedule["redDate"] = red[0]
    mod = [iso(r["Mfg Target Modified"]) for _, r in mains if iso(r["Mfg Target Modified"])]
    if mod:
        schedule["productionCompleteDate"] = mod[0]

    plan.append({"jobNo": job, "inBc": job in bc, "jobtrack": jt, "schedule": schedule,
                 "include": include, "complete": complete, "active": active})
    review.append({
        "Job": job, "Name": clean(lead["Job # / Name"])[len(job):].strip(" /-"),
        "In BC sync": "yes" if job in bc else "NO",
        "Airtable rows": len(entries),
        "Merged from": "; ".join(n for n, _ in entries) if len(entries) > 1 else "",
        "Current Status (Airtable)": jt["crfdf_legacystatus"],
        "Status override": jt.get("crfdf_statusoverride", ""),
        "Hold": jt.get("crfdf_holdreason", ""),
        "Needed depts": " ".join(include), "Done depts": " ".join(complete), "Active depts": " ".join(active),
        "Red date": schedule.get("redDate", ""), "Mfg target override": schedule.get("productionCompleteDate", ""),
        "Conflicts between rows": " || ".join(conflicts),
    })

os.makedirs(OUT, exist_ok=True)
json.dump(plan, open(os.path.join(OUT, "airtable-import-plan.json"), "w", encoding="utf-8"), indent=1)
with open(os.path.join(OUT, "airtable-import-review.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(review[0].keys()))
    w.writeheader()
    w.writerows(sorted(review, key=lambda x: (x["In BC sync"] != "NO", x["Merged from"] == "", x["Job"])))

print(f"{len(rows)} Airtable rows -> {len(plan)} jobs")
print(f"  in BC sync: {sum(p['inBc'] for p in plan)}   not in BC sync: {sum(not p['inBc'] for p in plan)}")
print(f"  merged (2+ rows): {sum(1 for r in review if r['Airtable rows'] > 1)}   with conflicts: {sum(1 for r in review if r['Conflicts between rows'])}")
print(f"  status overrides: {sum(1 for p in plan if 'crfdf_statusoverride' in p['jobtrack'])}   holds: {sum(1 for p in plan if 'crfdf_holdreason' in p['jobtrack'])}")
print(f"  stepper: {sum(len(p['include']) for p in plan)} needed, {sum(len(p['complete']) for p in plan)} done, {sum(len(p['active']) for p in plan)} active")
print(f"  schedule: {sum('redDate' in p['schedule'] for p in plan)} red dates, {sum('productionCompleteDate' in p['schedule'] for p in plan)} mfg target overrides")
print("  dept keys:", dict(Counter(k for p in plan for k in p["include"])))
