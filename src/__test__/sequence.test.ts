import { Sequence } from '../sequence';
import { Modification } from '../modification';

describe('ProForma', () => {
  test('basic peptide with modification', () => {
    const proforma = "PEP[Phospho]TIDE";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).toBe("PEPTIDE");
    expect(seq.seq[2].mods[0].modValue.primaryValue).toBe("Phospho");
    expect(seq.toProforma()).toBe(proforma);
  });

  test('mass shift notation', () => {
    const proforma = "PEP[+79.966]TIDE";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).toBe("PEPTIDE");
    expect(seq.seq[2].mods[0].modValue.primaryValue).toBe("+79.966");
    expect(Math.abs(seq.seq[2].mods[0].mass - 79.966)).toBeLessThan(0.0001);
    expect(seq.toProforma()).toBe("PEP[+79.966]TIDE");
  });

  test('multiple modifications', () => {
    const proforma = "PEPS[Phospho][Acetyl]TIDE";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).toBe("PEPSTIDE");
    expect(seq.seq[3].mods.length).toBe(2);
    expect(seq.seq[3].mods[0].modValue.primaryValue).toBe("Phospho");
    expect(seq.seq[3].mods[1].modValue.primaryValue).toBe("Acetyl");
    expect(seq.toProforma()).toBe(proforma);
  });

  test('terminal modifications', () => {
    const proforma = "[Acetyl]-PEPTIDE-[Amidated]";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).toBe("PEPTIDE");

    // Check N-terminal modification
    const nTermMods = seq.mods.get(-1);
    expect(nTermMods).toBeDefined();
    if (nTermMods) {
      expect(nTermMods[0].modValue.primaryValue).toBe("Acetyl");
    }

    // Check C-terminal modification
    const cTermMods = seq.mods.get(-2);
    expect(cTermMods).toBeDefined();
    if (cTermMods) {
      expect(cTermMods[0].modValue.primaryValue).toBe("Amidated");
    }

    expect(seq.toProforma()).toBe(proforma);
  });

  test('ambiguous modifications', () => {
    const proforma = "PEPS{Phospho}TIDE";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).toBe("PEPSTIDE");
    expect(seq.seq[3].mods[0].modValue.primaryValue).toBe("Phospho");
    expect(seq.seq[3].mods[0].modType).toBe("ambiguous");
    expect(seq.toProforma()).toBe(proforma);
  });

  test('complex sequence', () => {
    const proforma = "[Acetyl]-PEP[Phospho]T{Oxidation}IDE-[Amidated]";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).toBe("PEPTIDE");

    // Check N-terminal modification
    const nTermMods = seq.mods.get(-1);
    expect(nTermMods).toBeDefined();
    if (nTermMods) {
      expect(nTermMods[0].modValue.primaryValue).toBe("Acetyl");
    }

    // Check residue modifications
    expect(seq.seq[2].mods[0].modValue.primaryValue).toBe("Phospho");
    expect(seq.seq[3].mods[0].modValue.primaryValue).toBe("Oxidation");
    expect(seq.seq[3].mods[0].modType).toBe("ambiguous");

    // Check C-terminal modification
    const cTermMods = seq.mods.get(-2);
    expect(cTermMods).toBeDefined();
    if (cTermMods) {
      expect(cTermMods[0].modValue.primaryValue).toBe("Amidated");
    }

    expect(seq.toProforma()).toBe(proforma);
  });

  test('negative mass shift', () => {
    const proforma = "PEP[-17.027]TIDE";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).toBe("PEPTIDE");
    expect(seq.seq[2].mods[0].modValue.primaryValue).toBe("-17.027");
    expect(Math.abs(seq.seq[2].mods[0].mass + 17.027)).toBeLessThan(0.0001);
  });

  test('conversion from sequence to proforma', () => {
    const seq = new Sequence("PEPTIDE");
    seq.seq[2].addModification(new Modification("Phospho"));

    const proforma = seq.toProforma();
    expect(proforma).toBe("PEP[Phospho]TIDE");

    const seq2 = Sequence.fromProforma(proforma);
    expect(seq2.toStrippedString()).toBe("PEPTIDE");
    expect(seq2.seq[2].mods[0].modValue.primaryValue).toBe("Phospho");
  });

  test('inter chain crosslinks', () => {
    const proforma = "SEK[XLMOD:02001#XL1]UENCE//EMEVTK[#XL1]SESPEK";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.isMultiChain).toBe(true);
    expect(seq.chains.length).toBe(2);

    expect(seq.chains[0].toStrippedString()).toBe("SEKUENCE");
    expect(seq.chains[0].seq[2].mods[0].modValue.primaryValue).toBe("02001");
    expect(seq.chains[0].seq[2].mods[0].crosslinkId).toBe("XL1");

    expect(seq.chains[1].toStrippedString()).toBe("EMEVTKSESPEK");
    expect(seq.chains[1].seq[5].mods[0].isCrosslinkRef).toBe(true);
    expect(seq.chains[1].seq[5].mods[0].crosslinkId).toBe("XL1");

    expect(seq.toProforma()).toBe(proforma);
  });

  test('disulfide bonds', () => {
    const proforma = "EVTSEKC[XLMOD:00034#XL1]LEMSC[#XL1]EFD";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).not.toBe("EVTSEKCLEMMSCEFF");

    expect(seq.seq[6].mods[0].modValue.primaryValue).toBe("00034");
    expect(seq.seq[6].mods[0].source).toBe("XLMOD");
    expect(seq.seq[6].mods[0].crosslinkId).toBe("XL1");
    expect(seq.seq[11].mods[0].isCrosslinkRef).toBe(true);

    expect(seq.toProforma()).toBe(proforma);
  });

  test('branched peptides', () => {
    const proforma = "ETFGD[MOD:00093#BRANCH]LEMSEFD";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).toBe("ETFGDLEMSEFD");
    expect(seq.seq[4].mods[0].source).toBe("MOD");
    expect(seq.seq[4].mods[0].modValue.primaryValue).toBe("00093");
    expect(seq.seq[4].mods[0].isBranch).toBe(true);

    expect(seq.toProforma()).toBe(proforma);

    const proforma2 = "ETFGD[MOD:00093#BRANCH]LEMS[#BRANCH]EFD";
    const seq2 = Sequence.fromProforma(proforma2);

    expect(seq2.seq[8].mods[0].isBranchRef).toBe(true);
    expect(seq2.toProforma()).toBe(proforma2);
  });

  test('valid labile modifications', () => {
    const proformaStr = "{Glycan:Hex}EMEVNESPEK";
    const seq = Sequence.fromProforma(proformaStr);

    expect(seq.toStrippedString()).toBe("EMEVNESPEK");

    const labileMods = seq.mods.get(-3);
    expect(labileMods).toBeDefined();
    if (labileMods) {
      expect(labileMods.length).toBe(1);
      expect(labileMods[0].modValue.primaryValue).toBe("Hex");
      expect(labileMods[0].source).toBe("Glycan");
    }
    expect(seq.toProforma()).toBe(proformaStr);

    const proformaStr2 = "{Glycan:Hex}{Glycan:NeuAc}EMEVNESPEK";
    const seq2 = Sequence.fromProforma(proformaStr2);

    expect(seq2.toStrippedString()).toBe("EMEVNESPEK");

    const labileMods2 = seq2.mods.get(-3);
    expect(labileMods2).toBeDefined();
    if (labileMods2) {
      expect(labileMods2.length).toBe(2);
      expect(labileMods2[0].modValue.primaryValue).toBe("Hex");
      expect(labileMods2[1].modValue.primaryValue).toBe("NeuAc");
    }
    expect(seq2.toProforma()).toBe(proformaStr2);
  });

  test('unknown position modifications', () => {
    const seq = Sequence.fromProforma("[Phospho]?EMEVNESPEK");

    expect(seq.toStrippedString()).toBe("EMEVNESPEK");

    const unknownMods = seq.mods.get(-4);
    expect(unknownMods).toBeDefined();
    if (unknownMods) {
      expect(unknownMods.length).toBe(1);
      expect(unknownMods[0].modValue.primaryValue).toBe("Phospho");
    }

    expect(seq.toProforma()).toBe("[Phospho]?EMEVNESPEK");

    const seq2 = Sequence.fromProforma("[Phospho][Phospho]?EMEVNESPEK");

    expect(seq2.toStrippedString()).toBe("EMEVNESPEK");

    const unknownMods2 = seq2.mods.get(-4);
    expect(unknownMods2).toBeDefined();
    if (unknownMods2) {
      expect(unknownMods2.length).toBe(2);
      expect(unknownMods2.every(mod => mod.modValue.primaryValue === "Phospho")).toBe(true);
    }

    expect(seq2.toProforma()).toBe("[Phospho]^2?EMEVNESPEK");

    const seq3 = Sequence.fromProforma("[Phospho]^2?EMEVNESPEK");

    expect(seq3.toStrippedString()).toBe("EMEVNESPEK");

    const unknownMods3 = seq3.mods.get(-4);
    expect(unknownMods3).toBeDefined();
    if (unknownMods3) {
      expect(unknownMods3.length).toBe(2);
      expect(unknownMods3.every(mod => mod.modValue.primaryValue === "Phospho")).toBe(true);
    }

    expect(seq3.toProforma()).toBe("[Phospho]^2?EMEVNESPEK");
  });

  test('delta mass notation', () => {
    const proforma = "PEP[+42.011]TIDE";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).toBe("PEPTIDE");
    expect(seq.seq[2].mods[0].modValue.primaryValue).toBe("+42.011");
    expect(Math.abs(seq.seq[2].mods[0].mass - 42.011)).toBeLessThan(0.0001);
    expect(seq.toProforma()).toBe(proforma);
  });

  test('formula notation', () => {
    // Valid formulas
    const validProforma = [
      "PEPT[Formula:C2H3NO]IDE",
      "PEPT[Formula:C-1H2]IDE"  // Negative element count
    ];

    for (const proforma of validProforma) {
      const seq = Sequence.fromProforma(proforma);
      expect(seq.toStrippedString()).toBe("PEPTIDE");
      expect(seq.seq[3].mods[0].source).toBe("Formula");
      expect(seq.toProforma()).toBe(proforma);
    }

    // Invalid formulas should throw errors if the implementation validates them
    // This would need to be wrapped in expect().toThrow() if the implementation throws
  });

  test('glycan notation', () => {
    const proformaStrings = [
      "PEPT[Glycan:HexNAc]IDE",
      "PEPT[Glycan:HexNAc(1)Hex(1)]IDE"
    ];

    for (const proforma of proformaStrings) {
      const seq = Sequence.fromProforma(proforma);
      expect(seq.toStrippedString()).toBe("PEPTIDE");
      expect(seq.seq[3].mods[0].source).toBe("Glycan");
      expect(seq.toProforma()).toBe(proforma);
    }
  });

  test('range modifications', () => {
    // Simple range
    const proforma = "PRT(ESFRMS)[+19.0523]ISK";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).toBe("PRTESFRMSISK");

    // Check modification is applied to range (positions 3-8)
    for (let i = 3; i <= 8; i++) {
      const rangeMods = seq.seq[i].mods;
      expect(rangeMods.length).toBeGreaterThanOrEqual(1);
      expect(rangeMods[0].modValue.primaryValue).toBe("+19.0523");
    }

    expect(seq.toProforma()).toBe(proforma);

    // Range containing modification
    const proforma2 = "PRT(EC[Carbamidomethyl]FRMS)[+19.0523]ISK";
    const seq2 = Sequence.fromProforma(proforma2);

    // Check nested modification
    const nestedMods = seq2.seq[4].mods;
    expect(nestedMods.some(mod => mod.modValue.primaryValue === "Carbamidomethyl")).toBe(true);

    // Check range modification still applies
    for (let i = 3; i <= 8; i++) {
      const rangeMods = seq2.seq[i].mods;
      expect(rangeMods.some(mod => mod.modValue.primaryValue === "+19.0523")).toBe(true);
    }

    expect(seq2.toProforma()).toBe(proforma2);
  });

  test('localization scores', () => {
    // Basic example with localization scores
    const proforma = "EM[Oxidation]EVT[#g1(0.01)]S[#g1(0.09)]ES[Phospho#g1(0.90)]PEK";
    const seq = Sequence.fromProforma(proforma);

    // Check localization scores
    expect(seq.seq[4].mods[0].modValue.localizationScore).toBe(0.01);
    expect(seq.seq[5].mods[0].modValue.localizationScore).toBe(0.09);
    expect(seq.seq[7].mods[0].modValue.localizationScore).toBe(0.90);

    expect(seq.toProforma()).toBe(proforma);
  });

  test('multiple modifications same residue', () => {
    // Test multiple modifications on single residue
    const proforma = "PEPTIDEK[Acetyl][Methyl]";
    const seq = Sequence.fromProforma(proforma);

    const mods = seq.seq[7].mods;
    expect(mods.length).toBe(2);

    // Check both modifications exist
    const modValues = mods.map(m => m.modValue.primaryValue);
    expect(modValues).toContain("Acetyl");
    expect(modValues).toContain("Methyl");

    expect(seq.toProforma()).toBe(proforma);
  });

  test('global modifications', () => {
    // Isotope labeling
    const proforma1 = "<15N>PEPTIDE";
    const seq1 = Sequence.fromProforma(proforma1);

    expect(seq1.globalMods.length).toBe(1);
    expect(seq1.globalMods[0].modValue.primaryValue).toBe("15N");
    expect(seq1.globalMods[0].globalModType).toBe("isotope");

    // Fixed protein modifications with target residues
    const proforma2 = "<[Carbamidomethyl]@C>PEPTCDE";
    const seq2 = Sequence.fromProforma(proforma2);

    expect(seq2.globalMods.length).toBe(1);
    expect(seq2.globalMods[0].modValue.primaryValue).toBe("Carbamidomethyl");
    expect(seq2.globalMods[0].globalModType).toBe("fixed");
    expect(seq2.globalMods[0].targetResidues).toContain("C");

    expect(seq2.toProforma()).toBe(proforma2);
  });

  test('sequence ambiguity', () => {
    // Test simple ambiguity
    const proforma = "(?DQ)NGTWEM[Oxidation]ESNENFEGYM[Oxidation]K";
    const seq = Sequence.fromProforma(proforma);

    expect(seq.toStrippedString()).toBe("NGTWEMESNENFEGYMK");

    // Check ambiguity
    expect(seq.sequenceAmbiguities.length).toBe(1);
    expect(seq.sequenceAmbiguities[0].value).toBe("DQ");
    expect(seq.sequenceAmbiguities[0].position).toBe(0);

    // Check modifications are still parsed correctly
    expect(seq.seq[5].mods[0].modValue.primaryValue).toBe("Oxidation");
    expect(seq.seq[15].mods[0].modValue.primaryValue).toBe("Oxidation");

    expect(seq.toProforma()).toBe(proforma);
  });

  test('info tags', () => {
    // Simple info tag
    const proforma = "ELVIS[Phospho|INFO:newly discovered]K";
    const seq = Sequence.fromProforma(proforma);

    // Check the modification has an info tag
    expect(seq.seq[4].mods[0].modValue.primaryValue).toBe("Phospho");
    expect(seq.seq[4].mods[0].infoTags.length).toBe(1);
    expect(seq.seq[4].mods[0].infoTags[0]).toBe("newly discovered");

    // Multiple info tags
    const proforma2 = "ELVIS[Phospho|INFO:newly discovered|INFO:Created on 2021-06]K";
    const seq2 = Sequence.fromProforma(proforma2);

    expect(seq2.seq[4].mods[0].infoTags.length).toBe(2);
    expect(seq2.seq[4].mods[0].infoTags[0]).toBe("newly discovered");
    expect(seq2.seq[4].mods[0].infoTags[1]).toBe("Created on 2021-06");

    expect(seq2.toProforma()).toBe(proforma2);
  });

  test('joint representation', () => {
    // Basic case with interpretation and mass
    const proforma = "ELVIS[U:Phospho|+79.966331]K";
    const seq = Sequence.fromProforma(proforma);

    const mod = seq.seq[4].mods[0];
    expect(mod.modValue.primaryValue).toBe("Phospho");
    expect(mod.source).toBe("U");
    expect(mod.modValue.pipeValues[1].mass).toBe(79.966331);

    // Case with observed mass
    const proforma2 = "ELVIS[U:Phospho|Obs:+79.978]K";
    const seq2 = Sequence.fromProforma(proforma2);

    const mod2 = seq2.seq[4].mods[0];
    expect(mod2.modValue.primaryValue).toBe("Phospho");
    expect(mod2.source).toBe("U");
    expect(mod2.modValue.pipeValues[1].observedMass).toBe(79.978);

    expect(seq2.toProforma()).toBe(proforma2);
  });

  test('crosslink joint representation', () => {
    // Crosslink with mass shift and info tag
    const proforma = "PEPTK[XL:DSS#XL1|+138.068|INFO:reaction=NHS]IDE";
    const seq = Sequence.fromProforma(proforma);

    const mod = seq.seq[4].mods[0];
    expect(mod.modValue.primaryValue).toBe("DSS");
    expect(mod.source).toBe("XL");
    expect(mod.crosslinkId).toBe("XL1");
    if (mod.modValue.pipeValues[1].mass === undefined || mod.modValue.pipeValues[1].mass === null) {
      throw new Error("Mass value is incorrect");
    }
    expect(Math.abs(mod.modValue.pipeValues[1].mass - 138.068)).toBeLessThan(0.0001);
    expect(mod.infoTags).toContain("reaction=NHS");

    expect(seq.toProforma()).toBe(proforma);
  });

  test('complex multi feature representation', () => {
    const proforma = "PEP[U:Deamidation|+0.984]T[U:Phospho#1(0.75)|+79.966]K[XL:DSS#XL2]IDE";
    const seq = Sequence.fromProforma(proforma);

    // Check deamidation
    const mod1 = seq.seq[2].mods[0];
    expect(mod1.modValue.primaryValue).toBe("Deamidation");
    if (mod1.modValue.pipeValues[1].mass === undefined || mod1.modValue.pipeValues[1].mass === null) {
      throw new Error("Mass value is incorrect");
    }
    expect(Math.abs(mod1.modValue.pipeValues[1].mass - 0.984)).toBeLessThan(0.0001);

    // Check phosphorylation with ambiguity group
    const mod2 = seq.seq[3].mods[0];
    expect(mod2.modValue.primaryValue).toBe("Phospho");
    if (mod2.modValue.pipeValues[1].mass === undefined || mod2.modValue.pipeValues[1].mass === null) {
      throw new Error("Mass value is incorrect");
    }
    expect(Math.abs(mod2.modValue.pipeValues[1].mass - 79.966)).toBeLessThan(0.0001);
    expect(mod2.ambiguityGroup).toBe("1");
    expect(mod2.modValue.pipeValues[0].localizationScore).toBe(0.75);

    // Check crosslink
    const mod3 = seq.seq[4].mods[0];
    expect(mod3.modValue.primaryValue).toBe("DSS");
    expect(mod3.crosslinkId).toBe("XL2");

    expect(seq.toProforma()).toBe(proforma);
  });
  test('gap notation', () => {
    // Test gaps of known mass
    const proforma = "RTAAX[+367.0537]WT";
    const seq = Sequence.fromProforma(proforma);

    // Check sequence contains 'X'
    expect(seq.toStrippedString()).toBe("RTAAXWT");

    // Check gap modification
    expect(seq.seq[4].value).toBe("X");
    expect(seq.seq[4].mods[0].modType).toBe("gap");
    expect(seq.seq[4].mods[0].modValue.primaryValue).toBe("+367.0537");

    // Verify mass of the gap
    expect(Math.abs(seq.seq[4].mods[0].mass - 367.0537)).toBeLessThan(0.0001);

    // Verify roundtrip
    expect(seq.toProforma()).toBe(proforma);

    // Test with a negative mass gap
    const proforma2 = "PEPTX[-10.0]IDE";
    const seq2 = Sequence.fromProforma(proforma2);
    expect(seq2.toStrippedString()).toBe("PEPTXIDE");
    expect(seq2.seq[4].mods[0].modValue.primaryValue).toBe("-10.0");
    expect(seq2.toProforma()).toBe("PEPTX[-10]IDE");
  });
});