import { Sequence } from "../sequence";

describe("ProForma 2.1: Terminal Global Modifications (Section 11.3.2)", () => {
  test("should parse N-terminal global modification", () => {
    const seq = Sequence.fromProforma("<[Acetyl]@N-term>PEPTIDE");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];
    expect(mod.targetResidues).toEqual(["N-term"]);
    expect(mod.globalModType).toBe("fixed");
  });

  test("should parse C-terminal global modification", () => {
    const seq = Sequence.fromProforma("<[Amidated]@C-term>PEPTIDE");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];
    expect(mod.targetResidues).toEqual(["C-term"]);
    expect(mod.globalModType).toBe("fixed");
  });

  test("should parse terminal-specific modification", () => {
    const seq = Sequence.fromProforma("<[Gln->pyro-Glu]@N-term:Q>QATPEILMCNSIGCLMG");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];
    expect(mod.targetResidues).toEqual(["N-term:Q"]);
  });

  test("should parse C-terminal specific modification", () => {
    const seq = Sequence.fromProforma("<[Oxidation]@C-term:G>PEPTIDEG");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];
    expect(mod.targetResidues).toEqual(["C-term:G"]);
  });

  test("should parse mixed amino acid and terminal targets", () => {
    const seq = Sequence.fromProforma("<[TMT6plex]@K,N-term>PEPTIDEK");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    const mod = globalMods[0];
    expect(mod.targetResidues).toContain("K");
    expect(mod.targetResidues).toContain("N-term");
  });

  test("should parse multiple terminal global modifications", () => {
    const seq = Sequence.fromProforma("<[TMT6plex]@K,N-term><[Oxidation]@M,C-term:G>MTPEILTCNSIGCLK");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(2);

    const mod1 = globalMods[0];
    expect(mod1.targetResidues).toContain("K");
    expect(mod1.targetResidues).toContain("N-term");

    const mod2 = globalMods[1];
    expect(mod2.targetResidues).toContain("M");
    expect(mod2.targetResidues).toContain("C-term:G");
  });

  test("should serialize N-terminal global modification", () => {
    const original = "<[Acetyl]@N-term>PEPTIDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize C-terminal global modification", () => {
    const original = "<[Amidated]@C-term>PEPTIDE";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should serialize terminal-specific modification", () => {
    const original = "<[Gln->pyro-Glu]@N-term:Q>QATPEILMCNSIGCLMG";
    const seq = Sequence.fromProforma(original);
    const proforma = seq.toProforma();

    expect(proforma).toBe(original);
  });

  test("should round-trip terminal global modifications", () => {
    const testCases = [
      "<[Acetyl]@N-term>PEPTIDE",
      "<[Amidated]@C-term>PEPTIDE",
      "<[Gln->pyro-Glu]@N-term:Q>QATPEILMCNSIGCLMG",
      "<[Oxidation]@C-term:G>PEPTIDEG",
      "<[TMT6plex]@K,N-term>PEPTIDEK",
      "<[TMT6plex]@K,N-term><[Oxidation]@M,C-term:G>MTPEILTCNSIGCLK",
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

  test("should handle N-terminal with modifications in sequence", () => {
    const seq = Sequence.fromProforma("<[Acetyl]@N-term>PE[Phospho]PTIDE");

    expect(seq.globalMods.length).toBe(1);
    expect(seq.globalMods[0].targetResidues).toEqual(["N-term"]);
    expect(seq.seq[1].mods.length).toBe(1);
    expect(seq.seq[1].mods[0].value).toBe("Phospho");
  });

  test("should handle both terminals in one modification", () => {
    const seq = Sequence.fromProforma("<[Label]@N-term,C-term>PEPTIDE");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    expect(globalMods[0].targetResidues).toContain("N-term");
    expect(globalMods[0].targetResidues).toContain("C-term");
  });

  test("should handle terminal modification with charge state", () => {
    const seq = Sequence.fromProforma("<[Acetyl]@N-term>PEPTIDE/2");

    expect(seq.globalMods.length).toBe(1);
    expect(seq.globalMods[0].targetResidues).toEqual(["N-term"]);
    expect(seq.charge).toBe(2);
  });

  test("should handle terminal modification with placement controls", () => {
    const seq = Sequence.fromProforma("<[TMT6plex|Limit:1]@K,N-term>PEPTIDEK");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    expect(globalMods[0].targetResidues).toContain("K");
    expect(globalMods[0].targetResidues).toContain("N-term");
    expect(globalMods[0].getLimitPerPosition()).toBe(1);
  });

  test("should differentiate N-term from regular N residue", () => {
    const seq = Sequence.fromProforma("<[Acetyl]@N-term>NPEPTIDE");
    const globalMods = seq.globalMods;

    expect(globalMods.length).toBe(1);
    expect(globalMods[0].targetResidues).toEqual(["N-term"]);
    expect(globalMods[0].targetResidues).not.toContain("N");
  });
});
