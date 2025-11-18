import { Sequence } from "../sequence";
import { PipeValue } from "../modification";

describe("ProForma 2.1: Charged Formulas (Section 11.1)", () => {
  test("should parse basic charged formula with positive charge", () => {
    const seq = Sequence.fromProforma("PEPT[Formula:Zn1:z+2]IDE");
    const aa = seq.seq[3]; // 'T' at position 3
    expect(aa.mods.length).toBe(1);

    const mod = aa.mods[0];
    expect(mod.modValue).toBeDefined();

    const formulaPv = mod.modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.FORMULA
    );
    expect(formulaPv).toBeDefined();
    expect(formulaPv!.value).toBe("Zn1");
    expect(formulaPv!.charge).toBe("z+2");
    expect(formulaPv!.chargeValue).toBe(2);
  });

  test("should parse charged formula with negative charge", () => {
    const seq = Sequence.fromProforma("PEPT[Formula:Cu1:z-1]IDE");
    const aa = seq.seq[3]; // 'T' at position 3
    expect(aa.mods.length).toBe(1);

    const mod = aa.mods[0];
    const formulaPv = mod.modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.FORMULA
    );

    expect(formulaPv).toBeDefined();
    expect(formulaPv!.value).toBe("Cu1");
    expect(formulaPv!.charge).toBe("z-1");
    expect(formulaPv!.chargeValue).toBe(-1);
  });

  test("should handle formula without charge", () => {
    const seq = Sequence.fromProforma("PEPT[Formula:C2H3NO]IDE");
    const aa = seq.seq[3];
    expect(aa.mods.length).toBe(1);

    const mod = aa.mods[0];
    const formulaPv = mod.modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.FORMULA
    );

    expect(formulaPv).toBeDefined();
    expect(formulaPv!.value).toBe("C2H3NO");
    expect(formulaPv!.charge).toBeNull();
    expect(formulaPv!.chargeValue).toBeNull();
  });

  test("should parse multiple charged formulas in sequence", () => {
    const seq = Sequence.fromProforma("PE[Formula:Cu1:z+1]PT[Formula:Zn1:z+2]IDE");

    // First modification (E)
    const aa1 = seq.seq[1];
    expect(aa1.mods.length).toBe(1);
    const pv1 = aa1.mods[0].modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.FORMULA
    );
    expect(pv1!.value).toBe("Cu1");
    expect(pv1!.charge).toBe("z+1");
    expect(pv1!.chargeValue).toBe(1);

    // Second modification (T)
    const aa2 = seq.seq[3];
    expect(aa2.mods.length).toBe(1);
    const pv2 = aa2.mods[0].modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.FORMULA
    );
    expect(pv2!.value).toBe("Zn1");
    expect(pv2!.charge).toBe("z+2");
    expect(pv2!.chargeValue).toBe(2);
  });

  test("should serialize charged formula with positive charge", () => {
    const original = "PEPT[Formula:Zn1:z+2]IDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize charged formula with negative charge", () => {
    const original = "PEPT[Formula:Cu1:z-1]IDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should round-trip charged formula", () => {
    const testCases = [
      "PEPT[Formula:Zn1:z+2]IDE",
      "PEPT[Formula:Cu1:z-1]IDE",
      "PE[Formula:Fe1:z+3]PTIDE",
      "PEPT[Formula:Mg1:z+2]ID[Formula:Ca1:z+2]E",
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

  test("should handle complex formula with charge", () => {
    const seq = Sequence.fromProforma("PEPT[Formula:C10H15N3O6S:z+1]IDE");
    const aa = seq.seq[3];
    const formulaPv = aa.mods[0].modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.FORMULA
    );

    expect(formulaPv!.value).toBe("C10H15N3O6S");
    expect(formulaPv!.charge).toBe("z+1");
    expect(formulaPv!.chargeValue).toBe(1);
  });

  test("should handle charged formula at N-terminus", () => {
    const seq = Sequence.fromProforma("[Formula:Zn1:z+2]-PEPTIDE");
    const nTermMods = seq.mods.get(-1);

    expect(nTermMods).toBeDefined();
    expect(nTermMods!.length).toBe(1);

    const formulaPv = nTermMods![0].modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.FORMULA
    );
    expect(formulaPv!.value).toBe("Zn1");
    expect(formulaPv!.charge).toBe("z+2");
  });

  test("should handle charged formula at C-terminus", () => {
    const seq = Sequence.fromProforma("PEPTIDE-[Formula:Cu1:z-1]");
    const cTermMods = seq.mods.get(-2);

    expect(cTermMods).toBeDefined();
    expect(cTermMods!.length).toBe(1);

    const formulaPv = cTermMods![0].modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.FORMULA
    );
    expect(formulaPv!.value).toBe("Cu1");
    expect(formulaPv!.charge).toBe("z-1");
  });

  test("should preserve charge value sign", () => {
    const testCases = [
      { proforma: "PEPT[Formula:Zn1:z+2]IDE", expectedCharge: 2 },
      { proforma: "PEPT[Formula:Cu1:z-2]IDE", expectedCharge: -2 },
      { proforma: "PEPT[Formula:Fe1:z+3]IDE", expectedCharge: 3 },
      { proforma: "PEPT[Formula:Mg1:z+1]IDE", expectedCharge: 1 },
    ];

    for (const { proforma, expectedCharge } of testCases) {
      const seq = Sequence.fromProforma(proforma);
      const aa = seq.seq[3];
      const formulaPv = aa.mods[0].modValue.pipeValues.find(
        (pv) => pv.type === PipeValue.FORMULA
      );

      expect(formulaPv!.chargeValue).toBe(expectedCharge);
    }
  });

  test("should handle charged formula with pipe values", () => {
    const seq = Sequence.fromProforma("PEPT[Formula:Zn1:z+2|INFO:metal binding]IDE");
    const aa = seq.seq[3];
    const mod = aa.mods[0];

    const formulaPv = mod.modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.FORMULA
    );
    expect(formulaPv!.value).toBe("Zn1");
    expect(formulaPv!.charge).toBe("z+2");

    const infoPv = mod.modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.INFO_TAG
    );
    expect(infoPv).toBeDefined();
    expect(infoPv!.value).toBe("metal binding");
  });

  test("should differentiate between uncharged and charged formulas", () => {
    const seq1 = Sequence.fromProforma("PEPT[Formula:Zn1]IDE");
    const seq2 = Sequence.fromProforma("PEPT[Formula:Zn1:z+2]IDE");

    const pv1 = seq1.seq[3].mods[0].modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.FORMULA
    );
    const pv2 = seq2.seq[3].mods[0].modValue.pipeValues.find(
      (pv) => pv.type === PipeValue.FORMULA
    );

    expect(pv1!.charge).toBeNull();
    expect(pv2!.charge).toBe("z+2");
  });

  test("should serialize charged formula only when charge is present", () => {
    const seq1 = Sequence.fromProforma("PEPT[Formula:Zn1]IDE");
    const seq2 = Sequence.fromProforma("PEPT[Formula:Zn1:z+2]IDE");

    expect(seq1.toProforma()).toBe("PEPT[Formula:Zn1]IDE");
    expect(seq2.toProforma()).toBe("PEPT[Formula:Zn1:z+2]IDE");
  });
});
