# BC permission request — internal (to our BC admin)

**Status:** not yet sent as of Sep 18, 2026.
**Blocks:** the entire Planning Step write-back workaround. Nothing on that thread
can progress until this is granted — see the ACTIVE block in `START-HERE.md`.

Distinct from `BCPush-infotech-request.md`, which goes to **Infotech** and asks for a
writable API page. This one goes to **our own BC admin** and asks for permissions on
the environment we already have. The two are independent: this one unblocks the
workaround now, that one is the durable fix.

---

## Why (the evidence)

Our own web service page (`LumineoPlanningSteps`, over table 71441976
`ICG.IPP.ProjectPlanningStep`) is published and reachable, but a GET returns **HTTP 403**:

```
Sorry, the current permissions prevented the action.
(TableData 71442000 ICG.IPS.ProjectSchedulerSetup General Scheduler Setup
 Read: Infotech Project Scheduler)
CorrelationId: 9c923b51-4400-455a-a410-9ddfb4ee603a
```

The S2S app is missing a permission set from **Infotech Project Scheduler** (`ICG.IPS`)
— a third Infotech extension, separate from Project Planning (`ICG.IPP`) and Sign365.
`D365 BUS FULL ACCESS` does not cover third-party extension tables, which is why the
other ICG sets are listed individually on the card.

Attempting to add the line ourselves fails with:

> You have not been granted rights to add, modify, or delete this permission set for
> this user in this company. To obtain rights, you must be granted either the SUPER
> or SECURITY permission set.

---

## Email draft

**Subject:** BC permission request — Entra app "PowerApps Permissions" + SECURITY for my user

Hi [Name],

Two related asks, both on our UAT Business Central environment. The second is blocked
on the first.

**1. Add a permission set to the "PowerApps Permissions" Entra application**
(Client ID `34a4de23-4db0-48d9-a941-285c9c2f9b5d`, user `POWERAPPS PERMISSIONS`)

It currently has D365 BUS FULL ACCESS, ICG.PROJECTPLANNING, ICG.SGPN365 and LOGIN.
It needs **`ICG.IPS.GENERAL`** (Infotech Project Scheduler) added. Without it, a read
returns:

> Sorry, the current permissions prevented the action. (TableData 71442000
> ICG.IPS.ProjectSchedulerSetup General Scheduler Setup Read: Infotech Project Scheduler)

D365 BUS FULL ACCESS doesn't cover third-party extension tables, which is why the other
ICG sets are listed individually — the Scheduler one was just never added.

While you're in there: could you also confirm whether **`ICG.PROJECTPLANNING`** grants
**Modify** on table **71441976** (`ICG.IPP.ProjectPlanningStep`)? If it's read-only,
please swap it for **`ICG.PROJPLANNING.ADM`**. We need to write to that table, and
catching it now saves a second change window.

⚠️ Note the card requires **State → Disabled** before the lines can be edited, then back
to **Enabled** and **Grant Consent**. Our `BCSync_*` Power Automate flows use this same
client ID and will fail while it's Disabled, so a quiet window would be ideal — it only
takes a minute.

**2. Grant my user (`asmith@lumineosigns.com`) the SECURITY permission set**

I hit *"you must be granted either the SUPER or SECURITY permission set"* trying to make
the change above myself. **SECURITY**, not SUPER — it's scoped to permission management
and nothing else. This would let me maintain these assignments without routing every one
through you.

Happy to jump on a call, or to walk through it with you if you'd rather make the change
while I watch.

Thanks,
Alex

---

## Open question to settle before sending

Does `ICG.PROJECTPLANNING` grant **Modify** on table **71441976**? Check via
BC → **Permission Sets** → `ICG.PROJECTPLANNING` → **Permissions**, find object ID
71441976, read the **Modify Permission** column. This is a view-only check and needs no
special rights.

- **Modify = Yes** → drop the `ICG.PROJPLANNING.ADM` paragraph from the draft.
- **Modify = blank** → keep it; the swap is required or the PATCH will fail later.
