import { Sequence } from "../sequence";

describe("ProForma 2.1: Custom Monosaccharides in Glycans (Section 10.2)", () => {
  test("should parse single custom monosaccharide", () => {
    const seq = Sequence.fromProforma("SEQUEN[Glycan:{C8H13N1O5}1Hex2]CE");

    expect(seq.seq[5].mods.length).toBe(1);
    const mod = seq.seq[5].mods[0];
    expect(mod.source).toBe("Glycan");
    expect(mod.modValue.pipeValues[0].value).toBe("{C8H13N1O5}1Hex2");
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should parse custom monosaccharide with isotopes", () => {
    const seq = Sequence.fromProforma("SEQUEN[Glycan:{C8H13[15N1]O5}1Hex2]CE");

    const mod = seq.seq[5].mods[0];
    expect(mod.modValue.pipeValues[0].value).toBe("{C8H13[15N1]O5}1Hex2");
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should parse charged custom monosaccharide", () => {
    const seq = Sequence.fromProforma("SEQUEN[Glycan:{C8H13N1O5Na1:z+1}1Hex2]CE");

    const mod = seq.seq[5].mods[0];
    expect(mod.modValue.pipeValues[0].value).toBe("{C8H13N1O5Na1:z+1}1Hex2");
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should parse charged custom monosaccharide with negative charge", () => {
    const seq = Sequence.fromProforma("N[Glycan:{C6H10O8S1:z-1}1Hex2]PEPTIDE");

    const mod = seq.seq[0].mods[0];
    expect(mod.modValue.pipeValues[0].value).toBe("{C6H10O8S1:z-1}1Hex2");
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should parse multiple custom monosaccharides", () => {
    const seq = Sequence.fromProforma("N[Glycan:{C8H13N1O5}1{C6H10O5}2]PEPTIDE");

    const mod = seq.seq[0].mods[0];
    expect(mod.modValue.pipeValues[0].value).toBe("{C8H13N1O5}1{C6H10O5}2");
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should parse mixed standard and custom monosaccharides", () => {
    const seq = Sequence.fromProforma("N[Glycan:HexNAc2{C9H15N1O7}1Hex3]PEPTIDE");

    const mod = seq.seq[0].mods[0];
    expect(mod.modValue.pipeValues[0].value).toBe("HexNAc2{C9H15N1O7}1Hex3");
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should parse mixed custom and standard with charge", () => {
    const seq = Sequence.fromProforma("N[Glycan:{C8H13N1O5Na1:z+1}2Hex1HexNAc1]K");

    const mod = seq.seq[0].mods[0];
    expect(mod.modValue.pipeValues[0].value).toBe("{C8H13N1O5Na1:z+1}2Hex1HexNAc1");
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should parse labile custom monosaccharide", () => {
    const seq = Sequence.fromProforma("{Glycan:{C8H13N1O5}1Hex2}PEPTIDE");

    const labileMods = seq.mods.get(-3);
    expect(labileMods).toBeDefined();
    expect(labileMods!.length).toBe(1);
    expect(labileMods![0].modValue.pipeValues[0].value).toBe("{C8H13N1O5}1Hex2");
    expect(labileMods![0].modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should parse labile charged custom monosaccharide", () => {
    const seq = Sequence.fromProforma("{Glycan:{C8H13N1O5Na1:z+1}1}PEPTIDE");

    const labileMods = seq.mods.get(-3);
    expect(labileMods).toBeDefined();
    expect(labileMods![0].modValue.pipeValues[0].value).toBe("{C8H13N1O5Na1:z+1}1");
    expect(labileMods![0].modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should serialize custom monosaccharide", () => {
    const original = "SEQUEN[Glycan:{C8H13N1O5}1Hex2]CE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize charged custom monosaccharide", () => {
    const original = "SEQUEN[Glycan:{C8H13N1O5Na1:z+1}1Hex2]CE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize custom with isotopes", () => {
    const original = "SEQUEN[Glycan:{C8H13[15N1]O5}1Hex2]CE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should round-trip custom monosaccharides", () => {
    const testCases = [
      "SEQUEN[Glycan:{C8H13N1O5}1Hex2]CE",
      "SEQUEN[Glycan:{C8H13[15N1]O5}1Hex2]CE",
      "SEQUEN[Glycan:{C8H13N1O5Na1:z+1}1Hex2]CE",
      "N[Glycan:{C6H10O8S1:z-1}1Hex2]PEPTIDE",
      "N[Glycan:HexNAc2{C9H15N1O7}1Hex3]PEPTIDE",
      "{Glycan:{C8H13N1O5}1Hex2}PEPTIDE",
    ];

    for (const original of testCases) {
      const seq = Sequence.fromProforma(original);
      const proforma = seq.toProforma();

      const seq2 = Sequence.fromProforma(proforma);
      const proforma2 = seq2.toProforma();

      expect(proforma).toBe(original);
      expect(proforma2).toBe(original);
    }
  });

  test("should validate standard monosaccharides", () => {
    const seq = Sequence.fromProforma("N[Glycan:HexNAc2Hex3NeuAc1]K");

    const mod = seq.seq[0].mods[0];
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should validate mixed standard and custom", () => {
    const seq = Sequence.fromProforma("N[Glycan:Hex1{C8H13N1O5}1HexNAc2]K");

    const mod = seq.seq[0].mods[0];
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should handle custom monosaccharide with parenthetical occurrence", () => {
    const seq = Sequence.fromProforma("N[Glycan:{C8H13N1O5}(1)Hex(2)]K");

    const mod = seq.seq[0].mods[0];
    expect(mod.modValue.pipeValues[0].value).toBe("{C8H13N1O5}(1)Hex(2)");
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should handle complex custom formula", () => {
    const seq = Sequence.fromProforma("N[Glycan:{C11H17N1O9}1]K");

    const mod = seq.seq[0].mods[0];
    expect(mod.modValue.pipeValues[0].value).toBe("{C11H17N1O9}1");
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should handle multiple occurrences of same custom monosaccharide", () => {
    const seq = Sequence.fromProforma("N[Glycan:{C8H13N1O5}3]K");

    const mod = seq.seq[0].mods[0];
    expect(mod.modValue.pipeValues[0].value).toBe("{C8H13N1O5}3");
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
  });

  test("should handle custom monosaccharide with charge state on sequence", () => {
    const seq = Sequence.fromProforma("N[Glycan:{C8H13N1O5Na1:z+1}1Hex2]PEPTIDE/2");

    const mod = seq.seq[0].mods[0];
    expect(mod.modValue.pipeValues[0].value).toBe("{C8H13N1O5Na1:z+1}1Hex2");
    expect(mod.modValue.pipeValues[0].isValidGlycan).toBe(true);
    expect(seq.charge).toBe(2);
  });

  test("should validate glycan count requirements", () => {
    const validCases = [
      { glycan: "HexNAc", reason: "at end, count 1 implied" },
      { glycan: "HexNAc2Hex", reason: "HexNAc has count 2, Hex at end" },
      { glycan: "Hex(3)HexNAc2", reason: "explicit counts" },
      { glycan: "{C8H13N1O5}1Hex2", reason: "custom with count, Hex with count" },
    ];

    validCases.forEach(({ glycan, reason }) => {
      const seq = Sequence.fromProforma(`N[Glycan:${glycan}]K`);
      expect(seq.seq[0].mods[0].modValue.pipeValues[0].isValidGlycan).toBe(true);
    });
  });

  test("should reject invalid glycan counts", () => {
    const invalidCases = [
      { glycan: "HexNAcHex", reason: "HexNAc not at end, missing count" },
      { glycan: "HexNAc0", reason: "zero count not allowed" },
      { glycan: "{C8H13N1O5}Hex2", reason: "custom not at end, missing count" },
    ];

    invalidCases.forEach(({ glycan, reason }) => {
      const seq = Sequence.fromProforma(`N[Glycan:${glycan}]K`);
      expect(seq.seq[0].mods[0].modValue.pipeValues[0].isValidGlycan).toBe(false);
    });
  });
});
