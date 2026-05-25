# 03 — Permissions & Roles

## The model

Two layers. **Entra ID groups** decide which apps a user can even open. **Dataverse security roles** decide what they can see and do within those apps.

### Entra ID security groups

Create these in Microsoft Entra admin center. Membership is how IT onboards/offboards a user — one place, propagates everywhere.

| Group | Members |
|---|---|
| `Lumineo-Operations` | Owners, GM, ops managers |
| `Lumineo-Sales` | Sales reps, sales manager |
| `Lumineo-Employees-Production` | Shop production staff |
| `Lumineo-Employees-Installation` | Install crew |
| `Lumineo-Employees-Shipping` | Shipping/receiving |

A person can be in more than one group. Operations is implicitly a superset — anyone in `Lumineo-Operations` gets full app access regardless of other memberships.

### Power Apps sharing

Each Canvas/Model-Driven app is shared with the Entra groups that need it. Sharing happens at the app level (who can launch it) and at the Dataverse level (what rows they see when they do).

| App | Shared with |
|---|---|
| Switchboard | All five groups |
| Project Scheduler | Operations |
| Weekly Scheduler | Operations, Sales, all three Employee groups |
| Sign Builder Pro | Operations, Sales |
| Time & Photo Capture | Operations, all three Employee groups |
| Sales Hub | Operations, Sales |

### Dataverse security roles

Layered on top — these decide CRUD permissions on tables. Create one role per group plus `Lumineo-Operations` as a baseline.

| Role | Job, Customer, Opportunity | Task | TimeEntry | Photo | SignSpec |
|---|---|---|---|---|---|
| Operations | full | full | full | full | full |
| Sales | read all, write own | read | none | read | full |
| Employees (any dept) | read assigned only | read+update assigned | create/update own | create own, read all | read |

### App-side routing (in Switchboard)

`OnStart` of the Switchboard app:

```powerfx
Set(varUserEmail, User().Email);
Set(varUserProfile,
    LookUp('User Profiles', email = varUserEmail)
);
Set(varGroups,
    Office365Groups.ListGroupsForUser().value
);
Set(varRole,
    If( "Lumineo-Operations" in varGroups.displayName, "Operations",
        "Lumineo-Sales" in varGroups.displayName, "Sales",
        "Lumineo-Employees-Production" in varGroups.displayName, "Production",
        "Lumineo-Employees-Installation" in varGroups.displayName, "Installation",
        "Lumineo-Employees-Shipping" in varGroups.displayName, "Shipping",
        "Unauthorized"
    )
);
Set(varHomeScreen,
    Switch(varRole,
        "Operations",  scrHomeOps,
        "Sales",       scrHomeSales,
        "Production",  scrHomeProd,
        "Installation", scrHomeInst,
        "Shipping",    scrHomeShip,
        scrUnauthorized
    )
);
Navigate(varHomeScreen, ScreenTransition.Fade)
```

### Passing identity to sub-apps

When a tile is tapped:

```powerfx
Launch(
    "https://apps.powerapps.com/play/<appId>",
    {
        userEmail: varUserEmail,
        role: varRole,
        deptFilter: varRole  // matters for Weekly Scheduler + T&P
    }
)
```

Each sub-app reads `Param("userEmail")` etc. in its own `OnStart` so it boots in the right state.

### A note on "Operations sees everything, can edit everything"

Two ways to enforce this:

1. **App layer** — in each sub-app, hide admin-only buttons unless `Param("role") = "Operations"`. Easy to bypass if someone visits the app URL directly.
2. **Data layer** — Dataverse role-based row filters. This is the real enforcement. Even if a Sales user finds a way to call Switchboard with `role: "Operations"`, Dataverse still says "you're not in that role" when they try to read/write.

Always do both — UI for the friendly experience, Dataverse for the real security.
