# 09 — Weather Card Specification

Each Installation job card on the Weekly Scheduler and the Installation home screen shows a small weather chip with the forecast for **that job's install date** at **that job's install ZIP**. Helps the install crew plan their day and gives Ops early visibility into weather-driven schedule risk.

Linear tracking: `Switchboard — Master Power Apps Shell` → *Phase 4* + `Platform Foundation` → *Phase 1c* (WeatherCache table)

---

## Visual

Two display modes — compact (on a job card) and expanded (when the card is tapped).

```
COMPACT (always shown on Installation job cards)
┌─────────────────────────────────────────────────┐
│ J-2026-0142  Reynolds Storefront     2M  1T 🌤️ 68°│
│ 12300 SE Stark, Portland · 9:00 AM              │
└─────────────────────────────────────────────────┘

EXPANDED (when card is tapped, flyout panel)
┌─────────────────────────────────────────────────┐
│ Weather for Thu Aug 6 — 97233 Portland         │
│                                                 │
│   🌤️  Mostly Sunny                              │
│   High 72°F  /  Low 51°F                        │
│   Wind WSW 8 mph                                │
│   Precip 10%                                    │
│                                                 │
│   ⚠️  Wind gusts >25mph after 4 PM             │
└─────────────────────────────────────────────────┘
```

---

## Data flow

```
Job (scheduledInstallDate, install ZIP via bc_Customer.shipAddress)
        │
        ▼
WeatherCache lookup  (zip + date)
        │
   ┌────┴────┐
   │ hit     │ miss
   ▼         ▼
 use     OpenWeatherMap One Call API
 cached  via Power Automate (custom connector)
 row     │
         ▼
         insert into WeatherCache, return to app
```

---

## Data model — `WeatherCache`

```
WeatherCache
├─ id (PK)
├─ zip (string, 5 chars)
├─ forDate (date)
├─ tempHigh (int, °F)
├─ tempLow (int, °F)
├─ condition (Sunny | Partly Cloudy | Cloudy | Rain | T-Storm | Snow | Wind)
├─ conditionIcon (string — OpenWeather icon code)
├─ precipPct (int)
├─ windMph (int)
├─ windDir (string)
├─ alerts (json — gusts, advisories)
├─ fetchedAt (datetime)
└─ source (OpenWeather | NOAA | manual)
```

Indexed by (`zip`, `forDate`) for fast lookups. Rows older than 14 days auto-pruned by a weekly housekeeping flow.

---

## API choice

| Option | Cost | Pros | Cons |
|---|---|---|---|
| **OpenWeatherMap One Call 3.0** | $0.0015/call after 1k free/day | Reliable, forecasts up to 8 days, alerts included | Per-call billing if heavy use |
| **NOAA / National Weather Service** | Free | Truly free, US-only, very reliable | No SLA, US-only, more parsing work |
| **AccuWeather** | Free tier 50 calls/day | Brand recognition, good UI assets | Tight free tier |
| **Tomorrow.io** | Free 500/day | Hyperlocal | Account setup heavier |

**Recommendation:** **OpenWeatherMap One Call 3.0** primary, with **NOAA** as a fallback for redundancy. Both are US-friendly; OpenWeatherMap covers any future international installs.

### Cost estimate

If Lumineo runs ~20 installs/day, each fetched once and cached, that's 20 calls × 30 days = 600 calls/month. Well within the free tier. Worst case (every job card refetches three times a day) = 1,800 calls/month = ~$2/month. Negligible.

---

## Power Automate connector

A custom connector `Lumineo Weather` wraps the OpenWeather API key. The Canvas app never sees the key; it calls a Power Automate flow `GetWeatherForJob` with `{ zip, forDate }`.

### Flow logic — `GetWeatherForJob`

```
Trigger:  HTTP request from Power Apps
Inputs:   zip (string), forDate (date)

1. LookUp WeatherCache where zip=@zip AND forDate=@forDate
2. If found AND fetchedAt > now()-3h → return cached row
3. Else:
     a. Call OpenWeather: GET /onecall?lat={zip→lat}&lon={zip→lon}&exclude=minutely,current
     b. Parse daily forecast for @forDate
     c. Upsert WeatherCache row
     d. Return new row
4. Catch errors → return prior cached row if any, else "unavailable"
```

The flow is shared across **Installation home**, **Weekly Scheduler**, and **Project Scheduler** Gantt views.

### ZIP → lat/lon

OpenWeather takes lat/lon, not ZIP. A small lookup table `bc_ZipGeo` (or a free public dataset imported once into Dataverse) maps the ZIPs Lumineo serves. ~42k US ZIPs is a trivial Dataverse table.

---

## Component — `lcl_WeatherChip`

Input properties:
- `zip` (string)
- `forDate` (date)
- `mode` ("compact" | "expanded")

Behavior:
- On render, calls the Power Automate flow
- Compact mode: icon + temp only (`🌤️ 68°`)
- Expanded mode: full flyout
- Tap compact → flips to expanded inline (or opens flyout depending on host context)
- Color tinting on the chip background hints at conditions:
  - Sunny → soft yellow
  - Cloudy → soft gray
  - Rain → soft blue
  - T-Storm → soft red (alert color — flags as risky)
  - Snow → soft white-blue

### Power Fx — chip OnVisible

```powerfx
Set(varWeather,
    'Lumineo Weather'.GetWeatherForJob({
        zip: Self.zip,
        forDate: Self.forDate
    })
);
```

The flow caches aggressively, so most renders are sub-200 ms.

---

## Where it appears

| Surface | Mode | Notes |
|---|---|---|
| Installation home — "Today's route" list | compact | one per install |
| Installation home — "My next install" KPI card | expanded | takes a full card |
| Weekly Scheduler — install task cards | compact | when `department=Installation` |
| Project Scheduler — Gantt install bar | compact, on hover | tooltip |
| Time & Photo — pre-install briefing screen | expanded | shown when crew clocks in |

---

## Edge cases

| Case | Behavior |
|---|---|
| Install >8 days out | Show "Forecast available 8 days before" |
| ZIP not in `bc_ZipGeo` | Fall back to job's billing ZIP; if still missing, show "—" |
| API down / over quota | Last cached row used regardless of age (with stale badge); if no cache, hide the chip |
| Severe weather alert (wind/storm) | Add a `⚠️` to the compact chip; expanded view shows the alert text |
| User in mobile + offline | Cached row served from `LoadData` local cache |

---

## Why this matters beyond decoration

- **Schedule resilience.** Ops sees in advance which installs are weather-risky and can call the customer to reschedule before the crew rolls up.
- **Crew prep.** Install knows whether to bring the canopy, cold-weather gear, etc.
- **Liability.** A logged weather record alongside install time photos creates a paper trail if a customer later disputes work quality ("the paint streaked because it was raining when you installed it").
