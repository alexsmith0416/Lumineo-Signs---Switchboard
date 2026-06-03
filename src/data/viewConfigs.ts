export const VIEW_COLS: Record<string, string[]> = {
  'LNI Master':        ['job','status','process','priority','region','sales','signType','orderDate','scheduledInstall','value','dip','readyInstall','vendor','vendorStatus'],
  'OPS / MFG':         ['job','status','mfgRegion','routingType','graphics','metal','assembly','plex','paintPrep','materialCut','orderDate','mfgTargetMod','redDate','totalMfg','mfgNotes'],
  'OPS / Install':     ['job','status','installRegion','installArea','scheduledInstall','readyInstall','powerlines','locates','sales','dip','notes'],
  'WK Master':         ['job','status','process','priority','sales','signType','orderDate','scheduledInstall','value','dip','readyInstall','vendor','vendorStatus'],
  'NEK Master':        ['job','status','process','priority','sales','signType','orderDate','scheduledInstall','value','dip','readyInstall','vendor','vendorStatus'],

  // Team views — columns match Airtable CSV export order
  'Vinyl & Graphics':  ['job','sketch','description','status','mfgFinalDate','priority','redDate','routingType','materialCut','metal','paintPrep','assembly','plex','vinylProd','graphics','cutVinylColor'],
  'Metal Fab Team':    ['job','description','status','mfgFinalDate','mfgTargetMod','priority','redDate','notes','routingType','materialCut','metal','paintPrep','assembly','plex','vinylProd'],
  'Paint Team':        ['job','description','status','notes','mfgFinalDate','billDayJob','priority','redDate','materialCut','metal','paintPrep','assembly','plex','vinylProd'],
  'Assembly Team':     ['job','description','status','mfgFinalDate','priority','redDate','notes','materialCut','metal','paintPrep','assembly','plex','vinylProd'],

  // Individual / Expeditor views
  'WK Expeditor Alex': ['job','status','sketch','orderDate','mfgFinalDate','mfgTargetMod','sales','location','region','description','priority','redDate','notes','powerlines','dateToHold','dateOffHold','expeditor','dateInstalled','dateToAdmin','vendor','po','vendorStatus','storageLocation','vendorShipDate','vendorShipDate2','outsourcedArrival','graphics','cutVinylColor','materialCut','routingType','routingHrs','metal','paintPrep','plex','assembly','vinylProd','ulSign','process','mfgRegion','installRegion','paintPrepDueMod','value'],
  'WK Expeditor AO':   ['job','sales','location','region','description','sketch','priority','redDate','status','notes','powerlines','orderDate','expeditor','mfgTarget','mfgTargetMod','vendor','po','vendorStatus','vendorShipDate','vendorShipDate2','outsourcedArrival','graphics','materialCut','routingType','routingHrs','metal','paintPrep','plex','assembly','vinylProd','ulSign','value','process','mfgRegion','installRegion'],
  'WK Install View':   ['job','status','location','region','sales','sketch','description','priority','redDate','notes','ulSign','mfgTargetMod','scheduledInstall','readyInstall','powerlines','locates','orderDate','mfgTarget','installTarget','dateInstalled','dateToAdmin','vendor','po','vendorShipDate','vendorShipDate2','vendorStatus','storageLocation','outsourcedArrival','routingOrdered','steelHrs','installHrs','travelHrs','value','dip','installRegion','routingHrs'],
  'Miguel - Routing':  ['job','status','description','mfgFinalDate','priority','redDate','routingType','materialCut','metal','paintPrep','assembly','plex','vinylProd'],
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
  { label: 'Individual', views: ['WK Expeditor Alex','WK Expeditor AO','WK Install View','Miguel - Routing','Warehouse Coord.','Mfg Summary Print'] },
];
