export const BC_TENANT_ID   = import.meta.env.VITE_BC_TENANT_ID   ?? '';
export const BC_ENVIRONMENT = import.meta.env.VITE_BC_ENVIRONMENT ?? 'PRODUCTION';
export const BC_COMPANY_ID  = import.meta.env.VITE_BC_COMPANY_ID  ?? '';
export const BC_CLIENT_ID   = import.meta.env.VITE_BC_CLIENT_ID   ?? '';
export const BC_CLIENT_SECRET = import.meta.env.VITE_BC_CLIENT_SECRET ?? '';

export const BC_BASE_URL = `https://api.businesscentral.dynamics.com/v2.0/${BC_TENANT_ID}/${BC_ENVIRONMENT}/api/v2.0`;
export const BC_TOKEN_URL = `https://login.microsoftonline.com/${BC_TENANT_ID}/oauth2/v2.0/token`;
export const BC_SCOPE = 'https://api.businesscentral.dynamics.com/.default';

// Sort order → production stage name
export const BC_SORT_ORDER_MAP: Record<number, string> = {
  0:  'Production',
  1:  'New Order This Week',
  2:  'Upcoming Manufacturing',
  3:  'Manufacturing Ready for Planning',
  4:  'Job Purchasing',
  5:  'Substrate Cut/Prep',
  6:  'Routing',
  7:  'Fabrication',
  8:  'Painting',
  9:  'Assembly Wiring',
  10: 'Face Production',
  11: 'Vinyl',
  12: 'Final Assembly',
  13: 'Final Inspection',
  14: 'Crating',
};

// Planning area GUID used to filter project planning lines to LNI production
export const BC_PLANNING_AREA_ID = '{BF0F1D95-8BFB-48E1-B652-8C63DD5B24B6}';
