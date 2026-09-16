import { Sequence } from "../sequence";
import { Modification } from "../modification";

describe("ProForma 2.1: Ion Notation (Section 11.6)", () => {
  test("should detect a-type-ion", () => {
    const seq = Sequence.fromProforma("PEPT[a-type-ion]IDE");
    const aa = seq.seq[3]; // 'T' at position 3
    expect(aa.mods.length).toBe(1);

    const mod = aa.mods[0];
    expect(mod.isIonType).toBe(true);
    expect(mod.value).toBe("a-type-ion");
  });

  test("should detect b-type-ion", () => {
    const seq = Sequence.fromProforma("PEPT[b-type-ion]IDE");
    const aa = seq.seq[3];
    expect(aa.mods.length).toBe(1);

    const mod = aa.mods[0];
    expect(mod.isIonType).toBe(true);
  });

  test("should detect all ion types", () => {
    const ionTypes = [
      "a-type-ion",
      "b-type-ion",
      "c-type-ion",
      "x-type-ion",
      "y-type-ion",
      "z-type-ion",
    ];

    for (const ionType of ionTypes) {
      const seq = Sequence.fromProforma(`PEPT[${ionType}]IDE`);
      const mod = seq.seq[3].mods[0];
      expect(mod.isIonType).toBe(true);
    }
  });

  test("should detect ion types with Unimod IDs", () => {
    const testCases = [
      { unimodId: "UNIMOD:140", isIon: true, name: "a-type-ion" },
      { unimodId: "UNIMOD:2132", isIon: true, name: "b-type-ion" },
      { unimodId: "UNIMOD:2141", isIon: true, name: "c-type-ion" },
      { unimodId: "UNIMOD:2142", isIon: true, name: "x-type-ion" },
      { unimodId: "UNIMOD:2143", isIon: true, name: "z-type-ion" },
      { unimodId: "UNIMOD:21", isIon: false, name: "Phospho" },
      { unimodId: "UNIMOD:4", isIon: false, name: "Carbamidomethyl" },
      { unimodId: "UNIMOD:24", isIon: false, name: "Propionamide" },
    ];

    for (const { unimodId, isIon, name } of testCases) {
      const seq = Sequence.fromProforma(`PEPT[${unimodId}]IDE`);
      const mod = seq.seq[3].mods[0];
      expect(mod.isIonType).toBe(isIon);
    }
  });

  test("should detect ion types with short Unimod IDs", () => {
    const testCases = [
      { unimodId: "U:140", isIon: true },
      { unimodId: "U:2132", isIon: true },
      { unimodId: "U:2141", isIon: true },
      { unimodId: "U:21", isIon: false }, // Phospho
    ];

    for (const { unimodId, isIon } of testCases) {
      const seq = Sequence.fromProforma(`PEPT[${unimodId}]IDE`);
      const mod = seq.seq[3].mods[0];
      expect(mod.isIonType).toBe(isIon);
    }
  });

  test("should be case insensitive for ion types", () => {
    const testCases = [
      "a-TYPE-ION",
      "B-Type-Ion",
      "c-type-ION",
      "A-type-ion",
    ];

    for (const ionType of testCases) {
      const seq = Sequence.fromProforma(`PEPT[${ionType}]IDE`);
      const mod = seq.seq[3].mods[0];
      expect(mod.isIonType).toBe(true);
    }
  });

  test("should not detect non-ion modifications", () => {
    const nonIonTypes = [
      "Phospho",
      "Acetyl",
      "Oxidation",
      "+79.966",
      "UNIMOD:21", // Phospho
    ];

    for (const modType of nonIonTypes) {
      const seq = Sequence.fromProforma(`PEPT[${modType}]IDE`);
      const mod = seq.seq[3].mods[0];
      expect(mod.isIonType).toBe(false);
    }
  });

  test("should preserve ion type flag in round-trip", () => {
    const testCases = [
      "PEPT[a-type-ion]IDE",
      "PEPT[b-type-ion]IDE",
      "PEPT[c-type-ion]IDE",
      "PEPT[UNIMOD:140]IDE",
      "PEPT[UNIMOD:2132]IDE",
      "[b-type-ion]-PEPTIDE",
    ];

    for (const proforma of testCases) {
      const seq = Sequence.fromProforma(proforma);
      const output = seq.toProforma();

      const seq2 = Sequence.fromProforma(output);

      // Check that IsIonType is preserved
      let mod1, mod2;
      if (proforma.startsWith("[")) {
        // N-terminal mod
        mod1 = seq.mods.get(-1)?.[0];
        mod2 = seq2.mods.get(-1)?.[0];
      } else if (seq.seq.length > 3 && seq.seq[3].mods.length > 0) {
        mod1 = seq.seq[3].mods[0];
        mod2 = seq2.seq[3].mods[0];
      }

      if (mod1 && mod2) {
        expect(mod1.isIonType).toBe(mod2.isIonType);
        expect(mod2.isIonType).toBe(true);
      }
    }
  });

  test("should handle ion type at N-terminus", () => {
    const seq = Sequence.fromProforma("[a-type-ion]-PEPTIDE");
    const nTermMods = seq.mods.get(-1);

    expect(nTermMods).toBeDefined();
    expect(nTermMods!.length).toBe(1);
    expect(nTermMods![0].isIonType).toBe(true);
  });

  test("should handle ion type at C-terminus", () => {
    const seq = Sequence.fromProforma("PEPTIDE-[b-type-ion]");
    const cTermMods = seq.mods.get(-2);

    expect(cTermMods).toBeDefined();
    expect(cTermMods!.length).toBe(1);
    expect(cTermMods![0].isIonType).toBe(true);
  });

  test("should handle multiple ion types in sequence", () => {
    const seq = Sequence.fromProforma("PE[a-type-ion]PT[b-type-ion]ID[c-type-ion]E");

    const mod1 = seq.seq[1].mods[0]; // E
    const mod2 = seq.seq[3].mods[0]; // T
    const mod3 = seq.seq[5].mods[0]; // D

    expect(mod1.isIonType).toBe(true);
    expect(mod2.isIonType).toBe(true);
    expect(mod3.isIonType).toBe(true);
  });

  test("should handle ion type with other modifications", () => {
    const seq = Sequence.fromProforma("PEPT[Phospho][a-type-ion]IDE");
    const aa = seq.seq[3];
    expect(aa.mods.length).toBe(2);

    const phosphoMod = aa.mods[0];
    const ionMod = aa.mods[1];

    expect(phosphoMod.isIonType).toBe(false);
    expect(phosphoMod.value).toBe("Phospho");

    expect(ionMod.isIonType).toBe(true);
    expect(ionMod.value).toBe("a-type-ion");
  });

  test("should handle static isIonTypeModification detection", () => {
    expect(Modification.isIonTypeModification("a-type-ion")).toBe(true);
    expect(Modification.isIonTypeModification("b-type-ion")).toBe(true);
    expect(Modification.isIonTypeModification("B-TYPE-ION")).toBe(true);
    expect(Modification.isIonTypeModification("UNIMOD:140")).toBe(true);
    expect(Modification.isIonTypeModification("U:2132")).toBe(true);
    expect(Modification.isIonTypeModification("Phospho")).toBe(false);
    expect(Modification.isIonTypeModification("UNIMOD:21")).toBe(false);
  });

  test("should handle labile ion type", () => {
    const seq = Sequence.fromProforma("{Glycan:a-type-ion}PEPTIDE");
    const labileMods = seq.mods.get(-3);

    expect(labileMods).toBeDefined();
    expect(labileMods!.length).toBe(1);
    expect(labileMods![0].isIonType).toBe(true);
  });

  test("should handle unknown position ion type", () => {
    const seq = Sequence.fromProforma("[b-type-ion]?PEPTIDE");
    const unknownMods = seq.mods.get(-4);

    expect(unknownMods).toBeDefined();
    expect(unknownMods!.length).toBe(1);
    expect(unknownMods![0].isIonType).toBe(true);
  });

  test("should handle ion type with ambiguity", () => {
    const seq = Sequence.fromProforma("PEPT[a-type-ion#1]IDE");
    const aa = seq.seq[3]; // T at position 3
    expect(aa.mods.length).toBe(1);

    const mod = aa.mods[0];
    expect(mod.isIonType).toBe(true);
    expect(mod.ambiguityGroup).toBe("1");
  });

  test("should differentiate ion types from regular modifications", () => {
    const seq1 = Sequence.fromProforma("PEPT[Phospho]IDE");
    const seq2 = Sequence.fromProforma("PEPT[a-type-ion]IDE");

    const mod1 = seq1.seq[3].mods[0];
    const mod2 = seq2.seq[3].mods[0];

    expect(mod1.isIonType).toBe(false);
    expect(mod2.isIonType).toBe(true);
  });
});
