import { describe, expect, it } from "vitest";
import {
  DND_LOAD_ITEM,
  DND_SHIP_STAGE,
  decodeLoadItemRef,
  encodeLoadItemRef,
  findStagedItem,
  stageItemFromShipmentItem,
  reorderGroupIds,
  shipmentItemFromStage,
  stageItemFromJob,
  stageItemFromManual,
  stagedCount,
} from "./stage";
import type { QueueGroup, QueueItem } from "../services/job-queue-data";
import type { ShipmentItem } from "./types";

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

describe("DND_LOAD_ITEM", () => {
  it("is lowercase and distinct from the staging key", () => {
    expect(DND_LOAD_ITEM).toBe(DND_LOAD_ITEM.toLowerCase());
    expect(DND_LOAD_ITEM).not.toBe(DND_SHIP_STAGE);
  });
});

describe("load item refs", () => {
  it("round-trips a load + item id", () => {
    const ref = encodeLoadItemRef("load-1", "item-9");
    expect(decodeLoadItemRef(ref)).toEqual({ loadId: "load-1", itemId: "item-9" });
  });

  it("round-trips real uuids", () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    expect(decodeLoadItemRef(encodeLoadItemRef(a, b))).toEqual({ loadId: a, itemId: b });
  });

  // A drop target reads whatever string is on the drag; anything that isn't a
  // ref must be rejected rather than half-parsed into a bogus lookup.
  it("rejects payloads that are not refs", () => {
    expect(decodeLoadItemRef("")).toBeNull();
    expect(decodeLoadItemRef("no-separator")).toBeNull();
    expect(decodeLoadItemRef("|missing-load")).toBeNull();
    expect(decodeLoadItemRef("missing-item|")).toBeNull();
  });
});

describe("stageItemFromShipmentItem", () => {
  const loadItem: ShipmentItem = {
    id: "i1",
    jobNo: "J36388",
    customerName: "Kwik Shop - Wichita",
    description: "(2) Pylon faces",
    notes: "Back door, ask for Dale",
    location: "Wichita",
    kind: "pickup",
    loaded: true,
  };

  it("carries job no, customer, and description into a list", () => {
    const staged = stageItemFromShipmentItem(loadItem, "g1", 2);
    expect(staged.jobNo).toBe("J36388");
    expect(staged.customerName).toBe("Kwik Shop - Wichita");
    expect(staged.planningLineDescription).toBe("(2) Pylon faces");
    expect(staged.groupId).toBe("g1");
    expect(staged.sortOrder).toBe(2);
  });

  // location / kind / loaded / notes described the run it just left. A staged
  // card has no field for any of them, so the check is that nothing smuggled
  // them into a scheduling field instead.
  it("drops the per-run details", () => {
    const staged = stageItemFromShipmentItem(loadItem, "g1", 0);
    expect(staged).not.toHaveProperty("location");
    expect(staged).not.toHaveProperty("kind");
    expect(staged).not.toHaveProperty("loaded");
    expect(staged).not.toHaveProperty("notes");
    expect(staged.jobDescription).toBe("");
    expect(staged.departmentId).toBe("");
    expect(staged.estimatedHours).toBe(0);
    expect(staged.isCustom).toBe(false);
    expect(staged.installZip).toBeNull();
  });

  // A manual load item has jobNo null; QueueItem uses "" for absent.
  it("turns a null job number into an empty string", () => {
    const manual = { ...loadItem, jobNo: null };
    expect(stageItemFromShipmentItem(manual, "g1", 0).jobNo).toBe("");
  });

  it("round-trips a project out to a load and back", () => {
    const staged = stageItemFromJob(JOB, "g1", 0);
    const onLoad = shipmentItemFromStage(staged);
    const back = stageItemFromShipmentItem(
      { ...onLoad, id: "i1", notes: "", location: "", kind: "delivery", loaded: false } as ShipmentItem,
      "g2",
      0,
    );
    expect(back.jobNo).toBe(staged.jobNo);
    expect(back.customerName).toBe(staged.customerName);
    expect(back.planningLineDescription).toBe(staged.planningLineDescription);
    expect(back.groupId).toBe("g2");
  });

  it("round-trips a manual project without inventing a job number", () => {
    const staged = stageItemFromManual("Transformers", "(2) Transformers", "g1", 0);
    const onLoad = shipmentItemFromStage(staged);
    expect(onLoad.jobNo).toBeNull();
    const back = stageItemFromShipmentItem(
      { ...onLoad, id: "i1", notes: "", location: "", kind: "delivery", loaded: false } as ShipmentItem,
      "g1",
      0,
    );
    expect(back.jobNo).toBe("");
    expect(back.customerName).toBe("Transformers");
  });
});
