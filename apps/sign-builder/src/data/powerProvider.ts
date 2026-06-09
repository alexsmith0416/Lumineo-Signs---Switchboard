// Shared type definitions for the Power Apps Code app SDK runtime.
// The host injects a typed Dataverse client at window.PowerProvider before
// our bundle runs; both the SignSpec adapter and the Project adapter read
// from it via the table aliases declared in `power.config.json`.

export type DataverseColumns = Record<string, string | number | boolean | null>;

export type PowerProviderTable<T extends DataverseColumns> = {
  list(): Promise<T[]>;
  create(row: T): Promise<T>;
  update(id: string, row: Partial<T>): Promise<T>;
  retrieve(id: string): Promise<T | null>;
  delete(id: string): Promise<void>;
};

// Tables surfaced to the SDK. Aliases match `power.config.json`.
export type PowerProviderTables = {
  SignSpecifications?: PowerProviderTable<DataverseColumns>;
  SignProjects?: PowerProviderTable<DataverseColumns>;
};

export type PowerProvider = {
  tables?: PowerProviderTables;
};

declare global {
  interface Window {
    PowerProvider?: PowerProvider;
  }
}
