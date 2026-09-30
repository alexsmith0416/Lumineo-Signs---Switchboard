import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, jobTargetDates, leadTimeFor, ruleMatches, type LeadTimeRule } from "./lead-times";

const rule = (o: Partial<LeadTimeRule>): LeadTimeRule => ({
  id: "", name: "", steps: [], match: "only", productionWeeks: 4, installWeeks: 7, ...o,
});

describe("ruleMatches", () => {
  const mcVinyl = rule({ steps: ["MC", "V"] });
  it("'only' matches a job whose production steps are all in the rule (Install ignored)", () => {
    expect(ruleMatches(mcVinyl, ["V"])).toBe(true);
    expect(ruleMatches(mcVinyl, ["MC", "V", "I"])).toBe(true);
    expect(ruleMatches(mcVinyl, ["V", "P"])).toBe(false);
  });
  it("'includes' matches a job that has every rule step, plus others", () => {
    const steel = rule({ steps: ["S", "P"], match: "includes" });
    expect(ruleMatches(steel, ["S", "R", "P", "A"])).toBe(true);
    expect(ruleMatches(steel, ["S", "R"])).toBe(false);
  });
  it("never matches a job with no production steps, or a rule with no steps", () => {
    expect(ruleMatches(mcVinyl, ["I"])).toBe(false);
    expect(ruleMatches(rule({ steps: [] }), ["V"])).toBe(false);
  });
});

describe("leadTimeFor", () => {
  const rules = [rule({ name: "Vinyl", steps: ["V"] }), rule({ name: "Has paint", steps: ["P"], match: "includes", productionWeeks: 9, installWeeks: 12 })];
  it("uses the first matching rule, top to bottom", () => {
    expect(leadTimeFor(["V"], rules)).toMatchObject({ productionWeeks: 4, installWeeks: 7, rule: { name: "Vinyl" } });
    expect(leadTimeFor(["MF", "P"], rules)).toMatchObject({ productionWeeks: 9, installWeeks: 12, rule: { name: "Has paint" } });
  });
  it("falls back to 7 / 10 weeks", () => {
    expect(leadTimeFor(["MF", "A"], rules)).toEqual({ productionWeeks: 7, installWeeks: 10, rule: null });
    expect(leadTimeFor([], rules)).toEqual({ productionWeeks: 7, installWeeks: 10, rule: null });
  });
  it("the built-in default rule keeps vinyl / graphics-only jobs at 4 weeks", () => {
    expect(leadTimeFor(["V", "I"], DEFAULT_RULES).productionWeeks).toBe(4);
  });
});

describe("jobTargetDates", () => {
  const lead = { productionWeeks: 7, installWeeks: 10 };
  it("targets = release + the lead times, off a weekend", () => {
    // Thu Jan 1 2026: +7 wk = Thu Feb 19; +10 wk = Thu Mar 12
    expect(jobTargetDates({ release: "2026-01-01", lead, mfgModified: "" }))
      .toEqual({ mfgTarget: "2026-02-19", installTarget: "2026-03-12", mfgFinal: "2026-02-19" });
    // Sat Jan 3: +7 wk = Sat Feb 21 → Mon Feb 23
    expect(jobTargetDates({ release: "2026-01-03", lead, mfgModified: "" }).mfgTarget).toBe("2026-02-23");
  });
  it("Mfg Final = Mfg Modified when it differs from the target", () => {
    expect(jobTargetDates({ release: "2026-01-01", lead, mfgModified: "2026-03-02" }).mfgFinal).toBe("2026-03-02");
    expect(jobTargetDates({ release: "2026-01-01", lead, mfgModified: "2026-02-19" }).mfgFinal).toBe("2026-02-19");
  });
  it("without a release date there are no targets; a modified date still stands", () => {
    expect(jobTargetDates({ release: "", lead, mfgModified: "2026-03-02" }))
      .toEqual({ mfgTarget: "", installTarget: "", mfgFinal: "2026-03-02" });
  });
});
