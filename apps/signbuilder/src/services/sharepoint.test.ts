import { describe, expect, it } from "vitest";
import { folderPathOf, pickJobFolder } from "./sharepoint";

const base = "https://luminousneon.sharepoint.com/sites/JobFiles/Shared Documents/D/DOBSKI/MCDONALD'S/TOPEKA";

describe("pickJobFolder", () => {
  it("prefers the folder named exactly the job number", () => {
    expect(pickJobFolder([`${base}/J394240`, `${base}/J39424 Phase 2`, `${base}/J39424`], "J39424")).toBe(`${base}/J39424`);
  });
  it("takes a folder that starts with the number when there's no exact one", () => {
    expect(pickJobFolder([`${base}/J394240`, `${base}/J39424 Phase 2`], "j39424")).toBe(`${base}/J39424 Phase 2`);
  });
  it("finds nothing for a different job that merely contains the number", () => {
    expect(pickJobFolder([`${base}/J394240`, `${base}/Old J39424`], "J39424")).toBe("");
  });
});

it("folderPathOf gives the server-relative path", () => {
  expect(folderPathOf(`${base}/J39424`)).toBe("/sites/JobFiles/Shared Documents/D/DOBSKI/MCDONALD'S/TOPEKA/J39424");
});
