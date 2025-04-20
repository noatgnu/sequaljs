// src/__tests__/proforma.test.ts
import { ProFormaParser, SequenceAmbiguity } from '../proforma';
import { GlobalModification, Modification } from '../modification';

describe('ProFormaParser', () => {
  describe('Basic sequence parsing', () => {
    it('should parse a simple peptide sequence', () => {
      const input = 'PEPTIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(Object.keys(mods).length).toBe(0);
      expect(globalMods.length).toBe(0);
      expect(ambiguities.length).toBe(0);
    });
  });

  describe('Terminal modifications', () => {
    it('should parse N-terminal modification', () => {
      const input = '[Acetyl]-PEPTIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[-1].length).toBe(1);
      expect(mods[-1][0].modValue.primaryValue).toBe('Acetyl');
      expect(mods[-1][0].modType).toBe('terminal');
    });

    it('should parse C-terminal modification', () => {
      const input = 'PEPTIDE-[Amidated]';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[-2].length).toBe(1);
      expect(mods[-2][0].modValue.primaryValue).toBe('Amidated');
      expect(mods[-2][0].modType).toBe('terminal');
    });

    it('should parse both terminal modifications', () => {
      const input = '[Acetyl]-PEPTIDE-[Amidated]';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[-1].length).toBe(1);
      expect(mods[-2].length).toBe(1);
    });
  });

  describe('Global modifications', () => {
    it('should parse fixed modifications', () => {
      const input = '<Carbamidomethyl@C>PEPCTIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPCTIDE');
      expect(globalMods.length).toBe(1);
      expect(globalMods[0].modValue.primaryValue).toBe('Carbamidomethyl');
      expect(globalMods[0].targetResidues).toEqual(['C']);
      expect(globalMods[0].modType).toBe('global');
      expect(globalMods[0].globalModType).toBe('fixed');
    });

    it('should parse isotope labeling', () => {
      const input = '<15N>PEPTIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(globalMods.length).toBe(1);
      expect(globalMods[0].modValue.primaryValue).toBe('15N');
      expect(globalMods[0].globalModType).toBe('isotope');
    });

    it('should parse multiple global modifications', () => {
      const input = '<Carbamidomethyl@C><15N>PEPCTIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(globalMods.length).toBe(2);
    });
  });

  describe('Site-specific modifications', () => {
    it('should parse single modification', () => {
      const input = 'PEP[Phospho]TIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[2].length).toBe(1);
      expect(mods[2][0].modValue.primaryValue).toBe('Phospho');
    });

    it('should parse multiple modifications', () => {
      const input = 'PE[Phospho]PT[Phospho]IDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods['1'].length).toBe(1);
      expect(mods['3'].length).toBe(1);
    });

    it('should parse mass shift modifications', () => {
      const input = 'PEP[+79.966]TIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[2].length).toBe(1);
      expect(mods[2][0].mass).toBeCloseTo(79.966);
    });
  });

  describe('Sequence ambiguities', () => {
    it('should parse sequence ambiguity notation', () => {
      const input = 'PEP(?AB)TIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(ambiguities.length).toBe(1);
      expect(ambiguities[0].value).toBe('AB');
      expect(ambiguities[0].position).toBe(0);
    });
  });

  describe('Labile modifications', () => {
    it('should parse labile modifications', () => {
      const input = '{Glycan:HexNAc}PEPTIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[-3].length).toBe(1);
      expect(mods[-3][0].modValue.primaryValue).toBe('HexNAc');
      expect(mods[-3][0].modValue.pipeValues[0].isValidGlycan).toBe(true);
      expect(mods[-3][0].modType).toBe('labile');
    });
  });

  describe('Unknown position modifications', () => {
    it('should parse unknown position modifications', () => {
      const input = '[Phospho]?PEPTIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[-4].length).toBe(1);
      expect(mods[-4][0].modValue.primaryValue).toBe('Phospho');
      expect(mods[-4][0].modType).toBe('unknown_position');
    });

    it('should parse multiple unknown position modifications', () => {
      const input = '[Phospho][Acetyl]?PEPTIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[-4].length).toBe(2);
    });
  });

  describe('Range modifications', () => {
    it('should parse range modifications', () => {
      const input = 'PE(PTI)DE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      // No modifications yet, just testing the range parsing
    });

    it('should parse range with modifications', () => {
      const input = 'PE(PTI)[Phospho]DE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[2].length).toBe(1);
      expect(mods[3].length).toBe(1);
      expect(mods[4].length).toBe(1);
      expect(mods[2][0].inRange).toBe(true);
    });
  });

  describe('Crosslinks and branches', () => {
    it('should parse crosslinks', () => {
      const input = 'PEPTIDE[DSS#XL1]KLMN[#XL1]';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDEKLMN');
      expect(mods[6][0].crosslinkId).toBe('XL1');
      expect(mods[10][0].isCrosslinkRef).toBe(true);
    });

    it('should parse branch modifications', () => {
      const input = 'PEPTIDE[Glycan#BRANCH]K[#BRANCH]';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDEK');
      expect(mods[6][0].modValue.isBranch).toBe(true);
      expect(mods[7][0].modValue.isBranchRef).toBe(true);
    });
  });

  describe('Ambiguity groups', () => {
    it('should parse ambiguity groups', () => {
      const input = 'PEPT[Phospho#1]IDE[Phospho#1]';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[3][0].ambiguityGroup).toBe('1');
      expect(mods[6][0].ambiguityGroup).toBe('1');
    });

    it('should parse ambiguity groups with localization scores', () => {
      const input = 'PEPT[Phospho#1(0.8)]IDE[Phospho#1(0.2)]';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(mods[3][0].localizationScore).toBe(0.8);
      expect(mods[6][0].localizationScore).toBe(0.2);
    });

    it('should parse ambiguity reference', () => {
      const input = 'PEPT[Phospho#1]IDE[#1]';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(mods[3][0].ambiguityGroup).toBe('1');
      expect(mods[6][0].ambiguityGroup).toBe('1');
      expect(mods[6][0].isAmbiguityRef).toBe(true);
    });
  });

  describe('Complex examples', () => {
    it('should parse a complex ProForma string with multiple features', () => {
      const input = '<Carbamidomethyl@C>[Acetyl]-PEPC[+57.021]T[Phospho]IDE-[Amidated]';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPCTIDE');
      expect(globalMods.length).toBe(1);
      expect(mods[-1]).toBeDefined(); // N-term mod
      expect(mods[-2]).toBeDefined(); // C-term mod
      expect(mods[3]).toBeDefined(); // Cysteine mod
      expect(mods[4]).toBeDefined(); // Threonine phosphorylation
    });
  });

  describe('INFO tags support', () => {
    it('should parse basic INFO tags', () => {
      const input = 'ELVIS[Phospho|INFO:newly discovered]K';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('ELVISK');
      expect(mods[4].length).toBe(1);
      expect(mods[4][0].modValue.primaryValue).toBe('Phospho');
      expect(mods[4][0].modValue.infoTags.length).toBe(1);
      expect(mods[4][0].modValue.infoTags[0]).toBe('newly discovered');
    });

    it('should parse multiple INFO tags', () => {
      const input = 'ELVIS[Phospho|INFO:newly discovered|INFO:Created on 2021-06]K';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('ELVISK');
      expect(mods[4].length).toBe(1);
      expect(mods[4][0].modValue.primaryValue).toBe('Phospho');
      expect(mods[4][0].modValue.infoTags.length).toBe(2);
      expect(mods[4][0].modValue.infoTags[0]).toBe('newly discovered');
      expect(mods[4][0].modValue.infoTags[1]).toBe('Created on 2021-06');
    });

    it('should parse N-terminal modifications with INFO tags', () => {
      const input = '[Acetyl|INFO:Added during processing]-PEPTIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[-1].length).toBe(1);
      expect(mods[-1][0].modValue.primaryValue).toBe('Acetyl');
      expect(mods[-1][0].modValue.infoTags.length).toBe(1);
      expect(mods[-1][0].modValue.infoTags[0]).toBe('Added during processing');
    });

    it('should parse C-terminal modifications with INFO tags', () => {
      const input = 'PEPTIDE-[Amidated|INFO:Common C-terminal mod]';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[-2].length).toBe(1);
      expect(mods[-2][0].modValue.primaryValue).toBe('Amidated');
      expect(mods[-2][0].modValue.infoTags.length).toBe(1);
      expect(mods[-2][0].modValue.infoTags[0]).toBe('Common C-terminal mod');
    });

    it('should parse global isotope modifications with INFO tags', () => {
      const input = '<13C|INFO:Stable isotope labeling>PEPTIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(globalMods.length).toBe(1);
      expect(globalMods[0].modValue.primaryValue).toBe('13C');
      expect(globalMods[0].globalModType).toBe('isotope');
      expect(globalMods[0].modValue.infoTags.length).toBe(1);
      expect(globalMods[0].modValue.infoTags[0]).toBe('Stable isotope labeling');
    });

    it('should parse global fixed modifications with INFO tags', () => {
      const input = '<[Carbamidomethyl|INFO:Standard alkylation]@C>PEPTCDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTCDE');
      expect(globalMods.length).toBe(1);
      expect(globalMods[0].modValue.primaryValue).toBe('Carbamidomethyl');
      expect(globalMods[0].globalModType).toBe('fixed');
      expect(globalMods[0].targetResidues).toEqual(['C']);
      expect(globalMods[0].modValue.infoTags.length).toBe(1);
      expect(globalMods[0].modValue.infoTags[0]).toBe('Standard alkylation');
    });

    it('should parse complex combinations with multiple INFO tags', () => {
      const input = '<[Carbamidomethyl|INFO:Standard alkylation]@C>[Acetyl|INFO:Added during processing]-PEPTC[+57.021|INFO:Mass verified]DE-[Amidated|INFO:Common C-terminal mod]';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTCDE');

      // Check global mod
      expect(globalMods.length).toBe(1);
      expect(globalMods[0].modValue.primaryValue).toBe('Carbamidomethyl');
      expect(globalMods[0].modValue.infoTags.length).toBe(1);
      expect(globalMods[0].modValue.infoTags[0]).toBe('Standard alkylation');

      // Check N-terminal mod
      expect(mods[-1].length).toBe(1);
      expect(mods[-1][0].modValue.primaryValue).toBe('Acetyl');
      expect(mods[-1][0].modValue.infoTags.length).toBe(1);
      expect(mods[-1][0].modValue.infoTags[0]).toBe('Added during processing');

      // Check C-terminal mod
      expect(mods[-2].length).toBe(1);
      expect(mods[-2][0].modValue.primaryValue).toBe('Amidated');
      expect(mods[-2][0].modValue.infoTags.length).toBe(1);
      expect(mods[-2][0].modValue.infoTags[0]).toBe('Common C-terminal mod');

      // Check residue mod
      expect(mods[4].length).toBe(1);
      expect(mods[4][0].mass).toBeCloseTo(57.021);
      expect(mods[4][0].modValue.infoTags.length).toBe(1);
      expect(mods[4][0].modValue.infoTags[0]).toBe('Mass verified');
    });

    it('should handle INFO tags with special characters', () => {
      const input = 'PEP[Phospho|INFO:MS/MS score=0.98|INFO:RT=34.5 min]TIDE';
      const [sequence, mods, globalMods, ambiguities] = ProFormaParser.parse(input);

      expect(sequence).toBe('PEPTIDE');
      expect(mods[2].length).toBe(1);
      expect(mods[2][0].modValue.primaryValue).toBe('Phospho');
      expect(mods[2][0].modValue.infoTags.length).toBe(2);
      expect(mods[2][0].modValue.infoTags[0]).toBe('MS/MS score=0.98');
      expect(mods[2][0].modValue.infoTags[1]).toBe('RT=34.5 min');
    });
  });
});