import { Sequence } from "../sequence";

describe("ProForma 2.1: Integration Tests - Complex Scenarios", () => {
  describe("Named Entities + Multiple Features", () => {
    test("should handle peptidoform name with terminal global mods and charge", () => {
      const seq = Sequence.fromProforma("(>TMT-labeled peptide)<[TMT6plex]@K,N-term>PEPTIDEK/2");

      expect(seq.peptidoformName).toBe("TMT-labeled peptide");
      expect(seq.globalMods.length).toBe(1);
      expect(seq.globalMods[0].targetResidues).toContain("K");
      expect(seq.globalMods[0].targetResidues).toContain("N-term");
      expect(seq.charge).toBe(2);
    });

    test("should handle all three naming levels with modifications", () => {
      const seq = Sequence.fromProforma(
        "(>>>Chimeric Spectrum 1234)(>>Precursor z=2)(>Phospho-peptide)<[Phospho]@S,T,Y>PEPT[Oxidation]IDES/2"
      );

      expect(seq.compoundIonName).toBe("Chimeric Spectrum 1234");
      expect(seq.peptidoformIonName).toBe("Precursor z=2");
      expect(seq.peptidoformName).toBe("Phospho-peptide");
      expect(seq.globalMods.length).toBe(1);
      expect(seq.seq[3].mods[0].value).toBe("Oxidation");
      expect(seq.charge).toBe(2);
    });

    test("should handle named entity with labile glycans", () => {
      const seq = Sequence.fromProforma(
        "(>Glycopeptide){Glycan:{C8H13N1O5}1Hex2}PEPN[Glycan:HexNAc2Hex3]TIDE"
      );

      expect(seq.peptidoformName).toBe("Glycopeptide");
      const labileMods = seq.mods.get(-3);
      expect(labileMods).toBeDefined();
      expect(labileMods![0].modValue.pipeValues[0].isValidGlycan).toBe(true);
      expect(seq.seq[3].mods[0].source).toBe("Glycan");
    });
  });

  describe("Terminal Global Modifications + Complex Scenarios", () => {
    test("should handle multiple terminal global mods with placement controls", () => {
      const seq = Sequence.fromProforma(
        "<[TMT6plex|Limit:1]@K,N-term><[Oxidation|Position:M,C]@M,C-term:G>MTPEILTCNSIGCLKG"
      );

      expect(seq.globalMods.length).toBe(2);
      expect(seq.globalMods[0].targetResidues).toContain("K");
      expect(seq.globalMods[0].targetResidues).toContain("N-term");
      expect(seq.globalMods[0].getLimitPerPosition()).toBe(1);
      expect(seq.globalMods[1].targetResidues).toContain("M");
      expect(seq.globalMods[1].targetResidues).toContain("C-term:G");
    });

    test("should handle terminal global mods with ambiguous modifications", () => {
      const seq = Sequence.fromProforma(
        "<[Gln->pyro-Glu]@N-term:Q>QPEPTIDE[Phospho#1]S[#1]T"
      );

      expect(seq.globalMods.length).toBe(1);
      expect(seq.globalMods[0].targetResidues).toEqual(["N-term:Q"]);
      expect(seq.seq[7].mods[0].ambiguityGroup).toBe("1");
      expect(seq.seq[8].mods[0].isAmbiguityRef).toBe(true);
    });

    test("should handle terminal global mods with charge states", () => {
      const seq = Sequence.fromProforma(
        "<[Acetyl]@N-term><[TMT6plex]@K>PEPTIDEK/2"
      );

      expect(seq.globalMods.length).toBe(2);
      expect(seq.globalMods[0].targetResidues).toEqual(["N-term"]);
      expect(seq.globalMods[1].targetResidues).toEqual(["K"]);
      expect(seq.charge).toBe(2);
    });
  });

  describe("Custom Monosaccharides + Complex Glycosylation", () => {
    test("should handle mixed custom and standard monosaccharides", () => {
      const seq = Sequence.fromProforma(
        "PEPN[Glycan:HexNAc2{C8H13N1O5Na1:z+1}1Hex3]TIDE"
      );

      expect(seq.seq[3].mods[0].modValue.pipeValues[0].isValidGlycan).toBe(true);
      expect(seq.seq[3].mods[0].source).toBe("Glycan");
    });

    test("should handle labile and static custom monosaccharides together", () => {
      const seq = Sequence.fromProforma(
        "{Glycan:{C11H17N1O9}1Hex2}PEPN[Glycan:{C8H13[15N1]O5}2Hex1]TIDE"
      );

      const labileMods = seq.mods.get(-3);
      expect(labileMods).toBeDefined();
      expect(labileMods![0].modValue.pipeValues[0].isValidGlycan).toBe(true);
      expect(seq.seq[3].mods[0].modValue.pipeValues[0].isValidGlycan).toBe(true);
      expect(seq.seq[3].mods[0].modValue.pipeValues[0].value).toContain("[15N1]");
    });

    test("should handle custom monosaccharides in sequences", () => {
      const seq = Sequence.fromProforma(
        "NSTPEPN[Glycan:{C8H13N1O5}1Hex2]TIDE"
      );

      expect(seq.seq[6].mods[0].modValue.pipeValues[0].isValidGlycan).toBe(true);
      expect(seq.seq[6].mods[0].source).toBe("Glycan");
    });
  });

  describe("Charged Formulas + Ion Notation", () => {
    test("should handle charged formula with ion type notation", () => {
      const seq = Sequence.fromProforma("PEPTIDE[Formula:Zn1:z+2]-[b-type-ion]");

      expect(seq.seq[6].mods[0].modValue.pipeValues[0].charge).toBe("z+2");
      expect(seq.seq[6].mods[0].modValue.pipeValues[0].chargeValue).toBe(2);
      const cTermMods = seq.mods.get(-2);
      expect(cTermMods).toBeDefined();
      expect(cTermMods![0].isIonType).toBe(true);
    });

    test("should handle multiple charged formulas with different charges", () => {
      const seq = Sequence.fromProforma(
        "PEPT[Formula:C2H3NO:z-1]IDE[Formula:Zn1:z+2]K"
      );

      expect(seq.seq[3].mods[0].modValue.pipeValues[0].chargeValue).toBe(-1);
      expect(seq.seq[6].mods[0].modValue.pipeValues[0].chargeValue).toBe(2);
    });

    test("should handle charged glycan with ion notation", () => {
      const seq = Sequence.fromProforma(
        "N[Glycan:{C8H13N1O5Na1:z+1}1Hex2]PEPTIDE-[y-type-ion]"
      );

      expect(seq.seq[0].mods[0].modValue.pipeValues[0].isValidGlycan).toBe(true);
      const cTermMods = seq.mods.get(-2);
      expect(cTermMods![0].isIonType).toBe(true);
    });
  });

  describe("Placement Controls + Advanced Features", () => {
    test("should handle basic placement controls on fixed position mods", () => {
      const seq = Sequence.fromProforma(
        "PEPT[Phospho|INFO:High confidence]IDE"
      );

      expect(seq.seq[3].mods[0].value).toBe("Phospho");
      expect(seq.seq[3].mods[0].infoTags.length).toBeGreaterThan(0);
    });

    test("should handle multiple modifications with ambiguity", () => {
      const seq = Sequence.fromProforma(
        "PEPT[Phospho#G1]IDE[#G1]"
      );

      expect(seq.seq[3].mods[0].ambiguityGroup).toBe("G1");
      expect(seq.seq[6].mods[0].isAmbiguityRef).toBe(true);
    });

  });

  describe("Chimeric Spectra with ProForma 2.1", () => {
    test("should handle chimeric with named entities", () => {
      const seq = Sequence.fromProforma(
        "(>>>Chimeric Scan 5678)(>Peptide1)PEPTIDE+SEQUENCEK"
      );

      expect(seq.compoundIonName).toBe("Chimeric Scan 5678");
      expect(seq.peptidoformName).toBe("Peptide1");
      expect(seq.isChimeric).toBe(true);
    });

  });

  describe("Multi-Chain Sequences with ProForma 2.1", () => {
    test("should handle multi-chain with naming level on first chain", () => {
      const seq = Sequence.fromProforma(
        "(>>>Disulfide-linked)(>>Ion pair)(>Chain1)PEPTIDEC//CSEQUENCE"
      );

      expect(seq.compoundIonName).toBe("Disulfide-linked");
      expect(seq.peptidoformIonName).toBe("Ion pair");
      expect(seq.isMultiChain).toBe(true);
      expect(seq.chains[0].peptidoformName).toBe("Chain1");
    });

    test("should handle multi-chain with different terminal global mods", () => {
      const seq = Sequence.fromProforma(
        "<[Acetyl]@N-term>PEPTIDE//<[TMT6plex]@K,N-term>KSEQUENCEK"
      );

      expect(seq.isMultiChain).toBe(true);
      expect(seq.chains[0].globalMods[0].targetResidues).toEqual(["N-term"]);
      expect(seq.chains[1].globalMods[0].targetResidues).toContain("K");
      expect(seq.chains[1].globalMods[0].targetResidues).toContain("N-term");
    });
  });

  describe("Real-World Complex Scenarios", () => {
    test("should handle TMT-labeled phosphopeptide with multiple PTMs", () => {
      const seq = Sequence.fromProforma(
        "(>TMT-labeled phosphopeptide)<[TMT6plex]@K,N-term><[Oxidation]@M>MTPEILTS[Phospho]CNSIGCLK/2"
      );

      expect(seq.peptidoformName).toBe("TMT-labeled phosphopeptide");
      expect(seq.globalMods.length).toBe(2);
      expect(seq.globalMods[0].targetResidues).toContain("N-term");
      expect(seq.globalMods[1].targetResidues).toEqual(["M"]);
      expect(seq.seq[7].mods[0].value).toBe("Phospho");
      expect(seq.charge).toBe(2);
    });

    test("should handle glycopeptide with multiple glycosylation sites", () => {
      const seq = Sequence.fromProforma(
        "{Glycan:Hex1HexNAc1}N[Glycan:{C8H13N1O5}2Hex3HexNAc2]GSTN[Glycan:HexNAc2Hex3NeuAc1]VTPEPTIDE"
      );

      const labileMods = seq.mods.get(-3);
      expect(labileMods).toBeDefined();
      expect(seq.seq[0].mods[0].modValue.pipeValues[0].isValidGlycan).toBe(true);
      expect(seq.seq[4].mods[0].modValue.pipeValues[0].isValidGlycan).toBe(true);
    });

    test("should handle complex proteoform with multiple modification types", () => {
      const seq = Sequence.fromProforma(
        "(>Ubiquitinated protein)[Acetyl]-MRSGSHHHHHHGSPEPTM[Oxidation]IDEK[Ubiquitin#BRANCH]SEQUENCE-[Amidated]"
      );

      expect(seq.peptidoformName).toBe("Ubiquitinated protein");
      const nTermMods = seq.mods.get(-1);
      expect(nTermMods![0].value).toBe("Acetyl");
      expect(seq.seq[17].mods[0].value).toBe("Oxidation");
      expect(seq.seq[21].mods[0].isBranch).toBe(true);
      const cTermMods = seq.mods.get(-2);
      expect(cTermMods![0].value).toBe("Amidated");
    });

    test("should handle metal-binding peptide with charged formulas", () => {
      const seq = Sequence.fromProforma(
        "(>Zinc finger peptide)CAQECGK[Formula:Zn1:z+2]SFTSALK[Formula:Zn1:z+2]SRHK/3"
      );

      expect(seq.peptidoformName).toBe("Zinc finger peptide");
      expect(seq.seq[6].mods[0].modValue.pipeValues[0].chargeValue).toBe(2);
      expect(seq.seq[13].mods[0].modValue.pipeValues[0].chargeValue).toBe(2);
      expect(seq.charge).toBe(3);
    });

    test("should handle peptide with unknown position mods and basic placement controls", () => {
      const seq = Sequence.fromProforma(
        "[Phospho]^3[Oxidation]^2?MSTPEPTMSTY"
      );

      const unknownMods = seq.mods.get(-4);
      expect(unknownMods!.length).toBe(5);
      expect(unknownMods![0].value).toBe("Phospho");
      expect(unknownMods![3].value).toBe("Oxidation");
    });
  });

  describe("Edge Cases and Complex Combinations", () => {
    test("should handle all ProForma 2.1 features in one sequence", () => {
      const seq = Sequence.fromProforma(
        "(>>>MS2 Spectrum)(>>Precursor z=2)(>Complex peptide)<[TMT6plex]@K,N-term><[Gln->pyro-Glu]@N-term:Q>" +
        "{Glycan:{C8H13N1O5}1}[Acetyl]-QN[Glycan:HexNAc2{C11H17N1O9}1]PEPTM[Oxidation|INFO:High confidence]IDEK[Formula:Zn1:z+2]-[b-type-ion]/2"
      );

      expect(seq.compoundIonName).toBe("MS2 Spectrum");
      expect(seq.peptidoformIonName).toBe("Precursor z=2");
      expect(seq.peptidoformName).toBe("Complex peptide");
      expect(seq.globalMods.length).toBe(2);

      const labileMods = seq.mods.get(-3);
      expect(labileMods).toBeDefined();
      expect(labileMods![0].modValue.pipeValues[0].isValidGlycan).toBe(true);

      const nTermMods = seq.mods.get(-1);
      expect(nTermMods![0].value).toBe("Acetyl");

      expect(seq.seq[1].mods[0].modValue.pipeValues[0].isValidGlycan).toBe(true);
      expect(seq.seq[6].mods[0].infoTags.length).toBeGreaterThan(0);
      expect(seq.seq[10].mods[0].modValue.pipeValues[0].chargeValue).toBe(2);

      const cTermMods = seq.mods.get(-2);
      expect(cTermMods![0].isIonType).toBe(true);

      expect(seq.charge).toBe(2);
    });


    test("should round-trip complex integrated sequences", () => {
      const testCases = [
        "(>Named peptide)<[TMT6plex]@K,N-term>PEPTIDEK/2",
        "{Glycan:{C8H13N1O5}1Hex2}N[Glycan:HexNAc2]PEPTIDE",
        "<[Gln->pyro-Glu]@N-term:Q>QPEPTM[Oxidation]IDE-[b-type-ion]",
        "[Phospho]^2?STPEPTIDE",
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

    test("should handle terminal modifications with global terminal mods", () => {
      const seq = Sequence.fromProforma(
        "<[Acetyl]@N-term>[Carbamyl]-PEPTIDE-[Methyl]"
      );

      expect(seq.globalMods.length).toBe(1);
      expect(seq.globalMods[0].targetResidues).toEqual(["N-term"]);

      const nTermMods = seq.mods.get(-1);
      expect(nTermMods![0].value).toBe("Carbamyl");

      const cTermMods = seq.mods.get(-2);
      expect(cTermMods![0].value).toBe("Methyl");
    });

    test("should handle sequence ambiguity with ProForma 2.1 features", () => {
      const seq = Sequence.fromProforma(
        "(>Ambiguous peptide)<[TMT6plex]@K>PEPT(?IL)DE[Formula:Zn1:z+2]K/2"
      );

      expect(seq.peptidoformName).toBe("Ambiguous peptide");
      expect(seq.globalMods.length).toBe(1);
      expect(seq.sequenceAmbiguities.length).toBe(1);
      expect(seq.sequenceAmbiguities[0].value).toBe("IL");
      expect(seq.seq[5].mods[0].modValue.pipeValues[0].chargeValue).toBe(2);
      expect(seq.charge).toBe(2);
    });

    test("should handle isotope labels with ProForma 2.1 features", () => {
      const seq = Sequence.fromProforma(
        "(>Heavy labeled)<[Label:13C(6)15N(2)]@K,R>PEPTIDER"
      );

      expect(seq.peptidoformName).toBe("Heavy labeled");
      expect(seq.globalMods.length).toBe(1);
      expect(seq.globalMods[0].value).toContain("13C");
      expect(seq.globalMods[0].value).toContain("15N");
    });
  });

  describe("Serialization Integrity", () => {
    test("should maintain order of multiple global modifications", () => {
      const original = "<[TMT6plex]@K,N-term><[Oxidation]@M><[Phospho]@S,T,Y>MSTPEPTIDEK";
      const seq = Sequence.fromProforma(original);
      const proforma = seq.toProforma();

      expect(proforma).toBe(original);
      expect(seq.globalMods.length).toBe(3);
    });

    test("should maintain complex nested structures", () => {
      const original = "(>>>C1)(>>I1)(>P1)<[Mod]@N-term>{Glycan:Hex1}[Ac]-N[Gly:H1]S-[Am]/2";
      const seq = Sequence.fromProforma(original);
      const proforma = seq.toProforma();

      expect(seq.compoundIonName).toBe("C1");
      expect(seq.peptidoformIonName).toBe("I1");
      expect(seq.peptidoformName).toBe("P1");
      expect(proforma).toBe(original);
    });
  });

  describe("Performance and Stress Tests", () => {
    test("should handle very long sequence with multiple modifications", () => {
      const longSeq = "M".repeat(50);
      const seq = Sequence.fromProforma(
        `<[Oxidation]@M>${longSeq.split("").map((aa, i) =>
          i % 5 === 0 ? `${aa}[Oxidation]` : aa
        ).join("")}`
      );

      expect(seq.globalMods.length).toBe(1);
      expect(seq.seq.length).toBe(50);
      const modsCount = seq.seq.filter(aa => aa.mods.length > 0).length;
      expect(modsCount).toBe(10);
    });

    test("should handle many unknown position modifications", () => {
      const seq = Sequence.fromProforma(
        "[Phospho|Position:S,T,Y]^10?SYTSTPEPTIDESTSTY"
      );

      const unknownMods = seq.mods.get(-4);
      expect(unknownMods!.length).toBe(10);
    });
  });
});
