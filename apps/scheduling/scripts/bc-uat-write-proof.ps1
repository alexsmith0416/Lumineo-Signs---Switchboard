<#
  bc-uat-write-proof.ps1 — Does the sign365 UAT API actually accept writes?

  Re-verifies the three defects in Infotech's 9.11.26 collection and proves
  whether our Entra app can write. Target is J25036 "TEST OPPORTUNITY INFOTECH
  - do not use" — Infotech's own sandbox job. The one real write is a
  description change that is READ FIRST and RESTORED at the end.

  Read-only except that single round trip. Run:
      pwsh -File scripts/bc-uat-write-proof.ps1
#>
$envf = "C:\Users\Alex\OneDrive - Luminous Neon, Inc\Documents\Alex Smith - Lumineo Files\Lumineo Signs Switchboard\Postman\UAT\UAT.postman_environment - Copy.json"
$m = @{}; (Get-Content $envf -Raw | ConvertFrom-Json).values | ForEach-Object { $m[$_.key] = $_.value }
$tok = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$($m.tenant)/oauth2/v2.0/token" -Body @{
  grant_type='client_credentials'; client_id=$m.clientid; client_secret=$m.clientsecret
  scope='https://api.businesscentral.dynamics.com/.default' }).access_token
$base = "https://api.businesscentral.dynamics.com/v2.0/$($m.tenant)/$($m.environment)/api/infotechConsultingGroup/sign365/v1.0/companies(4738bfb5-a06d-ec11-bf27-000d3a132a9e)"
$h  = @{ Authorization = "Bearer $tok"; 'If-Match' = '*'; 'Content-Type' = 'application/json' }
$hg = @{ Authorization = "Bearer $tok" }
$JOB = 'J25036'

$orig = Invoke-RestMethod -Uri "$base/jobs('$JOB')" -Headers $hg
"BEFORE  no=$($orig.no)  description='$($orig.description)'  status=$($orig.status)"
""
"===== TEST A: their sample URL form  jobs(<guid>)  — expect failure, key is 'no'"
try { Invoke-RestMethod -Method Patch -Uri "$base/jobs(31ff7c4f-2817-f111-8405-7ced8dd80187)" -Headers $h -Body '{"orderedBy":"yipee"}' | Out-Null; "  UNEXPECTED 200" }
catch { "  FAILS: " + ($_.ErrorDetails.Message -replace '\s+',' ') }
""
"===== TEST B: correct key, their sample BODY {orderedBy} — expect failure, field absent"
try { Invoke-RestMethod -Method Patch -Uri "$base/jobs('$JOB')" -Headers $h -Body '{"orderedBy":"yipee"}' | Out-Null; "  UNEXPECTED 200" }
catch { "  FAILS: " + ($_.ErrorDetails.Message -replace '\s+',' ') }
""
"===== TEST C: correct key + real field — THE question: can we write at all?"
$marker = "WRITE-TEST $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
try {
  $res = Invoke-RestMethod -Method Patch -Uri "$base/jobs('$JOB')" -Headers $h -Body (@{description=$marker} | ConvertTo-Json -Compress)
  "  PATCH accepted. returned description='$($res.description)'"
  $after = Invoke-RestMethod -Uri "$base/jobs('$JOB')" -Headers $hg
  "  RE-READ description='$($after.description)'  -> PERSISTED: $($after.description -eq $marker)"
} catch { "  FAILS: " + ($_.ErrorDetails.Message -replace '\s+',' ') }
""
"===== TEST D: PATCH a planning STEP — the entity we actually need. Expect read-only refusal."
$s = (Invoke-RestMethod -Uri "$base/projectPlanningSteps?`$top=1" -Headers $hg).value[0]
$su = "$base/projectPlanningSteps(auxiliaryIndex1=$($s.auxiliaryIndex1),auxiliaryIndex2='$($s.auxiliaryIndex2)',auxiliaryIndex3=$($s.auxiliaryIndex3))"
try { Invoke-RestMethod -Method Patch -Uri $su -Headers $h -Body '{"assignedTo":"TEST"}' | Out-Null; "  UNEXPECTED 200" }
catch { "  FAILS: " + ($_.ErrorDetails.Message -replace '\s+',' ') }
""
"===== RESTORE"
try {
  Invoke-RestMethod -Method Patch -Uri "$base/jobs('$JOB')" -Headers $h -Body (@{description=$orig.description} | ConvertTo-Json -Compress) | Out-Null
  $fin = Invoke-RestMethod -Uri "$base/jobs('$JOB')" -Headers $hg
  "  AFTER   description='$($fin.description)'  -> RESTORED: $($fin.description -eq $orig.description)"
} catch { "  RESTORE FAILED — set description back to: '$($orig.description)'" }
""
"NOTE: deliberately does NOT PATCH projectPlanningLines — its key is ambiguous"
"      across ~14,030 rows, so a write there would hit an arbitrary row."
