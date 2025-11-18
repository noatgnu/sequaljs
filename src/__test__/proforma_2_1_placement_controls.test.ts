import { Sequence } from "../sequence";

describe("ProForma 2.1: Placement Controls (Section 11.2)", () => {
  test("should parse single position constraint", () => {
    const seq = Sequence.fromProforma("<[Oxidation|Position:M]@M>PEPTIDE");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getPositionConstraint()).toEqual(["M"]);
  });

  test("should parse multiple position constraints", () => {
    const seq = Sequence.fromProforma("<[Phospho|Position:S,T,Y]@S,T,Y>PEPTIDES");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getPositionConstraint()).toEqual(["S", "T", "Y"]);
  });

  test("should parse position constraint with specific amino acid", () => {
    const seq = Sequence.fromProforma("<[Carbamidomethyl|Position:C]@C>PEPTCDE");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getPositionConstraint()).toEqual(["C"]);
  });

  test("should parse limit per position - limit of 1", () => {
    const seq = Sequence.fromProforma("<[Oxidation|Limit:1]@M>MMMM");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getLimitPerPosition()).toBe(1);
  });

  test("should parse limit per position - limit of 2", () => {
    const seq = Sequence.fromProforma("<[Phospho|Limit:2]@S,T,Y>STYSTY");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getLimitPerPosition()).toBe(2);
  });

  test("should parse limit with position constraint", () => {
    const seq = Sequence.fromProforma("<[Oxidation|Position:M|Limit:1]@M>MMMM");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getPositionConstraint()).toEqual(["M"]);
    expect(mod.getLimitPerPosition()).toBe(1);
  });

  test("should parse CoMKP tag", () => {
    const seq = Sequence.fromProforma("<[Oxidation|CoMKP]@M>PEPTIDE");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getColocalizeKnown()).toBe(true);
  });

  test("should parse full form ColocaliseModificationsOfKnownPosition", () => {
    const seq = Sequence.fromProforma("<[Oxidation|ColocaliseModificationsOfKnownPosition]@M>PEPTIDE");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getColocalizeKnown()).toBe(true);
  });

  test("should parse CoMUP tag", () => {
    const seq = Sequence.fromProforma("<[Oxidation|CoMUP]@M>PEPTIDE");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getColocalizeUnknown()).toBe(true);
  });

  test("should parse full form ColocaliseModificationsOfUnknownPosition", () => {
    const seq = Sequence.fromProforma("<[Oxidation|ColocaliseModificationsOfUnknownPosition]@M>PEPTIDE");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getColocalizeUnknown()).toBe(true);
  });

  test("should parse all placement controls together", () => {
    const seq = Sequence.fromProforma("<[Phospho|Position:S,T,Y|Limit:2|CoMKP]@S,T,Y>PEPTIDES");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getPositionConstraint()).toEqual(["S", "T", "Y"]);
    expect(mod.getLimitPerPosition()).toBe(2);
    expect(mod.getColocalizeKnown()).toBe(true);
  });

  test("should handle global modification without placement controls", () => {
    const seq = Sequence.fromProforma("<[Oxidation]@M>PEPTIDE");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];

    expect(mod.getPositionConstraint()).toBeNull();
    expect(mod.getLimitPerPosition()).toBeNull();
    expect(mod.getColocalizeKnown()).toBe(false);
    expect(mod.getColocalizeUnknown()).toBe(false);
  });

  test("should serialize position constraint", () => {
    const original = "<[Oxidation|Position:M]@M>PEPTIDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize multiple position constraints", () => {
    const original = "<[Phospho|Position:S,T,Y]@S,T,Y>PEPTIDES";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize limit per position", () => {
    const original = "<[Phospho|Limit:2]@S,T,Y>STYSTY";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize CoMKP", () => {
    const original = "<[Oxidation|CoMKP]@M>PEPTIDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize CoMUP", () => {
    const original = "<[Oxidation|CoMUP]@M>PEPTIDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize all placement controls", () => {
    const original = "<[Phospho|Position:S,T,Y|Limit:2|CoMKP]@S,T,Y>PEPTIDES";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should round-trip position constraint", () => {
    const testCases = [
      "<[Oxidation|Position:M]@M>PEPTIDE",
      "<[Phospho|Position:S,T,Y]@S,T,Y>PEPTIDES",
      "<[Carbamidomethyl|Position:C]@C>PEPTCDE",
    ];

    for (const original of testCases) {
      const seq = Sequence.fromProforma(original);
      const proforma = seq.toProforma();

      const seq2 = Sequence.fromProforma(proforma);
      const proforma2 = seq2.toProforma();

      expect(proforma).toBe(original);
      expect(proforma2).toBe(original);

      const mod1 = seq.globalMods[0];
      const mod2 = seq2.globalMods[0];

      expect(mod1.getPositionConstraint()).toEqual(mod2.getPositionConstraint());
    }
  });

  test("should round-trip limit per position", () => {
    const testCases = [
      "<[Oxidation|Limit:1]@M>MMMM",
      "<[Phospho|Limit:2]@S,T,Y>STYSTY",
      "<[Oxidation|Position:M|Limit:1]@M>MMMM",
    ];

    for (const original of testCases) {
      const seq = Sequence.fromProforma(original);
      const proforma = seq.toProforma();

      const seq2 = Sequence.fromProforma(proforma);
      const proforma2 = seq2.toProforma();

      expect(proforma).toBe(original);
      expect(proforma2).toBe(original);

      const mod1 = seq.globalMods[0];
      const mod2 = seq2.globalMods[0];

      expect(mod1.getLimitPerPosition()).toBe(mod2.getLimitPerPosition());
    }
  });

  test("should round-trip colocalization flags", () => {
    const testCases = [
      "<[Oxidation|CoMKP]@M>PEPTIDE",
      "<[Oxidation|CoMUP]@M>PEPTIDE",
    ];

    for (const original of testCases) {
      const seq = Sequence.fromProforma(original);
      const proforma = seq.toProforma();

      const seq2 = Sequence.fromProforma(proforma);
      const proforma2 = seq2.toProforma();

      expect(proforma).toBe(original);
      expect(proforma2).toBe(original);

      const mod1 = seq.globalMods[0];
      const mod2 = seq2.globalMods[0];

      expect(mod1.getColocalizeKnown()).toBe(mod2.getColocalizeKnown());
      expect(mod1.getColocalizeUnknown()).toBe(mod2.getColocalizeUnknown());
    }
  });

  test("should round-trip combined placement controls", () => {
    const testCases = [
      "<[Phospho|Position:S,T,Y|Limit:2|CoMKP]@S,T,Y>PEPTIDES",
      "<[Oxidation|Position:M|Limit:1|CoMUP]@M>MMMM",
    ];

    for (const original of testCases) {
      const seq = Sequence.fromProforma(original);
      const proforma = seq.toProforma();

      const seq2 = Sequence.fromProforma(proforma);
      const proforma2 = seq2.toProforma();

      expect(proforma).toBe(original);
      expect(proforma2).toBe(original);

      const mod1 = seq.globalMods[0];
      const mod2 = seq2.globalMods[0];

      expect(mod1.getPositionConstraint()).toEqual(mod2.getPositionConstraint());
      expect(mod1.getLimitPerPosition()).toBe(mod2.getLimitPerPosition());
      expect(mod1.getColocalizeKnown()).toBe(mod2.getColocalizeKnown());
      expect(mod1.getColocalizeUnknown()).toBe(mod2.getColocalizeUnknown());
    }
  });

  test("should handle multiple global modifications with different placement controls", () => {
    const seq = Sequence.fromProforma("<[Phospho|Position:S,T,Y|CoMKP]@S,T,Y><[Oxidation|Position:M|CoMUP]@M>STMYST");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(2);

    const mod1 = globalMods[0];
    expect(mod1.getPositionConstraint()).toEqual(["S", "T", "Y"]);
    expect(mod1.getColocalizeKnown()).toBe(true);
    expect(mod1.getColocalizeUnknown()).toBe(false);

    const mod2 = globalMods[1];
    expect(mod2.getPositionConstraint()).toEqual(["M"]);
    expect(mod2.getColocalizeKnown()).toBe(false);
    expect(mod2.getColocalizeUnknown()).toBe(true);
  });

  test("should preserve placement controls in complex sequences", () => {
    const original = "<[Phospho|Position:S,T,Y|Limit:2]@S,T,Y>PEPT[Oxidation]IDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);

    const globalMod = seq.globalMods[0];
    expect(globalMod.getPositionConstraint()).toEqual(["S", "T", "Y"]);
    expect(globalMod.getLimitPerPosition()).toBe(2);
  });

  test("should handle long form ColocaliseModificationsOfKnownPosition and serialize as CoMKP", () => {
    const input = "<[Oxidation|ColocaliseModificationsOfKnownPosition]@M>PEPTIDE";
    const expected = "<[Oxidation|CoMKP]@M>PEPTIDE";

    const seq = Sequence.fromProforma(input);
    const proforma = seq.toProforma();

    expect(proforma).toBe(expected);
  });

  test("should handle long form ColocaliseModificationsOfUnknownPosition and serialize as CoMUP", () => {
    const input = "<[Oxidation|ColocaliseModificationsOfUnknownPosition]@M>PEPTIDE";
    const expected = "<[Oxidation|CoMUP]@M>PEPTIDE";

    const seq = Sequence.fromProforma(input);
    const proforma = seq.toProforma();

    expect(proforma).toBe(expected);
  });
});
