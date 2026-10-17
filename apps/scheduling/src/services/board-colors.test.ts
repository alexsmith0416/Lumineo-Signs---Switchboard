import { describe, expect, it } from "vitest";
import type { Department } from "../engine/types";
import { applyBoardColors, defaultScheme, parseBoardColors, type BoardColors } from "./board-colors";

const dept = (id: string, name: string, color: string): Department => ({ id, name, flowOrder: 1, color });

describe("defaultScheme", () => {
  it("keeps a department's own colour, with its palette text", () => {
    expect(defaultScheme(dept("1", "Metal Fab", "#BED7FF"))).toEqual({
      bg: "#BED7FF", text: "#042c53", header: "#BED7FF", headerText: "#042c53",
    });
  });
  it("gives gray (uncoloured) live departments their house colour by name", () => {
    expect(defaultScheme(dept("2", "Paint", "#cccccc")).bg).toBe("#FAC775");
    expect(defaultScheme(dept("3", "Vinyl/Graphics", "#cccccc")).bg).toBe("#C8E6D4");
  });
  it("stays gray for an unknown name", () => {
    expect(defaultScheme(dept("4", "Office", "#cccccc"))).toMatchObject({ bg: "#cccccc", text: "#222222" });
  });
});

describe("applyBoardColors", () => {
  it("applies an edited scheme and leaves others on their default", () => {
    const colors: BoardColors = {
      production: { "1": { bg: "#112233", text: "#ffffff", header: "#000000", headerText: "#ffffff" } },
      installation: {},
      schemes: [],
    };
    const out = applyBoardColors(new Map([["1", dept("1", "Metal Fab", "#BED7FF")], ["2", dept("2", "Paint", "#cccccc")]]), "production", colors);
    expect(out.get("1")).toMatchObject({ color: "#112233", textColor: "#ffffff", headerColor: "#000000" });
    expect(out.get("2")?.color).toBe("#FAC775");
  });
});

describe("parseBoardColors", () => {
  it("drops malformed entries and duplicate scheme names", () => {
    const c = parseBoardColors({
      production: { "1": { bg: "#112233" }, "2": { bg: "red" } },
      schemes: [{ name: "Olathe", bg: "#ff8800" }, { name: "olathe", bg: "#000000" }, { name: "", bg: "#000000" }],
    });
    expect(Object.keys(c.production)).toEqual(["1"]);
    expect(c.production["1"]?.header).toBe("#112233");
    expect(c.schemes.map((s) => s.name)).toEqual(["Olathe"]);
    expect(parseBoardColors(null)).toEqual({ production: {}, installation: {}, schemes: [] });
  });
});
