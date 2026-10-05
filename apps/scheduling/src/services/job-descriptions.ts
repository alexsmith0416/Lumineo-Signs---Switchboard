// A job's three descriptions from BC, for the job panel's click-to-open
// sections. Rows come from crfdf_jobdesc (BCSync_JobDescriptions flow: our BC
// API page jobDescriptions, which reads the Blob fields Infotech's "Lumineo
// Signs - Projects" extension adds to Job). Plain text, line breaks kept.

export interface JobDescriptions {
  /** Field Description — install instructions (all roles). */
  field: string;
  /** Production Description — production instructions (all roles). */
  production: string;
  /** Extended Description — the sales / proposal text (editors only). */
  extended: string;
}

export const NO_DESCRIPTIONS: JobDescriptions = { field: "", production: "", extended: "" };
