# Dataverse — Sign Specifications table

The Power Apps Code app writes saved specs back to the **Sign Specifications**
Dataverse table. The table must exist in the target environment before
`pac code push` — the code app declares the binding in `power.config.json`
under `tables[].logicalName = lum_signspecification`.

These 31 fields are sourced from [ALE-32](https://linear.app/lumineosigns/issue/ALE-32/create-dataverse-table-sign-specifications-31-fields)
and mirrored in `app/src/domain/SignSpec.ts`.

| Display name           | Logical name              | Type             | Notes |
| ---------------------- | ------------------------- | ---------------- | ----- |
| Product Code           | lum_productcode           | Single line text | Primary name |
| Customer Name          | lum_customername          | Single line text | |
| Project Name           | lum_projectname           | Single line text | |
| Quantity               | lum_quantity              | Whole number     | Default 1 |
| Sign Type Code         | lum_signtypecode          | Single line text | 2-letter (WC, MN, FL…) |
| Sign Type Name         | lum_signtypename          | Single line text | Denormalised for reports |
| Face Type Code         | lum_facetypecode          | Single line text | |
| Finish Code            | lum_finishcode            | Single line text | |
| Vinyl Code             | lum_vinylcode             | Single line text | CV / DV / FX / NV |
| Vinyl Color            | lum_vinylcolor            | Single line text | Full display string |
| Vinyl Hex              | lum_vinylhex              | Single line text | For dashboard preview |
| Mounting Code          | lum_mountingcode          | Single line text | |
| LED Color Code         | lum_ledcolorcode          | Single line text | WH / RD / BL / GR / RGB |
| Faces                  | lum_faces                 | Single line text | SF / DF / NA |
| Illumination           | lum_illumination          | Single line text | IL / EL / NI |
| Height (in)            | lum_heightin              | Decimal          | |
| Width (in)             | lum_widthin               | Decimal          | |
| Depth (in)             | lum_depthin               | Decimal          | |
| Paint Color            | lum_paintcolor            | Single line text | PMS / Pantone reference |
| Backer Type            | lum_backertype            | Single line text | FP / PT / CU |
| Backer Color           | lum_backercolor           | Single line text | |
| Pole Type              | lum_poletype              | Single line text | MN/PS/PP only |
| Pole Diameter          | lum_polediameter          | Single line text | |
| Pole Material          | lum_polematerial          | Single line text | |
| Footing Type           | lum_footingtype           | Single line text | |
| Footing Depth (in)     | lum_footingdepth          | Single line text | Depth in inches, free text |
| Footing Method         | lum_footingmethod         | Single line text | |
| Electrical             | lum_electrical            | Single line text | |
| Conduit Size           | lum_conduitsize           | Single line text | |
| Panel Location         | lum_panellocation         | Single line text | Free text — e.g. "Exterior NE corner" |
| Departments            | lum_departments           | Single line text | Routing label, auto-calculated |
| Outsourced             | lum_outsourced            | Two options      | false default |
| Notes                  | lum_notes                 | Multiline text   | |
| Status                 | lum_status                | Whole number     | 100000000 = Draft on create |

## How the code app talks to the table

`app/src/data/dataverseService.ts` exports a `SignSpecRepo` interface with
`list / save / load / remove`. In dev it's backed by `localStorage`; once the
Power Apps SDK client is wired (after `pac code init`), swap the
`signSpecs` export to a `DataverseSignSpecRepo` that calls
`window.PowerProvider.tables.SignSpecifications` (the alias set in
`power.config.json`). Components don't change.
