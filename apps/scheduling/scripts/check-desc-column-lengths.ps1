<#
  Read-only diagnostic: prints the AttributeType + MaxLength of the text columns
  that group-card payloads (grp:v1:{...json...}) are packed into, so we can tell
  whether a group card can overflow the column and get truncated on save
  (which would make its member jobs vanish on reload).

  Columns checked:
    crfdf_installcard          . crfdf_notes                     (Installation board cards)
    crfdf_productionscheduleline . crfdf_planninglinedescription (Production board lines)
    crfdf_jobqueueitem         . crfdf_description               (Job Queue items, for reference)

  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  Nothing is written — this only reads metadata.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'   # Azure CLI public client (device-code capable)

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
        grant_type  = 'urn:ietf:params:oauth:grant-type:device_code'
        client_id   = $clientId
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
  'OData-MaxVersion' = '4.0'
  'OData-Version'    = '4.0'
  Accept             = 'application/json'
}

function Get-ColumnLength($entity, $attr) {
  # First read the base attribute to learn its type (String vs Memo vs other).
  $base = Invoke-RestMethod -Method Get -Headers $headers `
    -Uri "$org/api/data/v9.2/EntityDefinitions(LogicalName='$entity')/Attributes(LogicalName='$attr')?`$select=LogicalName,AttributeType"
  $type = $base.AttributeType
  $cast = switch ($type) {
    'String' { 'Microsoft.Dynamics.CRM.StringAttributeMetadata' }
    'Memo'   { 'Microsoft.Dynamics.CRM.MemoAttributeMetadata' }
    default  { $null }
  }
  if (-not $cast) {
    Write-Host ("  {0}.{1}  ->  type={2} (not a text column)" -f $entity, $attr, $type) -ForegroundColor Yellow
    return
  }
  $meta = Invoke-RestMethod -Method Get -Headers $headers `
    -Uri "$org/api/data/v9.2/EntityDefinitions(LogicalName='$entity')/Attributes(LogicalName='$attr')/$cast`?`$select=LogicalName,MaxLength,Format"
  $len = $meta.MaxLength
  $color = if ($len -ge 2000) { 'Green' } elseif ($len -ge 500) { 'Yellow' } else { 'Red' }
  Write-Host ("  {0}.{1}  ->  type={2}  MaxLength={3}  Format={4}" -f $entity, $attr, $type, $len, $meta.Format) -ForegroundColor $color
}

Write-Host ""
Write-Host "Group-card payload columns (want MaxLength >= 2000):" -ForegroundColor Cyan
Get-ColumnLength 'crfdf_installcard'           'crfdf_notes'
Get-ColumnLength 'crfdf_productionscheduleline' 'crfdf_planninglinedescription'
Get-ColumnLength 'crfdf_jobqueueitem'          'crfdf_description'
Write-Host ""
Write-Host "Red = too small (a group card with members will truncate on save)." -ForegroundColor DarkGray
Write-Host "Done." -ForegroundColor Cyan
