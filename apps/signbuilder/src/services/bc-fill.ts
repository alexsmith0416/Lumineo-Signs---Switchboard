// What a picked BC opportunity / project fills in on a spec. Blank fields are
// filled; what someone already typed is kept — except the number itself.
import type { BcJob, BcOpportunity, Spec } from "../domain/types";

export function opportunityFields(spec: Spec, o: BcOpportunity): Partial<Spec> {
  return {
    opportunityNo: o.no,
    description: spec.description || o.description,
    customerName: spec.customerName || o.companyName || o.contactName,
    contactName: spec.contactName || o.contactName,
    // The project made from the opportunity, when BC has one.
    jobNo: spec.jobNo || o.projectNo,
  };
}

export function jobFields(spec: Spec, j: BcJob): Partial<Spec> {
  return {
    jobNo: j.no,
    customerName: spec.customerName || j.customerName || j.name,
    description: spec.description || j.description,
  };
}
