export const VIEW_COLS: Record<string, string[]> = {
  'LNI Master':        ['job','status','process','priority','region','sales','signType','orderDate','scheduledInstall','value','dip','readyInstall','vendor','vendorStatus'],
  'OPS / MFG':         ['job','status','mfgRegion','routingType','graphics','metal','assembly','plex','paintPrep','materialCut','orderDate','mfgTargetMod','redDate','totalMfg','mfgNotes'],
  'OPS / Install':     ['job','status','installRegion','installArea','scheduledInstall','readyInstall','powerlines','locates','sales','dip','notes'],
  'WK Master':         ['job','status','process','priority','sales','signType','orderDate','scheduledInstall','value','dip','readyInstall','vendor','vendorStatus'],
  'NEK Master':        ['job','status','process','priority','sales','signType','orderDate','scheduledInstall','value','dip','readyInstall','vendor','vendorStatus'],
  'Vinyl & Graphics':  ['job','status','graphics','routingType','vendorStatus','orderDate','mfgTargetMod','notes'],
  'Metal Fab Team':    ['job','status','metal','routingType','steelHrs','orderDate','redDate','mfgNotes'],
  'Paint Team':        ['job','status','paintPrep','paintPrepHrs','paintHrs','orderDate','mfgTargetMod','mfgNotes'],
  'Assembly Team':     ['job','status','assembly','plex','paintPrep','materialCut','orderDate','mfgTargetMod','mfgNotes'],
  'WK Expeditor Alex': ['job','status','process','priority','region','sales','orderDate','expeditor','scheduledInstall','mfgFinalDate','value','dip','vendor','vendorStatus','dateToAdmin','dateInstalled','notes'],
  'WK Install View':   ['job','status','installArea','scheduledInstall','readyInstall','powerlines','locates','sales','dip'],
  'Miguel - Routing':  ['job','status','routingType','graphics','routingHrs','orderDate','redDate','mfgNotes'],
  'Warehouse Coord.':  ['job','status','storageLocation','vendorStatus','vendorShipDate','vendor','notes'],
  'Mfg Summary Print': ['job','status','signType','mfgRegion','orderDate','mfgTargetMod','redDate','totalMfg','totalInstall','value'],
};

export const VIEW_NAMES = Object.keys(VIEW_COLS) as (keyof typeof VIEW_COLS)[];

// Views that get a print icon instead of the default grid icon
export const PRINT_VIEWS = new Set(['Mfg Summary Print']);

// Sidebar dividers: group name → views shown below it
export const VIEW_GROUPS: { label?: string; views: string[] }[] = [
  { label: 'Master', views: ['LNI Master','OPS / MFG','OPS / Install','WK Master','NEK Master'] },
  { label: 'Team', views: ['Vinyl & Graphics','Metal Fab Team','Paint Team','Assembly Team'] },
  { label: 'Individual', views: ['WK Expeditor Alex','WK Install View','Miguel - Routing','Warehouse Coord.','Mfg Summary Print'] },
];
