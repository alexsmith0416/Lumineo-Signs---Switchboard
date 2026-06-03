export type BadgeColor = 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'yellow' | 'gray' | 'navy';

export const COLOR_MAP: Record<BadgeColor, { bg: string; text: string }> = {
  green:  { bg: '#D2F5D2', text: '#1a6b1a' },
  red:    { bg: '#FFC8C8', text: '#8a0000' },
  orange: { bg: '#FFE6C8', text: '#7a4000' },
  blue:   { bg: '#BEDCFF', text: '#003a70' },
  purple: { bg: '#DCD2FF', text: '#3a0070' },
  yellow: { bg: '#FFD699', text: '#5a3a00' },
  gray:   { bg: '#F5F5F5', text: '#605E5C' },
  navy:   { bg: '#141464', text: '#FFFFFF' },
};

export const STATUS_COLORS: Record<string, BadgeColor> = {
  'Manufacturing':              'orange',
  'Active':                     'blue',
  'Complete Invoiced':          'green',
  'Complete to Admin':          'green',
  'Installation':               'blue',
  'Hold - Customer':            'yellow',
  'Hold - Permit':              'yellow',
  'Hold - Local':               'yellow',
  'Hold - Product Ready':       'yellow',
  'MFG - Assembly':             'orange',
  'MFG - Routing':              'orange',
  'MFG - Vinyl Application':    'orange',
  'MFG - Paint Prep / Paint':   'orange',
  'MFG - Assembly & Graphics':  'orange',
  'MFG - Need Material Cut':    'orange',
  'MFG - Vinyl Cut':            'orange',
  'MFG - Vinyl Install':        'orange',
  'Steel MFG':                  'purple',
  'Service or Contract Order':  'red',
  'New Order this week':        'blue',
  'Upcoming Mfg.':              'orange',
  'Subcontracted':              'gray',
  'Outsourced - Vendor':        'gray',
  'NEK - Production':           'blue',
  'Needs Shipped':              'purple',
  'End of Active Work':         'gray',
  'Refurb - Awaiting Removal':  'orange',
  'Billboards':                 'gray',
  'Surveys':                    'gray',
};

export const VENDOR_STATUS_COLORS: Record<string, BadgeColor> = {
  'ORDERED':           'blue',
  'SHIPPING':          'yellow',
  'RECEIVED':          'green',
  'ON HOLD':           'red',
  'Ready to Pick Up':  'orange',
  'SHIPPED':           'blue',
  'Artwork Approved':  'green',
  'Delayed':           'red',
};

export const PROCESS_COLORS: Record<string, BadgeColor> = {
  'Invoiced':              'green',
  'Hold':                  'yellow',
  'Completed':             'green',
  'Upcoming':              'purple',
  'NEK In Process':        'blue',
  'Service Complete':      'green',
  'Service Invoiced':      'green',
  'Service Hold':          'yellow',
  'Complete Need Paperwork': 'orange',
};

export const READY_INSTALL_COLORS: Record<string, BadgeColor> = {
  'YES':              'green',
  'NO':               'red',
  'Survey needed':    'yellow',
  'Survey Complete':  'green',
  'Ready for Install':'green',
  'N/A':              'gray',
  '?':                'gray',
  'Scheduled':        'blue',
};

export const DEPOSIT_COLORS: Record<string, BadgeColor> = {
  'YES':        'green',
  'NO':         'red',
  'in process': 'yellow',
};

export const REGION_COLORS: Record<string, BadgeColor> = {
  'WK':         'blue',
  'NEK':        'purple',
  'DODGE CITY': 'orange',
};

export const PRIORITY_COLORS: Record<string, BadgeColor> = {
  'RED DATE': 'red',
  'Rush':     'orange',
};

export const STAGE_COLORS: Record<string, BadgeColor> = {
  '/': 'green',
  'X': 'red',
};

export function getBadgeColor(field: string, value: string): BadgeColor {
  if (field === 'status')       return STATUS_COLORS[value] ?? 'gray';
  if (field === 'vendorStatus') return VENDOR_STATUS_COLORS[value] ?? 'gray';
  if (field === 'process')      return PROCESS_COLORS[value] ?? 'gray';
  if (field === 'readyInstall') return READY_INSTALL_COLORS[value] ?? 'gray';
  if (field === 'deposit')      return DEPOSIT_COLORS[value] ?? 'gray';
  if (field === 'priority')     return PRIORITY_COLORS[value] ?? 'blue';
  if (['region','mfgRegion','installRegion'].includes(field)) return REGION_COLORS[value] ?? 'gray';
  if (['metal','assembly','plex','paintPrep','materialCut'].includes(field)) return STAGE_COLORS[value] ?? 'gray';
  return 'gray';
}
