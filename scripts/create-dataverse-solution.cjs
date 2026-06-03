// Generates a Dataverse unmanaged solution ZIP with:
//   - lni_productionschedule  (40+ columns)
//   - lni_userviewpreferences (4 columns)
// Then imports it via pac solution import.
//
// Format derived from actual Dataverse solution export of crfdf_Department1 entity.
//
// Usage: node scripts/create-dataverse-solution.cjs

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT_DIR  = path.join(__dirname, '../.dataverse-solution');
const ZIP_PATH = path.join(__dirname, '../LNIProductionSchedule_solution.zip');
const PAC      = 'C:\\Users\\Alex\\AppData\\Local\\Microsoft\\PowerAppsCLI\\pac.cmd';

// ── Attribute XML builders ────────────────────────────────────────────────────
// Format matches actual Dataverse export:
//   - Type: nvarchar / memo / datetime / money / decimal / bit
//   - DisplayMask uses PrimaryName flag for primary attribute
//   - displaynames uses lowercase (attribute level)
//   - RequiredLevel: none / required

function primaryAttr(name, label, maxLen = 100) {
  // Identified as primary by PrimaryName in DisplayMask — confirmed from Dataverse export
  return `
        <attribute PhysicalName="${toPascalCase(name)}">
          <Type>nvarchar</Type>
          <Name>${name}</Name>
          <LogicalName>${name}</LogicalName>
          <RequiredLevel>none</RequiredLevel>
          <DisplayMask>PrimaryName|ValidForAdvancedFind|ValidForForm|ValidForGrid|RequiredForForm</DisplayMask>
          <ImeMode>auto</ImeMode>
          <Format>text</Format>
          <MaxLength>${maxLen}</MaxLength>
          <displaynames><displayname description="${label}" languagecode="1033" /></displaynames>
          <Descriptions><Description description="" languagecode="1033" /></Descriptions>
        </attribute>`;
}

function stringAttr(name, label, maxLen = 500) {
  return `
        <attribute PhysicalName="${toPascalCase(name)}">
          <Type>nvarchar</Type>
          <Name>${name}</Name>
          <LogicalName>${name}</LogicalName>
          <RequiredLevel>none</RequiredLevel>
          <DisplayMask>ValidForAdvancedFind|ValidForForm|ValidForGrid</DisplayMask>
          <ImeMode>auto</ImeMode>
          <Format>text</Format>
          <MaxLength>${maxLen}</MaxLength>
          <displaynames><displayname description="${label}" languagecode="1033" /></displaynames>
          <Descriptions><Description description="" languagecode="1033" /></Descriptions>
        </attribute>`;
}

function memoAttr(name, label, maxLen = 4000) {
  // Long-text field stored as nvarchar — solution XML doesn't support a separate memo type
  return `
        <attribute PhysicalName="${toPascalCase(name)}">
          <Type>nvarchar</Type>
          <Name>${name}</Name>
          <LogicalName>${name}</LogicalName>
          <RequiredLevel>none</RequiredLevel>
          <DisplayMask>ValidForAdvancedFind|ValidForForm|ValidForGrid</DisplayMask>
          <ImeMode>auto</ImeMode>
          <Format>text</Format>
          <MaxLength>${maxLen}</MaxLength>
          <displaynames><displayname description="${label}" languagecode="1033" /></displaynames>
          <Descriptions><Description description="" languagecode="1033" /></Descriptions>
        </attribute>`;
}

function dateAttr(name, label) {
  // Format=dateonly + DateTimeBehavior=DateOnly is the correct form for date-only fields
  return `
        <attribute PhysicalName="${toPascalCase(name)}">
          <Type>datetime</Type>
          <Name>${name}</Name>
          <LogicalName>${name}</LogicalName>
          <RequiredLevel>none</RequiredLevel>
          <DisplayMask>ValidForAdvancedFind|ValidForForm|ValidForGrid</DisplayMask>
          <ImeMode>auto</ImeMode>
          <Format>date</Format>
          <DateTimeBehavior>DateOnly</DateTimeBehavior>
          <displaynames><displayname description="${label}" languagecode="1033" /></displaynames>
          <Descriptions><Description description="" languagecode="1033" /></Descriptions>
        </attribute>`;
}

function moneyAttr(name, label) {
  return `
        <attribute PhysicalName="${toPascalCase(name)}">
          <Type>money</Type>
          <Name>${name}</Name>
          <LogicalName>${name}</LogicalName>
          <RequiredLevel>none</RequiredLevel>
          <DisplayMask>ValidForAdvancedFind|ValidForForm|ValidForGrid</DisplayMask>
          <ImeMode>disabled</ImeMode>
          <Precision>2</Precision>
          <PrecisionSource>0</PrecisionSource>
          <MinValue>0</MinValue>
          <MaxValue>10000000</MaxValue>
          <displaynames><displayname description="${label}" languagecode="1033" /></displaynames>
          <Descriptions><Description description="" languagecode="1033" /></Descriptions>
        </attribute>`;
}

function decimalAttr(name, label) {
  return `
        <attribute PhysicalName="${toPascalCase(name)}">
          <Type>decimal</Type>
          <Name>${name}</Name>
          <LogicalName>${name}</LogicalName>
          <RequiredLevel>none</RequiredLevel>
          <DisplayMask>ValidForAdvancedFind|ValidForForm|ValidForGrid</DisplayMask>
          <ImeMode>disabled</ImeMode>
          <Precision>2</Precision>
          <MinValue>0</MinValue>
          <MaxValue>10000</MaxValue>
          <displaynames><displayname description="${label}" languagecode="1033" /></displaynames>
          <Descriptions><Description description="" languagecode="1033" /></Descriptions>
        </attribute>`;
}

function boolAttr(name, label) {
  // Two-options field — bit type with no explicit option set (Dataverse creates it automatically)
  return `
        <attribute PhysicalName="${toPascalCase(name)}">
          <Type>bit</Type>
          <Name>${name}</Name>
          <LogicalName>${name}</LogicalName>
          <RequiredLevel>none</RequiredLevel>
          <DisplayMask>ValidForAdvancedFind|ValidForForm|ValidForGrid</DisplayMask>
          <DefaultValue>0</DefaultValue>
          <displaynames><displayname description="${label}" languagecode="1033" /></displaynames>
          <Descriptions><Description description="" languagecode="1033" /></Descriptions>
        </attribute>`;
}

// Convert lni_some_field → lni_SomeField for PhysicalName
function toPascalCase(logicalName) {
  return logicalName.replace(/_([a-z])/g, (_, c) => '_' + c.toUpperCase())
                    .replace(/^([a-z])/, c => c.toUpperCase());
}

// ── Entity builder ────────────────────────────────────────────────────────────
// Format matches actual Dataverse export — entity metadata comes AFTER <attributes>

function buildEntity(schemaName, displayName, pluralName, entitySetName, attrsXml) {
  return `
  <Entity>
    <Name LocalizedName="${displayName}" OriginalName="${schemaName}">${schemaName}</Name>
    <EntityInfo>
      <entity Name="${schemaName}">
        <LocalizedNames>
          <LocalizedName description="${displayName}" languagecode="1033" />
        </LocalizedNames>
        <LocalizedCollectionNames>
          <LocalizedCollectionName description="${pluralName}" languagecode="1033" />
        </LocalizedCollectionNames>
        <Descriptions>
          <Description description="" languagecode="1033" />
        </Descriptions>
        <attributes>${attrsXml}
        </attributes>
        <EntitySetName>${entitySetName}</EntitySetName>
        <OwnershipTypeMask>UserOwned</OwnershipTypeMask>
        <IsAuditEnabled>0</IsAuditEnabled>
        <IsActivity>0</IsActivity>
        <IsActivityParty>0</IsActivityParty>
      </entity>
    </EntityInfo>
    <FormXml><forms type="main" /></FormXml>
    <Views />
    <Dashboards />
    <Visualizations />
    <CommandDefinitions />
    <RibbonDiffXml />
  </Entity>`;
}

// ── lni_productionschedule columns ───────────────────────────────────────────

const prodScheduleAttrs = [
  // Primary — identified by PrimaryName flag in DisplayMask
  primaryAttr('lni_name', 'Name'),

  // Status / classification
  stringAttr('lni_current_status',   'Current Status'),
  stringAttr('lni_process',          'Process'),
  stringAttr('lni_priority',         'Priority'),
  stringAttr('lni_region',           'Region'),
  stringAttr('lni_sales',            'Sales'),
  stringAttr('lni_sign_types',       'Sign Types'),
  stringAttr('lni_location',         'Location'),

  // Dates
  dateAttr('lni_order_date',          'Order Date'),
  dateAttr('lni_expeditor',           'Expeditor'),
  dateAttr('lni_scheduled_install',   'Scheduled Install'),
  dateAttr('lni_mfg_target_modified', 'Mfg Target Modified'),
  dateAttr('lni_red_date',            'Red Date'),
  dateAttr('lni_vendor_ship_date',    'Vendor Ship Date'),

  // Financial
  moneyAttr('lni_value', 'Value'),

  // Install readiness
  stringAttr('lni_ready_for_install', 'Ready for Install'),
  stringAttr('lni_powerlines',        'Powerlines'),
  stringAttr('lni_locates',           'Locates'),
  stringAttr('lni_mfg_region',        'MFG Region'),
  stringAttr('lni_install_region',    'Install Region'),
  stringAttr('lni_install_area',      'Install Area'),

  // Vendor
  stringAttr('lni_vendor',        'Vendor'),
  stringAttr('lni_po_number',     'PO Number'),
  stringAttr('lni_vendor_status', 'Vendor Status'),
  stringAttr('lni_graphics',      'Graphics'),
  stringAttr('lni_routing_type',  'Routing Type'),

  // MFG stage checkboxes (text: '/' or 'X')
  stringAttr('lni_metal',            'Metal', 50),
  stringAttr('lni_assembly',         'Assembly', 50),
  stringAttr('lni_plex_application', 'Plex Application', 50),
  stringAttr('lni_paint_prep_paint', 'Paint Prep / Paint', 50),
  stringAttr('lni_material_cut',     'Material Cut', 50),

  // Hours
  decimalAttr('lni_paint_prep_hrs', 'Paint Prep Hrs'),
  decimalAttr('lni_paint_hrs',      'Paint Hrs'),
  decimalAttr('lni_steel_hrs',      'Steel Hrs'),
  decimalAttr('lni_install_hrs',    'Install Hrs'),
  decimalAttr('lni_travel_hrs',     'Travel Hrs'),
  decimalAttr('lni_routing_hrs',    'Routing Hrs'),

  // Compliance / admin
  boolAttr('lni_ul_sign', 'UL Sign'),
  boolAttr('lni_qt',      'Q.T.'),
  stringAttr('lni_deposit',          'Deposit', 100),
  stringAttr('lni_storage_location', 'Storage Location'),

  // Notes
  memoAttr('lni_job_notes',   'Job Notes'),
  memoAttr('lni_admin_notes', 'Admin Notes'),
  memoAttr('lni_mfg_notes',   'Mfg Notes'),
].join('');

// ── lni_userviewpreferences columns ──────────────────────────────────────────

const viewPrefsAttrs = [
  primaryAttr('lni_name', 'Name'),
  stringAttr('lni_userid',      'User ID'),
  stringAttr('lni_viewname',    'View Name'),
  memoAttr('lni_hiddencolumns', 'Hidden Columns'),
  memoAttr('lni_columnorder',   'Column Order'),
].join('');

// ── Build XML documents ───────────────────────────────────────────────────────

const xmlHeader = `<?xml version="1.0" encoding="utf-8"?>`;

const contentTypesXml = `${xmlHeader}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="text/xml" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="jpg" ContentType="image/jpeg" />
</Types>`;

const solutionXml = `${xmlHeader}
<ImportExportXml version="9.1.0.0" SolutionPackageVersion="9.1" languagecode="1033" generatedBy="CrmLive" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <SolutionManifest>
    <UniqueName>LNIProductionSchedule</UniqueName>
    <LocalizedNames>
      <LocalizedName description="LNI Production Schedule" languagecode="1033" />
    </LocalizedNames>
    <Descriptions>
      <Description description="LNI Production Schedule data tables" languagecode="1033" />
    </Descriptions>
    <Version>1.0.1.4</Version>
    <Managed>0</Managed>
    <Publisher>
      <UniqueName>lni</UniqueName>
      <LocalizedNames>
        <LocalizedName description="LNI" languagecode="1033" />
      </LocalizedNames>
      <Descriptions />
      <EMailAddress />
      <SupportingWebsiteUrl />
      <CustomizationPrefix>lni</CustomizationPrefix>
      <CustomizationOptionValuePrefix>76543</CustomizationOptionValuePrefix>
      <Addresses>
        <Address>
          <AddressNumber>1</AddressNumber>
          <AddressTypeCode>1</AddressTypeCode>
          <ShippingMethodCode>1</ShippingMethodCode>
        </Address>
        <Address>
          <AddressNumber>2</AddressNumber>
          <AddressTypeCode>1</AddressTypeCode>
          <ShippingMethodCode>1</ShippingMethodCode>
        </Address>
      </Addresses>
    </Publisher>
    <RootComponents>
      <RootComponent type="1" schemaName="lni_productionschedule" behavior="0" />
      <RootComponent type="1" schemaName="lni_userviewpreferences" behavior="0" />
    </RootComponents>
    <MissingDependencies />
  </SolutionManifest>
</ImportExportXml>`;

const prodScheduleEntity = buildEntity(
  'lni_productionschedule',
  'LNI Production Schedule',
  'LNI Production Schedules',
  'lni_productionschedules',
  prodScheduleAttrs
);

const viewPrefsEntity = buildEntity(
  'lni_userviewpreferences',
  'LNI User View Preferences',
  'LNI User View Preferences',
  'lni_userviewpreferences',
  viewPrefsAttrs
);

const customizationsXml = `${xmlHeader}
<ImportExportXml version="9.1.0.0" SolutionPackageVersion="9.1" languagecode="1033" generatedBy="CrmLive" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Entities>${prodScheduleEntity}${viewPrefsEntity}
  </Entities>
  <Roles />
  <Workflows />
  <FieldSecurityProfiles />
  <Templates />
  <EntityMaps />
  <EntityRelationships />
  <OrganizationSettings />
  <optionsets />
  <CustomControls />
  <EntityDataProviders />
  <CanvasApps />
  <AIModels />
  <Dashboards />
  <Reports />
</ImportExportXml>`;

// ── Write files ───────────────────────────────────────────────────────────────

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

fs.writeFileSync(path.join(OUT_DIR, '[Content_Types].xml'), contentTypesXml, 'utf8');
fs.writeFileSync(path.join(OUT_DIR, 'solution.xml'),        solutionXml,     'utf8');
fs.writeFileSync(path.join(OUT_DIR, 'customizations.xml'),  customizationsXml, 'utf8');

console.log('✓ Solution XML files written to', OUT_DIR);

// ── Zip via PowerShell ────────────────────────────────────────────────────────

if (fs.existsSync(ZIP_PATH)) fs.rmSync(ZIP_PATH);

const psCmd = `Compress-Archive -Path "${OUT_DIR}\\*" -DestinationPath "${ZIP_PATH}" -Force`;
execSync(`powershell -Command "${psCmd}"`, { stdio: 'inherit' });
console.log('✓ Solution ZIP created at', ZIP_PATH);

// ── Import via pac ────────────────────────────────────────────────────────────

console.log('\nImporting solution into Dataverse...');
try {
  const result = execSync(`"${PAC}" solution import --path "${ZIP_PATH}" --async false`, {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  console.log(result);
  if (result.toLowerCase().includes('error') || result.toLowerCase().includes('failure')) {
    console.error('\n✗ Import reported errors — check output above.');
    process.exit(1);
  }
  console.log('\n✓ Solution imported successfully!');
  console.log('  Tables created:');
  console.log('    - lni_productionschedule  (40 columns)');
  console.log('    - lni_userviewpreferences (4 columns)');
} catch (err) {
  console.error('\n✗ Import failed — check the error above.');
  console.error('  You can retry manually:');
  console.error(`  "${PAC}" solution import --path "${ZIP_PATH}"`);
  process.exit(1);
}
