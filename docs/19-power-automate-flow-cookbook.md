# Power Automate Flow Cookbook — Sign365 → Dataverse

> Step-by-step build guide for the sync flows that fill the `crfdf_bc*`
> mirror tables the Weekly Calendar Code App reads. Companion to
> [docs/18-sign365-api-reference.md](18-sign365-api-reference.md).
>
> **Do this first:** run `node scripts/discover-sign365.mjs` (creds via env
> vars) — it prints the real field names each endpoint returns and writes a
> ready-to-paste Parse JSON schema per endpoint plus a mapping report that
> flags any column the app expects but the API doesn't provide. 90% of
> "data lands in the wrong columns" problems are guessed field names; this
> removes the guessing.

---

## 0 · Why your flows are probably misbehaving

Check these before rebuilding anything — they cover nearly every "flow runs
green but the columns are wrong/empty" case:

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | Columns silently empty | Parse JSON schema was generated from a sample that was missing fields → dynamic content picker shows nothing / maps null | Regenerate schema from `scripts/discover-sign365.mjs` output |
| 2 | "The template language expression … cannot be evaluated" | Wrong casing — BC field names are camelCase and expressions are case-sensitive (`shipToName` ≠ `ShipToName`) | Copy names verbatim from the discovery output |
| 3 | Only one record syncs | Iterating the HTTP body directly instead of the `value` array | Apply-to-each source must be `body('Parse_JSON')?['value']` |
| 4 | Choice column write fails | Dataverse choice (option set) columns take the **integer** value, not the label | e.g. `crfdf_type`: map `Resource`→`890950000` etc., or make the column plain Text (recommended for mirrors) |
| 5 | Dates land as 1/1/1900 or shifted a day | Date-only Dataverse column fed a full ISO datetime, or timezone slip | `formatDateTime(item()?['promisedDate'], 'yyyy-MM-dd')` |
| 6 | Lookup column errors | Lookups need `@odata.bind`, not a raw GUID | For mirror tables avoid lookups — store `crfdf_jobno` as plain text and join in the app |
| 7 | Duplicates on every run | Flow does Add-row instead of upsert | Use **alternate keys** + the "Upsert a row" pattern (§2) |
| 8 | Sync stops at 100–200 rows | Server-side pagination not followed | Do-until loop on `@odata.nextLink` (§3) |
| 9 | 401 after ~1 hour of runs | Token cached too long | Get a fresh token per run (the HTTP action pattern below does) |
| 10 | Random missing rows | Delta filter uses a field the API doesn't have | Confirm `lastModifiedDateTime` exists in discovery output; if not, do full re-sync per run |

**Design rule that avoids half of the above: make every column on the
`crfdf_bc*` mirror tables either Text, Decimal, Date, or DateTime. No
choices, no lookups.** Mirrors are staging data — keep them dumb. The app
already joins by `crfdf_jobno` strings.

---

## 1 · Shared skeleton (every sync flow)

Name flows `SYNC — BC <endpoint>`. All follow the same 7 actions:

```
1. Recurrence                    (cadence per table tier, docs/18 §4)
2. HTTP — Get token              POST https://login.microsoftonline.com/
                                   {tenant}/oauth2/v2.0/token
   Headers: Content-Type: application/x-www-form-urlencoded
   Body:
     grant_type=client_credentials
     &client_id=@{parameters('BC Client ID (env var)')}
     &client_secret=@{parameters('BC Client Secret (env var)')}
     &scope=https%3A%2F%2Fapi.businesscentral.dynamics.com%2F.default
   ⚙ Settings → Secure Inputs ON, Secure Outputs ON
3. Parse JSON — Token            Schema: {"type":"object","properties":
                                   {"access_token":{"type":"string"}}}
4. HTTP — Get <endpoint>         GET  {base}/<endpoint>?$top=500
   Headers:
     Authorization: Bearer @{body('Parse_JSON_—_Token')?['access_token']}
     Accept: application/json
5. Parse JSON — Payload          Schema: paste sign365-discovery/
                                   <endpoint>.schema.json
6. Apply to each                 Source: body('Parse_JSON_—_Payload')?['value']
     └─ Upsert a row (§2)
7. (on failure) Post to Teams    Configure run-after: has failed / timed out
```

Store the client id/secret as **environment variables** (secret type,
Key-Vault-backed) in your solution — never inline in the flow.

Base URL (UAT):

```
https://api.businesscentral.dynamics.com/v2.0/luminousneon.com/UAT/api/infotechConsultingGroup/sign365/v1.0/companies(4738bfb5-a06d-ec11-bf27-000d3a132a9e)
```

---

## 2 · The upsert pattern (kills duplicates)

For each mirror table define an **alternate key** in the table designer
(Settings → Keys) on the natural-key column(s):

| Table | Alternate key column(s) |
|---|---|
| `crfdf_bcjob` | `crfdf_jobno` |
| `crfdf_bcplanningline` | `crfdf_naturalkey` (Text — flow writes `{jobNo}-{lineNo}`) |
| `crfdf_bccostandsales` | `crfdf_jobno` |
| `crfdf_bctripresource` | `crfdf_naturalkey` (`{jobNo}-{tripNo}-{resourceNo}`) |
| `crfdf_weathercache` | `crfdf_naturalkey` (`{zip}-{yyyy-MM-dd}`) |

> Composite alternate keys work too, but a single computed
> `crfdf_naturalkey` text column is easier to reference from the flow.

Then inside Apply-to-each use ONE action — **Dataverse ▸ Upsert a row**
(shows as "Update a row" with the Row ID pointed at the alternate key):

```
Action: Update a row (Dataverse)
Table name: BC Planning Lines
Row ID:  crfdf_naturalkey='@{item()?['jobNo']}-@{item()?['lineNo']}'
(fill columns per §4 — Update-with-alternate-key creates the row if absent
 when "Upsert" behavior is on; otherwise pair with a Get-row + condition)
```

If your connector version lacks true upsert semantics, use this fallback:

```
List rows (top 1, filter: crfdf_naturalkey eq '...')
Condition: length(outputs('List_rows')?['body/value']) is greater than 0
  YES → Update a row (Row ID = first(...)?['crfdf_bc...id'])
  NO  → Add a new row
```

---

## 3 · Pagination (tables > 500 rows: planning lines, ledger)

Wrap steps 4–6 in a **Do until** loop:

```
Initialize variable  varNextLink (String) = {base}/<endpoint>?$top=500
Do until: empty(variables('varNextLink')) is equal to true
  ├─ HTTP — GET @{variables('varNextLink')}   (Bearer token header)
  ├─ Parse JSON — Payload
  ├─ Apply to each … upsert (§2)
  └─ Set variable varNextLink =
       @{coalesce(body('Parse_JSON_—_Payload')?['@odata.nextLink'], '')}
```

---

## 4 · Column-by-column mapping per flow

Field names below are the standard BC API camelCase names — **verify each
one against your discovery output** and adjust. `item()` = the current
record inside Apply-to-each.

### 4.1 SYNC — BC Jobs → `crfdf_bcjob` (every 10 min)

| Dataverse column (Text unless noted) | Expression |
|---|---|
| `crfdf_jobno` | `@{item()?['no']}` |
| `crfdf_shiptoname` | `@{coalesce(item()?['shipToName'], item()?['billToName'])}` |
| `crfdf_billtoname` | `@{item()?['billToName']}` |
| `crfdf_shiptoaddress` | `@{item()?['shipToAddress']}` |
| `crfdf_shiptocity` | `@{item()?['shipToCity']}` |
| `crfdf_shiptostate` | `@{item()?['shipToState']}` |
| `crfdf_shiptozip` | `@{item()?['shipToZip']}` — **weather chip key; must be the ship-to ZIP** |
| `crfdf_promiseddate` (Date) | `@{if(empty(item()?['promisedDate']), null, formatDateTime(item()?['promisedDate'], 'yyyy-MM-dd'))}` |

> If discovery shows the ship-to fields live on `/projectDetails` instead
> of `/jobs`, sync both endpoints into `crfdf_bcjob`: jobs first, then a
> second flow that updates the ship-to columns by `crfdf_jobno`.

### 4.2 SYNC — BC Planning Lines → `crfdf_bcplanningline` (every 10 min)

| Column | Expression |
|---|---|
| `crfdf_naturalkey` | `@{item()?['jobNo']}-@{item()?['lineNo']}` |
| `crfdf_jobno` | `@{item()?['jobNo']}` |
| `crfdf_lineno` (Whole number) | `@{item()?['lineNo']}` |
| `crfdf_type` (Text!) | `@{item()?['type']}` |
| `crfdf_description` | `@{item()?['description']}` |
| `crfdf_quantity` (Decimal) | `@{float(coalesce(item()?['quantity'], 0))}` |

The app filters `crfdf_type eq 'Resource'` — keep the type column **Text**
so the string compare works, and confirm in discovery whether BC returns
`"Resource"` (string) or an enum number. If it's a number, translate:
`@{if(equals(item()?['type'], 0), 'Resource', if(equals(item()?['type'], 1), 'Item', 'Other'))}` — adjust to the enum order discovery shows.

### 4.3 SYNC — BC Cost & Sales → `crfdf_bccostandsales` (every 30 min)

| Column | Expression |
|---|---|
| `crfdf_jobno` | `@{item()?['no']}` |
| `crfdf_contractvalue` (Decimal) | `@{float(coalesce(item()?['contractValue'], item()?['totalSalesPrice'], 0))}` |
| `crfdf_invoicedamount` (Decimal) | `@{float(coalesce(item()?['invoicedAmount'], item()?['billedAmount'], 0))}` |
| `crfdf_remainingtoinvoice` (Decimal) | `@{max(0, sub(float(coalesce(item()?['contractValue'], 0)), float(coalesce(item()?['invoicedAmount'], 0))))}` |

> `max()` isn't available in flow expressions — use:
> `@{if(greater(sub(float(...contract...), float(...invoiced...)), 0), sub(float(...contract...), float(...invoiced...)), 0)}`
> or just write contract + invoiced and let the app derive remaining (it
> already does when `crfdf_remainingtoinvoice` is 0/absent).

### 4.4 SYNC — BC Trips/Resources → `crfdf_bctripresource` (every 15–30 min)

| Column | Expression |
|---|---|
| `crfdf_naturalkey` | `@{item()?['jobNo']}-@{item()?['tripNo']}-@{item()?['resourceNo']}` |
| `crfdf_jobno` | `@{item()?['jobNo']}` |
| `crfdf_tripno` | `@{item()?['tripNo']}` |
| `crfdf_resourceno` | `@{item()?['resourceNo']}` |
| `crfdf_resourcetype` | `@{item()?['resourceType']}` (`Person` / `Machine`) |
| `crfdf_tripdate` (Date) | `@{if(empty(item()?['tripDate']), null, formatDateTime(item()?['tripDate'], 'yyyy-MM-dd'))}` |

The app derives: **trips per job** = distinct `crfdf_tripno` per
`crfdf_jobno`; **men per trip** = Person rows; **trucks per trip** =
Machine rows (fleet-code regex fallback `F##`/`D##`/Chevy/crane/bucket).
No aggregation needed in the flow — sync the raw rows.

### 4.5 FLOW — Lumineo Weather → `crfdf_weathercache` (every 6 h)

This one is a two-stage flow, not a Sign365 sync:

```
1. Recurrence — every 6 hours
2. Dataverse — List rows: crfdf_installationscheduleline
     Filter: crfdf_startdatetime le @{addDays(utcNow(), 14)} and
             crfdf_enddatetime ge @{utcNow()} and
             crfdf_installzip ne null
     Select: crfdf_installzip
3. Select — map to @{item()?['crfdf_installzip']}
4. Compose — union() the list with itself to dedupe:
     @{union(body('Select'), body('Select'))}
5. Apply to each ZIP:
   ├─ HTTP — GET https://api.openweathermap.org/data/2.5/forecast
   │        ?zip=@{item()},us&units=imperial&appid=@{parameters('OWM Key')}
   │        (Secure Inputs ON — the key stays server-side)
   ├─ Parse JSON
   └─ Apply to each forecast day (group 3-hour slots by date):
        Upsert crfdf_weathercache with
          crfdf_naturalkey  @{item()}-@{formatDateTime(..., 'yyyy-MM-dd')}
          crfdf_zip         @{items('Apply_to_each_ZIP')}
          crfdf_forecastdate  (Date)
          crfdf_condition   @{toLower(first(...weather)?['main'])}
          crfdf_label       @{first(...weather)?['description']}
          crfdf_temphigh / crfdf_templow / crfdf_precippct / crfdf_windmph
          crfdf_alert       (null unless the API returns one)
          crfdf_fetchedat   @{utcNow()}
```

> Simplification if the 3-hour grouping is painful in flow expressions:
> call OWM's One Call daily API instead (`/data/3.0/onecall` with
> `exclude=minutely,hourly`) — one record per day, direct mapping.
> The app accepts either as long as the columns above are filled.

### 4.6 One-time — `crfdf_bczipgeo`

Import the free ZIP database (e.g. GeoNames US.txt, ~42k rows) with the
Dataverse "Import from Excel/CSV" wizard: `crfdf_zip` · `crfdf_city` ·
`crfdf_state`. No flow needed — ZIP geography doesn't change.

---

## 5 · Sync-state + monitoring (recommended)

Add a `crfdf_bcsyncstate` row per table: after a successful run, update
`crfdf_lastsyncat = utcNow()` and `crfdf_lastdeltacount`. Add a scheduled
"SYNC — health check" flow that posts to Teams if any table's
`crfdf_lastsyncat` is older than 3× its cadence. This is the difference
between "the dispatcher tells you data is stale" and "you tell the
dispatcher before they notice."

---

## 6 · Validation checklist (run after building each flow)

1. Run the flow manually → open the run → confirm the Parse JSON action
   output shows **populated** fields, not nulls.
2. Open the Dataverse table (Tables ▸ Data) → confirm columns are filled
   and no duplicate rows appear after running the flow **twice**.
3. In the Weekly Calendar app, search a job number you know exists — the
   result should show ship-to name, remaining $, trip count.
4. Drop the job on the calendar → card shows the $ chip; weather chip
   appears within one render cycle if `crfdf_weathercache` has that ZIP.
5. Flip a value in BC (UAT) → wait one cadence → confirm the mirror row
   updated (check `modifiedon`).
