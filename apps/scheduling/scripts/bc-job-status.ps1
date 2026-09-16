<#
  bc-job-status.ps1 — READ-ONLY. Prints a BC job's completion fields on the
  sign365 UAT API, to check BCPush_JobCompletion before/after a push.
      pwsh -File scripts/bc-job-status.ps1 -JobNo J25036
  Uses the app registration from the UAT Postman environment (no sign-in).
#>
param([string]$JobNo = 'J25036')
$envf = "C:\Users\Alex\OneDrive - Luminous Neon, Inc\Documents\Alex Smith - Lumineo Files\Lumineo Signs Switchboard\Postman\UAT\UAT.postman_environment - Copy.json"
$m = @{}; (Get-Content $envf -Raw | ConvertFrom-Json).values | ForEach-Object { $m[$_.key] = $_.value }
$tok = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$($m.tenant)/oauth2/v2.0/token" -Body @{
  grant_type='client_credentials'; client_id=$m.clientid; client_secret=$m.clientsecret
  scope='https://api.businesscentral.dynamics.com/.default' }).access_token
$base = "https://api.businesscentral.dynamics.com/v2.0/$($m.tenant)/$($m.environment)/api/infotechConsultingGroup/sign365/v1.0/companies(4738bfb5-a06d-ec11-bf27-000d3a132a9e)"
$j = Invoke-RestMethod -Uri "$base/jobs('$JobNo')" -Headers @{ Authorization = "Bearer $tok" }
"{0}  complete={1}  icgSgpCompletionDate={2}  status={3}  description='{4}'" -f $j.no, $j.complete, $j.icgSgpCompletionDate, $j.status, $j.description
