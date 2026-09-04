import { describe, expect, it } from "vitest";
import {
  DND_SHIP_STAGE,
  findStagedItem,
  reorderGroupIds,
  shipmentItemFromStage,
  stageItemFromJob,
  stageItemFromManual,
  stagedCount,
} from "./stage";
import type { QueueGroup, QueueItem } from "../services/job-queue-data";

const JOB = { jobNo: "J36388", customerName: "Kwik Shop - Wichita", description: "(2) Pylon faces" };

const group = (id: string, items: QueueItem[] = []): QueueGroup => ({
  id,
  kind: "shipping",
  name: id,
  color: "#fff",
  textColor: "#000",
  collapsed: false,
  sortOrder: 0,
  items,
});

describe("DND_SHIP_STAGE", () => {
  // The HTML5 drag store lowercases type keys; a mixed-case constant silently
  // never matches in `dataTransfer.types`.
  it("is lowercase", () => {
    expect(DND_SHIP_STAGE).toBe(DND_SHIP_STAGE.toLowerCase());
  });

  it("does not collide with the calendar queue's key", () => {
    expect(DND_SHIP_STAGE).not.toBe("text/queueitemid");
  });
});

describe("stageItemFromJob", () => {
  it("carries job no, customer, and description", () => {
    const it = stageItemFromJob(JOB, "g1", 3);
    expect(it.jobNo).toBe("J36388");
    expect(it.customerName).toBe("Kwik Shop - Wichita");
    expect(it.planningLineDescription).toBe("(2) Pylon faces");
    expect(it.groupId).toBe("g1");
    expect(it.sortOrder).toBe(3);
  });

  it("leaves the scheduling-shaped fields empty", () => {
    const it = stageItemFromJob(JOB, "g1", 0);
    expect(it.estimatedHours).toBe(0);
    expect(it.departmentId).toBe("");
    expect(it.crewPersons).toBeNull();
    expect(it.crewTrucks).toBeNull();
    expect(it.crewTrips).toBeNull();
    expect(it.installZip).toBeNull();
    expect(it.invoiceAmount).toBeNull();
    expect(it.isCustom).toBe(false);
  });

  it("gives every card its own id", () => {
    expect(stageItemFromJob(JOB, "g1", 0).id).not.toBe(stageItemFromJob(JOB, "g1", 0).id);
  });
});

describe("stageItemFromManual", () => {
  it("trims and has no job number", () => {
    const it = stageItemFromManual("  Transformers ", "  (2) Transformers  ", "g1", 0);
    expect(it.customerName).toBe("Transformers");
    expect(it.planningLineDescription).toBe("(2) Transformers");
    expect(it.jobNo).toBe("");
  });
});

describe("shipmentItemFromStage", () => {
  it("maps a BC-backed card onto a load item", () => {
    expect(shipmentItemFromStage(stageItemFromJob(JOB, "g1", 0))).toEqual({
      jobNo: "J36388",
      customerName: "Kwik Shop - Wichita",
      description: "(2) Pylon faces",
    });
  });

  // A ShipmentItem uses null (not "") for "no job number" — that's what the
  // load editor's "+ Job #" empty state and the printed sheet both test for.
  it("turns a blank job number into null", () => {
    const manual = stageItemFromManual("Transformers", "(2) Transformers", "g1", 0);
    expect(shipmentItemFromStage(manual).jobNo).toBeNull();
  });

  it("leaves location, kind, and notes for the load editor to set", () => {
    const mapped = shipmentItemFromStage(stageItemFromJob(JOB, "g1", 0));
    expect(mapped.location).toBeUndefined();
    expect(mapped.kind).toBeUndefined();
    expect(mapped.notes).toBeUndefined();
  });
});

describe("reorderGroupIds", () => {
  it("moves a group to the target's position", () => {
    expect(reorderGroupIds(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(reorderGroupIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });

  it("returns the input by identity on a no-op", () => {
    const ids = ["a", "b", "c"];
    expect(reorderGroupIds(ids, "a", "a")).toBe(ids);
  });

  it("returns the input by identity when an id is unknown", () => {
    const ids = ["a", "b", "c"];
    expect(reorderGroupIds(ids, "zz", "a")).toBe(ids);
    expect(reorderGroupIds(ids, "a", "zz")).toBe(ids);
  });

  it("does not mutate the input", () => {
    const ids = ["a", "b", "c"];
    reorderGroupIds(ids, "a", "c");
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("stagedCount", () => {
  it("totals items across lists", () => {
    const a = stageItemFromJob(JOB, "g1", 0);
    const b = stageItemFromJob(JOB, "g2", 0);
    expect(stagedCount([group("g1", [a]), group("g2", [b, b]), group("g3")])).toBe(3);
  });

  it("is 0 for an empty board", () => {
    expect(stagedCount([])).toBe(0);
  });
});

describe("findStagedItem", () => {
  it("finds a card in any list", () => {
    const a = stageItemFromJob(JOB, "g1", 0);
    const b = stageItemFromJob(JOB, "g2", 0);
    const groups = [group("g1", [a]), group("g2", [b])];
    expect(findStagedItem(groups, a.id)).toBe(a);
    expect(findStagedItem(groups, b.id)).toBe(b);
  });

  it("returns undefined for an unknown id", () => {
    const a = stageItemFromJob(JOB, "g1", 0);
    expect(findStagedItem([group("g1", [a])], "nope")).toBeUndefined();
    expect(findStagedItem([], a.id)).toBeUndefined();
  });
});
