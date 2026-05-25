# 02 — Flowcharts

Three views: **user journey**, **system architecture**, and **data flow**. All in Mermaid so they render natively in GitHub.

## A. User journey — from launch to sub-app

```mermaid
flowchart TD
    Start([User opens Switchboard]) --> Splash[Splash screen<br/>Lumineo logo + loading]
    Splash --> AuthCheck{Signed in to<br/>Entra ID?}
    AuthCheck -- No --> Login[Microsoft sign-in<br/>SSO]
    Login --> AuthCheck
    AuthCheck -- Yes --> RoleLookup[Read Entra group<br/>+ UserProfile table<br/>in Dataverse]

    RoleLookup --> RoleBranch{Primary role?}

    RoleBranch -- Operations --> OpsHome[Operations Home<br/>All 5 apps + global KPIs]
    RoleBranch -- Sales --> SalesHome[Sales Home<br/>3 apps + pipeline KPIs]
    RoleBranch -- Employee --> DeptBranch{Department?}

    DeptBranch -- Production --> ProdHome[Production Home<br/>2 apps + prod KPIs]
    DeptBranch -- Installation --> InstHome[Installation Home<br/>2 apps + install KPIs]
    DeptBranch -- Shipping --> ShipHome[Shipping Home<br/>2 apps + ship KPIs]

    OpsHome --> Tiles[App launcher tiles<br/>+ announcements<br/>+ birthdays<br/>+ photo reel]
    SalesHome --> Tiles
    ProdHome --> Tiles
    InstHome --> Tiles
    ShipHome --> Tiles

    Tiles --> TileTap{User taps tile}
    TileTap -- Project Scheduler --> PSLaunch[Launch with userEmail<br/>+ context payload]
    TileTap -- Weekly Scheduler --> WSLaunch[Launch with userEmail<br/>+ deptFilter]
    TileTap -- Sign Builder Pro --> SBLaunch[Launch with userEmail]
    TileTap -- Time and Photo --> TPLaunch[Launch with userEmail<br/>+ todays jobs]
    TileTap -- Sales Hub --> SHLaunch[Launch Model-Driven<br/>with userEmail]
```

## B. System architecture

```mermaid
flowchart TB
    subgraph Identity["Identity & Access"]
        Entra[Microsoft Entra ID]
        Groups["Security Groups<br/>• Lumineo-Operations<br/>• Lumineo-Sales<br/>• Lumineo-Prod<br/>• Lumineo-Install<br/>• Lumineo-Ship"]
        Entra --- Groups
    end

    subgraph Shell["Switchboard Shell"]
        Switchboard[Switchboard<br/>Canvas App]
        CCL[Canvas Component<br/>Library<br/>header, nav, KPI tiles]
    end

    subgraph SubApps["Sub-Apps (independent solutions)"]
        PS[Project Scheduler<br/>Canvas]
        WS[Weekly Scheduler<br/>Canvas + React PCF]
        SB[Sign Builder Pro<br/>Canvas + React PCF]
        TP[Time & Photo Capture<br/>Canvas mobile]
        SH[Sales Hub<br/>Model-Driven + React PCF]
    end

    subgraph Data["Data layer"]
        DV[(Dataverse<br/>shared tables)]
        VT[Virtual Tables<br/>read-thru to BC]
        SP[SharePoint<br/>large files / photos]
    end

    subgraph External["External systems"]
        BC[(D365 Business Central<br/>Customers, Items,<br/>Sales Orders, Inventory)]
        Flow[Power Automate<br/>flows]
    end

    Groups --> Switchboard
    Switchboard --> CCL
    CCL -.shared by.-> PS
    CCL -.shared by.-> WS
    CCL -.shared by.-> SB
    CCL -.shared by.-> TP

    Switchboard -- Launch() --> PS
    Switchboard -- Launch() --> WS
    Switchboard -- Launch() --> SB
    Switchboard -- Launch() --> TP
    Switchboard -- Launch() --> SH

    PS <--> DV
    WS <--> DV
    SB <--> DV
    TP <--> DV
    SH <--> DV
    Switchboard <--> DV

    DV --- VT
    VT <--> BC
    Flow <-- write-back --> BC
    DV --> Flow

    TP --> SP
    SB --> SP
```

## C. Data flow — a job from quote to install

This shows how a single record lives across the apps and across Dataverse ↔ Business Central.

```mermaid
sequenceDiagram
    actor Sales as Sales Rep
    actor Ops as Operations
    actor Prod as Production
    actor Inst as Installer
    participant SH as Sales Hub
    participant DV as Dataverse
    participant BC as Business Central
    participant PS as Project Scheduler
    participant WS as Weekly Scheduler
    participant SB as Sign Builder Pro
    participant TP as Time & Photo

    Sales->>SH: Create Opportunity
    SH->>DV: Insert Opportunity row
    Sales->>SH: Convert to Quote, add line items
    SH->>BC: Push Sales Quote (Power Automate)
    BC-->>DV: Quote # back via virtual table

    Sales->>SB: Open Sign Builder for line
    SB->>DV: Save SignSpec (linked to Opportunity)

    Sales->>SH: Mark Won
    SH->>DV: Opportunity.Status = Won, create Job row
    SH->>BC: Convert Quote → Sales Order

    Ops->>PS: See new Job, schedule milestones
    PS->>DV: Update Job.startDate, dueDate, assignedTeam

    Ops->>WS: Assign tasks to Production for week
    WS->>DV: Insert Task rows (dept=Production)

    Prod->>WS: See assigned tasks
    Prod->>TP: Clock in to task, upload progress photo
    TP->>DV: TimeEntry + Photo rows linked to Task

    Prod->>WS: Mark task complete
    WS->>DV: Task.Status = Done
    DV->>PS: Roll up to Job % complete

    Ops->>WS: Schedule install for Installation dept
    Inst->>TP: Clock in to install, upload completion photos
    TP->>DV: TimeEntry + Photo rows
    DV->>BC: Trigger invoice flow (Power Automate)
    BC-->>DV: Invoice # back, Job.Status = Invoiced
```
