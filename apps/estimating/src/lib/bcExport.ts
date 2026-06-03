// Business Central export — turns a Project into a downloadable .xlsx that
// matches the BCI + BCL import shape used by the original workbook.
//
// BCI columns: Job Number, Job Task Number, Item Number, Item Description,
//              Unit Cost, Profit %, Unit Price,  Quantity
// BCL columns: Job Number, Task / Resource Number, Run Time
//
// (Spaces / capitalisation chosen to match the workbook headers exactly.)

import { utils, writeFile, type WorkBook } from 'xlsx';

import { aggregateForBC, type BCExport, type Project, type ComputedProject } from './engine';

const BCI_HEADERS = [
  'Job Number',
  'Job Task Number',
  'Item Number',
  'Item Description',
  'Unit Cost',
  'Profit %',
  'Unit Price',
  ' Quantity ',
] as const;

const BCL_HEADERS = ['Job Number', 'Task / Resource Number', 'Run Time'] as const;

export function buildBCExportWorkbook(
  project: Project | ComputedProject,
  options?: { taskNumber?: string }
): { workbook: WorkBook; aggregate: BCExport } {
  const aggregate = aggregateForBC(project, options);

  const bciRows = aggregate.bci.map(r => [
    r.jobNumber,
    r.taskNumber,
    r.itemNumber,
    r.description,
    r.unitCost,
    r.profitPct,
    r.unitPrice,
    r.quantity,
  ]);
  const bciSheet = utils.aoa_to_sheet([BCI_HEADERS as unknown as string[], ...bciRows]);

  const bclRows = aggregate.bcl.map(r => [r.jobNumber, r.resourceNumber, r.runTime]);
  const bclSheet = utils.aoa_to_sheet([BCL_HEADERS as unknown as string[], ...bclRows]);

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, bciSheet, 'BCI');
  utils.book_append_sheet(workbook, bclSheet, 'BCL');
  return { workbook, aggregate };
}

/** Trigger a browser download of the BCI+BCL workbook for `project`. */
export function downloadBCExport(
  project: Project | ComputedProject,
  options?: { taskNumber?: string; filename?: string }
): BCExport {
  const { workbook, aggregate } = buildBCExportWorkbook(project, options);
  const jobNumber =
    'project' in project ? project.project.jobNumber : (project as Project).jobNumber;
  const filename = options?.filename ?? `${jobNumber || 'estimate'}-BC-export.xlsx`;
  writeFile(workbook, filename);
  return aggregate;
}
