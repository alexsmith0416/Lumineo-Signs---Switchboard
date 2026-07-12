# BC mirror table schemas (authoritative)

Extracted from the Default Solution export (`Cr020d3`, env `484cdd3c…`), July 2026.
These are the real column logical names on the `crfdf_bc*` staging tables. The
scheduler reads these in `apps/scheduling/src/services/dataverse-live.ts`.

## crfdf_bcjob (job headers) — key: `crfdf_jobnumber`

Business columns: `crfdf_jobnumber`, `crfdf_appjobname`, `crfdf_customername`,
`crfdf_description`, `crfdf_BilltoCustomerNo` (logical `crfdf_billtocustomerno`),
`crfdf_promiseddate`, `crfdf_remainingbalance`, `crfdf_status`,
`crfdf_salesdocumentno`, `crfdf_saleslinefound`, `crfdf_saleslinedescription`,
`crfdf_saleslinesselltono`, `crfdf_shiptoaddress`, `crfdf_shiptocity`,
`crfdf_shiptostate`, `crfdf_shiptozip`.

- **No `crfdf_jobno` column exists here** — the header job-no is `crfdf_jobnumber`.
- **`crfdf_customername` currently holds the job DESCRIPTION, not the customer.**
  Real customer name is joined from `crfdf_bccustomer` via `crfdf_billtocustomerno`.

## crfdf_bcplanningline — key: `crfdf_jobno`

Business columns: `crfdf_jobno` (populated), `crfdf_jobnumber` (EMPTY),
`crfdf_no` (EMPTY), `crfdf_resourceno` (populated), `crfdf_estimatedhours` (EMPTY),
`crfdf_quantity` (populated = hours), `crfdf_description`, `crfdf_jobtaskno`,
`crfdf_lineno`, `crfdf_linetype`, `crfdf_type`, `crfdf_planningdate`,
`crfdf_totalprice`, `crfdf_bckey`.

- Join to job header is value-based: `bcplanningline.crfdf_jobno == bcjob.crfdf_jobnumber`.

## crfdf_bcbillingline — key: `crfdf_jobnumber` (app reads this)

Business columns: `crfdf_jobno`, `crfdf_jobnumber`, `crfdf_jobtaskno`,
`crfdf_amount`, `crfdf_invoicedamount`, `crfdf_remainingamount`, `crfdf_totalprice`,
`crfdf_billdate`, `crfdf_planningdate`, `crfdf_description`, `crfdf_lineno`,
`crfdf_bckey`. (Both jobno columns exist; confirm which the flow fills.)

## crfdf_bccustomer — key: `crfdf_customerno`

Business columns: `crfdf_customerno`, `crfdf_customername`, `crfdf_addressline1`,
`crfdf_city`, `crfdf_state`, `crfdf_postalcode`, `crfdf_country`, `crfdf_email`,
`crfdf_phone`, `crfdf_salespersoncode`.

## Empty/wrong columns to fix in the sync flow(s)

| Table | Column | State | Fix in flow |
|---|---|---|---|
| crfdf_bcjob | crfdf_customername | = description | map real bill-to customer name |
| crfdf_bcplanningline | crfdf_jobnumber | empty | populate (consistent join key) OR drop the column |
| crfdf_bcplanningline | crfdf_no | empty | populate line "No." OR drop |
| crfdf_bcplanningline | crfdf_estimatedhours | empty | populate hours OR drop (app uses crfdf_quantity) |

The safest root fix is usually: standardize the job-no column name across tables
and map the customer name correctly; the duplicate `crfdf_no`/`crfdf_estimatedhours`
columns can either be filled or removed to stop the ambiguity.
