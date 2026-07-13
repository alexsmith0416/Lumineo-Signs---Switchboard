<#
  Adds a text column `crfdf_salespersoncode` to the crfdf_bcjob Dataverse table so
  the BCSync_SalesLines flow can stamp each job with its BC salesperson code
  (SalesLines.salespersonCode, e.g. "DWELU"). The Code App reads it to show the
  Project Manager on job cards and to drive the Sales/PM "Active Jobs" views.

  Uses the Web API with a device-code token (az is blocked by the proxy).
  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  Safe to re-run: a column that already exists is skipped.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'   # Azure CLI public client (device-code capable)
$entitySet = 'crfdf_bcjobs'   # the EntitySet name; logical name is resolved below

# --- Device-code auth ---------------------------------------------------------
$dc = Invoke-RestMethod -Method Post `
  -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode" `
  -Body @{ client_id = $clientId; scope = "$org/.default offline_access" }

Write-Host ""
Write-Host "==> $($dc.message)" -ForegroundColor Cyan
Write-Host ""

$token = $null
$deadline = (Get-Date).AddSeconds([int]$dc.expires_in)
while (-not $token -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds ([int]$dc.interval)
  try {
    $resp = Invoke-RestMethod -Method Post `
      -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
      -Body @{
        grant_type = 'urn:ietf:params:oauth:grant-type:device_code'
        client_id  = $clientId
        device_code = $dc.device_code
      }
    $token = $resp.access_token
  } catch {
    $err = ($_.ErrorDetails.Message | ConvertFrom-Json).error
    if ($err -ne 'authorization_pending' -and $err -ne 'slow_down') { throw }
  }
}
if (-not $token) { throw "Device-code login timed out." }
Write-Host "Authenticated." -ForegroundColor Green

$headers = @{
  Authorization      = "Bearer $token"
  'Content-Type'     = 'application/json'
  'OData-MaxVersion' = '4.0'
  'OData-Version'    = '4.0'
  Accept             = 'application/json'
}
# Resolve the entity's LogicalName from its EntitySet name (singular vs plural
# differs per table; don't guess).
$def = Invoke-RestMethod -Method Get -Headers $headers `
  -Uri "$org/api/data/v9.2/EntityDefinitions?`$select=LogicalName&`$filter=EntitySetName eq '$entitySet'"
$entity = $def.value[0].LogicalName
if (-not $entity) { throw "Could not resolve logical name for EntitySet '$entitySet'." }
Write-Host "Resolved $entitySet -> $entity" -ForegroundColor DarkCyan
$attrUri = "$org/api/data/v9.2/EntityDefinitions(LogicalName='$entity')/Attributes"

function New-StringColumn($schema, $label, $maxLength) {
  $logical = $schema.ToLower()
  $body = @{
    '@odata.type'     = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
    AttributeType     = 'String'
    AttributeTypeName = @{ Value = 'StringType' }
    FormatName        = @{ Value = 'Text' }
    MaxLength         = $maxLength
    SchemaName        = $schema
    DisplayName       = @{ '@odata.type'='Microsoft.Dynamics.CRM.Label'; LocalizedLabels=@(@{ '@odata.type'='Microsoft.Dynamics.CRM.LocalizedLabel'; Label=$label; LanguageCode=1033 }) }
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + created {0}" -f $logical) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') {
      Write-Host ("  = {0} already exists, skipping" -f $logical) -ForegroundColor Yellow
    } else {
      Write-Host ("  ! {0} failed: {1}" -f $logical, $msg) -ForegroundColor Red
    }
  }
}

Write-Host "Adding salesperson-code column to $entity ..." -ForegroundColor Cyan
New-StringColumn 'crfdf_SalespersonCode' 'Salesperson Code' 50

# Publish so the column is immediately live for the Code App + flow.
try {
  Invoke-RestMethod -Method Post -Uri "$org/api/data/v9.2/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped (column is usable regardless)." -ForegroundColor Yellow }
