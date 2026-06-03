// Verify the BC export workbook matches the BCI + BCL shape the legacy
// Sign365 LN Estimate workbook expects.

import { describe, it, expect } from 'vitest';
import { utils } from 'xlsx';

import { buildBCExportWorkbook } from '../lib/bcExport';
import type { Project } from '../lib/engine';

const PROJECT: Project = {
  id: 'p1',
  jobNumber: 'J99999',
  jobName: 'BC export shape test',
  estimator: 'Test',
  description: '',
  pieces: [
    {
      id: 'x',
      typeId: 'freeform-tm',
      inputs: {},
      extraMaterials: [
        { itemNo: 'M1', description: 'Mat one', units: 10, unitPrice: 5, unitCost: 3, profitPct: 40 },
      ],
      extraLabor: [{ workCode: 2010, hours: 4 }],
    },
  ],
};

describe('BC export workbook', () => {
  it('has BCI and BCL sheets with the exact header order', () => {
    const { workbook } = buildBCExportWorkbook(PROJECT);
    expect(workbook.SheetNames).toEqual(['BCI', 'BCL']);
    const bciRows = utils.sheet_to_json<string[]>(workbook.Sheets['BCI'], { header: 1 });
    expect(bciRows[0]).toEqual([
      'Job Number',
      'Job Task Number',
      'Item Number',
      'Item Description',
      'Unit Cost',
      'Profit %',
      'Unit Price',
      ' Quantity ',
    ]);
    expect(bciRows[1]).toEqual(['J99999', '3030', 'M1', 'Mat one', 3, 40, 5, 10]);

    const bclRows = utils.sheet_to_json<(string | number)[]>(workbook.Sheets['BCL'], { header: 1 });
    expect(bclRows[0]).toEqual(['Job Number', 'Task / Resource Number', 'Run Time']);
    expect(bclRows[1]).toEqual(['J99999', 2010, 4]);
  });

  it('applies a custom task number when supplied', () => {
    const { workbook } = buildBCExportWorkbook(PROJECT, { taskNumber: '4040' });
    const bciRows = utils.sheet_to_json<string[]>(workbook.Sheets['BCI'], { header: 1 });
    expect(bciRows[1][1]).toBe('4040');
  });
});
