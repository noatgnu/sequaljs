import { Sequence } from "../sequence";

describe("ProForma 2.1: Named Entities - Peptidoform Naming (Section 8.2)", () => {
  test("should parse peptidoform name", () => {
    const seq = Sequence.fromProforma("(>Tryptic peptide)PEPTIDE");

    expect(seq.peptidoformName).toBe("Tryptic peptide");
    expect(seq.peptidoformIonName).toBeNull();
    expect(seq.compoundIonName).toBeNull();
  });

  test("should parse peptidoform ion name", () => {
    const seq = Sequence.fromProforma("(>>Precursor ion z=2)PEPTIDE");

    expect(seq.peptidoformName).toBeNull();
    expect(seq.peptidoformIonName).toBe("Precursor ion z=2");
    expect(seq.compoundIonName).toBeNull();
  });

  test("should parse compound ion name", () => {
    const seq = Sequence.fromProforma("(>>>MS2 Scan 1234)PEPTIDE");

    expect(seq.peptidoformName).toBeNull();
    expect(seq.peptidoformIonName).toBeNull();
    expect(seq.compoundIonName).toBe("MS2 Scan 1234");
  });

  test("should parse all three naming levels", () => {
    const seq = Sequence.fromProforma("(>>>MS2)(>>Precursor)(>Albumin)PEPTIDE");

    expect(seq.peptidoformName).toBe("Albumin");
    expect(seq.peptidoformIonName).toBe("Precursor");
    expect(seq.compoundIonName).toBe("MS2");
  });

  test("should parse peptidoform name with modifications", () => {
    const seq = Sequence.fromProforma("(>Modified peptide)PE[Phospho]PTIDE");

    expect(seq.peptidoformName).toBe("Modified peptide");
    expect(seq.seq[1].mods.length).toBe(1);
    expect(seq.seq[1].mods[0].value).toBe("Phospho");
  });

  test("should parse name with balanced parentheses", () => {
    const seq = Sequence.fromProforma("(>Protein (isoform 2))PEPTIDE");

    expect(seq.peptidoformName).toBe("Protein (isoform 2)");
  });

  test("should parse FASTA-like header as name", () => {
    const seq = Sequence.fromProforma("(>sp|P12345|HUMAN_PROTEIN Albumin)PEPTIDE");

    expect(seq.peptidoformName).toBe("sp|P12345|HUMAN_PROTEIN Albumin");
  });

  test("should parse name with charge state", () => {
    const seq = Sequence.fromProforma("(>Tryptic peptide)PEPTIDE/2");

    expect(seq.peptidoformName).toBe("Tryptic peptide");
    expect(seq.charge).toBe(2);
  });

  test("should parse name with global modifications", () => {
    const seq = Sequence.fromProforma("(>Phospho peptide)<[Phospho]@S,T,Y>PEPTIDES");

    expect(seq.peptidoformName).toBe("Phospho peptide");
    expect(seq.globalMods.length).toBe(1);
  });

  test("should serialize peptidoform name", () => {
    const original = "(>Tryptic peptide)PEPTIDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize peptidoform ion name", () => {
    const original = "(>>Precursor ion z=2)PEPTIDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize compound ion name", () => {
    const original = "(>>>MS2 Scan 1234)PEPTIDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize all three naming levels", () => {
    const original = "(>>>MS2)(>>Precursor)(>Albumin)PEPTIDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should round-trip peptidoform names", () => {
    const testCases = [
      "(>Tryptic peptide)PEPTIDE",
      "(>>Precursor ion z=2)PEPTIDE",
      "(>>>MS2 Scan 1234)PEPTIDE",
      "(>>>MS2)(>>Precursor)(>Albumin)PEPTIDE",
      "(>Protein (isoform 2))PEPTIDE",
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

  test("should handle name with terminal modifications", () => {
    const seq = Sequence.fromProforma("(>N-term modified)[Acetyl]-PEPTIDE");

    expect(seq.peptidoformName).toBe("N-term modified");
    const nTermMods = seq.mods.get(-1);
    expect(nTermMods).toBeDefined();
    expect(nTermMods!.length).toBe(1);
  });

  test("should handle multiple peptidoforms in chimeric spectrum", () => {
    const seq = Sequence.fromProforma("(>>>Chimeric)(>Peptide1)PEPTIDE+(>Peptide2)SEQUENCE");

    expect(seq.compoundIonName).toBe("Chimeric");
    expect(seq.peptidoformName).toBe("Peptide1");
    expect(seq.isChimeric).toBe(true);
  });

  test("should preserve names with complex modifications", () => {
    const seq = Sequence.fromProforma("(>Complex peptide)PE[Phospho]PT[Oxidation]IDE");

    expect(seq.peptidoformName).toBe("Complex peptide");
    expect(seq.seq[1].mods[0].value).toBe("Phospho");
    expect(seq.seq[3].mods[0].value).toBe("Oxidation");
  });

  test("should handle empty name fields correctly", () => {
    const seq = Sequence.fromProforma("PEPTIDE");

    expect(seq.peptidoformName).toBeNull();
    expect(seq.peptidoformIonName).toBeNull();
    expect(seq.compoundIonName).toBeNull();
  });

  test("should handle name with special characters", () => {
    const seq = Sequence.fromProforma("(>Peptide [Oxidized])PEPTIDE");

    expect(seq.peptidoformName).toBe("Peptide [Oxidized]");
  });
});
