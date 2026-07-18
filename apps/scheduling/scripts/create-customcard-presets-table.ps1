<#
  Creates the saved custom-card presets table used by the "Add Job → Custom
  Card" panel:

    crfdf_customcardpreset — a named, colored, reusable custom card
                             (PTO, Holiday, Truck Maintenance, …) that users
                             save so they don't rebuild it every time.

  Presets are scoped per board family by crfdf_kind ("production" /
  "installation") so the Production and Installation panels each show their own
  saved list (built-in presets show on both). Everything else mirrors a
  CustomCardPreset in the app.

  Same device-code auth as the other create-/add- scripts (az is blocked by the
  proxy). Run it, open the printed URL, enter the code, sign in as
  asmith@lumineosigns.com. Safe to re-run: tables/columns that already exist are
  skipped.
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
  'Content-Type'     = 'application/json'
  'OData-MaxVersion' = '4.0'
  'OData-Version'    = '4.0'
  Accept             = 'application/json'
}
$base = "$org/api/data/v9.2"

function New-Label($text) {
  @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'
     LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $text; LanguageCode = 1033 }) }
}

# Create a table with its primary-name attribute (crfdf_Name). Skips if it exists.
function New-Table($schema, $displayName, $pluralName) {
  $logical = $schema.ToLower()
  try {
    Invoke-RestMethod -Method Get -Uri "$base/EntityDefinitions(LogicalName='$logical')" -Headers $headers | Out-Null
    Write-Host ("= table {0} already exists, skipping create" -f $logical) -ForegroundColor Yellow
    return
  } catch { }  # not found → create it

  $body = @{
    '@odata.type'          = 'Microsoft.Dynamics.CRM.EntityMetadata'
    SchemaName             = $schema
    DisplayName            = (New-Label $displayName)
    DisplayCollectionName  = (New-Label $pluralName)
    OwnershipType          = 'UserOwned'
    HasActivities          = $false
    HasNotes               = $false
    IsActivity             = $false
    Attributes             = @(
      @{
        '@odata.type'      = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
        AttributeType      = 'String'
        AttributeTypeName  = @{ Value = 'StringType' }
        SchemaName         = 'crfdf_Name'
        MaxLength          = 300
        IsPrimaryName      = $true
        DisplayName        = (New-Label 'Name')
      }
    )
  }
  Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions" -Headers $headers -Body ($body | ConvertTo-Json -Depth 12) | Out-Null
  Write-Host ("+ created table {0}" -f $logical) -ForegroundColor Green
}

# Add a column (String / Integer / Decimal) to a table. Skips duplicates.
function New-Column($entity, $schema, $label, $kind, $maxLen) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $logical = $schema.ToLower()
  switch ($kind) {
    'String' {
      $body = @{
        '@odata.type'     = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
        AttributeType     = 'String'
        AttributeTypeName = @{ Value = 'StringType' }
        SchemaName        = $schema
        MaxLength         = $maxLen
        DisplayName       = (New-Label $label)
      }
    }
    'Integer' {
      $body = @{
        '@odata.type'     = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'
        AttributeType     = 'Integer'
        AttributeTypeName = @{ Value = 'IntegerType' }
        SchemaName        = $schema
        MinValue          = 0
        MaxValue          = 1000000
        DisplayName       = (New-Label $label)
      }
    }
    'Decimal' {
      $body = @{
        '@odata.type'     = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
        AttributeType     = 'Decimal'
        AttributeTypeName = @{ Value = 'DecimalType' }
        SchemaName        = $schema
        Precision         = 2
        MinValue          = 0
        MaxValue          = 100000000
        DisplayName       = (New-Label $label)
      }
    }
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0}" -f $logical) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') {
      Write-Host ("  = {0} already exists, skipping" -f $logical) -ForegroundColor Yellow
    } else {
      Write-Host ("  ! {0} failed: {1}" -f $logical, $msg) -ForegroundColor Red
    }
  }
}

# --- crfdf_customcardpreset ---------------------------------------------------
Write-Host "Custom card presets table…" -ForegroundColor Cyan
New-Table 'crfdf_CustomCardPreset' 'Custom Card Preset' 'Custom Card Presets'
New-Column 'crfdf_customcardpreset' 'crfdf_Kind'              'Kind'                'String' 40
New-Column 'crfdf_customcardpreset' 'crfdf_BgColor'           'Background Color'    'String' 20
New-Column 'crfdf_customcardpreset' 'crfdf_TextColor'         'Text Color'          'String' 20
New-Column 'crfdf_customcardpreset' 'crfdf_DefaultHours'      'Default Hours'       'Decimal' 0
New-Column 'crfdf_customcardpreset' 'crfdf_LockByDefault'     'Lock By Default'     'Integer' 0
New-Column 'crfdf_customcardpreset' 'crfdf_ApplyAllByDefault' 'Apply All By Default' 'Integer' 0
New-Column 'crfdf_customcardpreset' 'crfdf_SortOrder'         'Sort Order'          'Integer' 0

# Publish so the table/columns are immediately live for the Code App.
try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped (schema is usable regardless)." -ForegroundColor Yellow }

Write-Host "Done." -ForegroundColor Cyan
