"""Check BC now (Oct 12, 2026) - shared by the BCSync_* generators.

Each BC pull runs on a crfdf_syncrequest row of its Kind instead of its own
timer. Two things add those rows:
  - BCSync_Scheduler (_gen_sync_scheduler_flow.py) - every 5 minutes, the
    kinds that are due (each pull keeps its old timing, SCHEDULE below);
  - the app's Check BC now button (Jobs list) - every kind at once.

A pull runs one request at a time (trigger concurrency 1), so a button press
during a scheduled run waits its turn and nothing is copied twice. It writes
Status (Running -> Done / Failed) and a Result line back on the row; scheduler
rows are deleted once done (failed ones are kept, so a failing pull shows up in
the table). The app watches its own rows and reloads what changed.
"""

DV = {"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
      "connectionName": "shared_commondataserviceforapps"}

REQUESTS = "crfdf_syncrequests"
REQ_ID = "@triggerOutputs()?['body/crfdf_syncrequestid']"
SCHEDULER = "Scheduler"

# Kind -> when the scheduler asks for it (Central time; HH / mm = ints). The
# scheduler runs every 5 minutes on the :00 / :05 / ... marks.
SCHEDULE = {
    "taskcompletions": "true",                                    # every 5 minutes
    "neworders": "less(mod(mm, 15), 5)",                          # every 15 minutes
    "jobdescriptions": "less(mm, 5)",                             # hourly
    "jobpos": "and(equals(HH, 5), equals(div(mm, 5), 3))",        # 5:15 nightly
    "jobsketches": "and(equals(HH, 4), equals(div(mm, 5), 6))",   # 4:30 nightly
}


def _dv(op, params, run_after=None):
    return {"type": "OpenApiConnection", "runAfter": run_after or {},
            "inputs": {"parameters": params, "host": {**DV, "operationId": op}}}


def request_trigger(kind):
    """Fires when a request for this kind is added; one run at a time."""
    return {"When_a_check_is_requested": {
        "type": "OpenApiConnectionWebhook",
        "inputs": {"parameters": {"subscriptionRequest/message": 1,  # added
                                  "subscriptionRequest/entityname": "crfdf_syncrequest",
                                  "subscriptionRequest/scope": 4,
                                  "subscriptionRequest/filterexpression": f"crfdf_kind eq '{kind}'"},
                   "host": {**DV, "operationId": "SubscribeWebhookTrigger"},
                   "authentication": "@parameters('$authentication')"},
        # One at a time: a button press during a scheduled run waits its turn.
        "runtimeConfiguration": {"concurrency": {"runs": 1}}}}


def mark(status, result, run_after):
    return _dv("UpdateOnlyRecord", {"entityName": REQUESTS, "recordId": REQ_ID,
                                    "item/crfdf_status": status, "item/crfdf_result": result}, run_after)


def with_request(work, done_text, failed_status="Failed", failed_text=None, first=None):
    """The pull's actions wrapped in its request: Running -> the work -> Done / Failed.

    done_text / failed_text / failed_status are WDL expressions WITHOUT the
    leading @ (failed_status may be the plain word Failed). `first` = actions
    that must sit at the top level before anything else (InitializeVariable).
    """
    first = dict(first or {})
    last = list(first)[-1] if first else None
    if failed_text is None:
        failed_text = "'Could not check BC - see the flow run history.'"
    status = failed_status if failed_status == "Failed" else f"@{failed_status}"
    return {
        **first,
        "Mark_Running": mark("Running", "", {last: ["Succeeded"]} if last else {}),
        "Check_BC": {"type": "Scope", "runAfter": {"Mark_Running": ["Succeeded"]}, "actions": work},
        # Done: a button press gets its answer; a scheduler row is just removed.
        "From_The_Scheduler": {
            "type": "If", "runAfter": {"Check_BC": ["Succeeded"]},
            "expression": {"equals": ["@triggerOutputs()?['body/crfdf_requestedby']", SCHEDULER]},
            "actions": {"Remove_Scheduler_Request": _dv("DeleteRecord", {"entityName": REQUESTS, "recordId": REQ_ID})},
            "else": {"actions": {"Mark_Done": mark("Done", f"@{done_text}", {})}},
        },
        "Mark_Failed": mark(status, f"@{failed_text}", {"Check_BC": ["Failed", "TimedOut"]}),
    }


def lit(text):
    """A WDL string literal."""
    return "'" + text.replace("'", "''") + "'"


def count_text(n, one, many, none):
    """`none` when n is 0, else 'n one' / 'n many' (WDL; n is an expression)."""
    return (f"if(equals({n}, 0), {lit(none)}, concat(string({n}), "
            f"if(equals({n}, 1), {lit(' ' + one)}, {lit(' ' + many)})))")
