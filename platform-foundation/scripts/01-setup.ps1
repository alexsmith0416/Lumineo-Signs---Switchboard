<#
.SYNOPSIS
    Phase 0 verification: confirms lum_ publisher exists and creates LumineoFoundation solution.

.PARAMETER EnvironmentUrl
    Your Power Platform environment URL, e.g. https://myorg.crm.dynamics.com

.EXAMPLE
    .\01-setup.ps1 -EnvironmentUrl "https://myorg.crm.dynamics.com"
#>
param(
    [Parameter(Mandatory)]
    [string]$EnvironmentUrl
)

$ErrorActionPreference = "Stop"

Write-Host "=== Lumineo Platform Foundation — Setup ===" -ForegroundColor Cyan

# --- 1. Verify PAC CLI ---
Write-Host "`n[1/4] Checking PAC CLI..." -ForegroundColor Yellow
try {
    $pacVersion = pac --version 2>&1
    Write-Host "     PAC CLI found: $pacVersion" -ForegroundColor Green
} catch {
    Write-Error @"
PAC CLI not found. Install it from:
  https://aka.ms/PowerAppsCLI

Then re-run this script.
"@
    exit 1
}

# --- 2. Authenticate ---
Write-Host "`n[2/4] Authenticating to $EnvironmentUrl..." -ForegroundColor Yellow
pac auth create --url $EnvironmentUrl --name "LumineoFoundation-Dev" 2>&1 | ForEach-Object {
    Write-Host "     $_"
}

$whoOutput = pac org who 2>&1
if ($whoOutput -match "No org selected") {
    pac org select --environment $EnvironmentUrl | Out-Null
}
Write-Host "     Authenticated." -ForegroundColor Green

# --- 3. Verify lum_ publisher ---
Write-Host "`n[3/4] Checking for 'lum_' publisher..." -ForegroundColor Yellow

$token = az account get-access-token --resource "https://org8fa22efd.crm.dynamics.com" --query accessToken --output tsv
$apiBase = $EnvironmentUrl.TrimEnd('/') + "/api/data/v9.2"

$headers = @{
    Authorization  = "Bearer $token"
    "OData-MaxVersion" = "4.0"
    "OData-Version"    = "4.0"
    Accept         = "application/json"
}

try {
    $publisherResp = Invoke-RestMethod `
        -Uri "$apiBase/publishers?`$filter=customizationprefix eq 'lum'&`$select=friendlyname,customizationprefix" `
        -Headers $headers -Method GET
} catch {
    Write-Warning "Could not query publishers via API (may need System Administrator role). Continuing..."
    $publisherResp = $null
}

if ($publisherResp -and $publisherResp.value.Count -gt 0) {
    Write-Host "     Publisher 'lum_' found: $($publisherResp.value[0].friendlyname)" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Warning @"
Publisher with prefix 'lum' NOT FOUND in this environment.

You must create it manually BEFORE running any other scripts:
  1. Go to https://make.powerapps.com
  2. Select your Dev environment
  3. Solutions > Publishers > + New Publisher
  4. Set:
       Display name : Lumineo
       Name         : lumineo
       Prefix       : lum         (EXACTLY — no trailing underscore)
       Option value prefix: 10000
  5. Save

Then re-run this script.
"@
    exit 1
}

# --- 4. Create solution if it doesn't exist ---
Write-Host "`n[4/4] Checking for 'LumineoFoundation' solution..." -ForegroundColor Yellow

try {
    $solutionResp = Invoke-RestMethod `
        -Uri "$apiBase/solutions?`$filter=uniquename eq 'LumineoFoundation'&`$select=uniquename,version" `
        -Headers $headers -Method GET
} catch {
    $solutionResp = $null
}

if ($solutionResp -and $solutionResp.value.Count -gt 0) {
    Write-Host "     Solution 'LumineoFoundation' already exists (v$($solutionResp.value[0].version)). Skipping." -ForegroundColor Green
} else {
    Write-Host "     Creating solution 'LumineoFoundation'..." -ForegroundColor Yellow

    # Get publisher ID
    $pubId = $publisherResp.value[0].publisherid

    $solutionBody = @{
        uniquename    = "LumineoFoundation"
        friendlyname  = "Lumineo Foundation"
        description   = "Shared Dataverse schema, security roles, and component library for the Lumineo Signs Power Apps ecosystem."
        version       = "1.0.0.0"
        "publisherid@odata.bind" = "/publishers($pubId)"
    } | ConvertTo-Json

    Invoke-RestMethod `
        -Uri "$apiBase/solutions" `
        -Headers ($headers + @{"Content-Type" = "application/json"}) `
        -Method POST `
        -Body $solutionBody | Out-Null

    Write-Host "     Solution 'LumineoFoundation' created." -ForegroundColor Green
}

Write-Host "`n=== Setup complete. Run 02-create-tables.ps1 next. ===" -ForegroundColor Cyan
