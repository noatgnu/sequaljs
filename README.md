# SequalJS
----

SequalJS is a JavaScript/TypeScript library for parsing and manipulating ProForma peptide sequence notation. It allows handling protein and peptide sequences with modifications, useful for proteomics research, mass spectrometry data analysis, and bioinformatics applications.

## Features

- Full support for ProForma 2.0 and ProForma 2.1 standards for proteoform notation
- Parse complex peptide sequences with modifications
- Handle various modification types:
    - Site-specific modifications
    - Terminal modifications (N-terminal and C-terminal)
    - Global modifications
    - Mass shift modifications
    - Labile modifications
    - Modifications with unknown positions
- Support for advanced ProForma features:
    - INFO tags and metadata
    - Ambiguity groups with localization scores
    - Sequence ambiguities
    - Crosslinks and branches
    - Range modifications
- ProForma 2.1 features:
    - Charged formulas (Section 11.1)
    - Ion notation for fragment ions (Section 11.6)
    - Placement controls (Position, Limit, CoMKP, CoMUP) (Section 11.2)
    - Named entities (peptidoform, peptidoform ion, compound ion) (Section 8.2)
    - Custom monosaccharides in glycan notation (Section 10.2)
    - Terminal-specific global modifications (Section 11.3.2)
- Precise handling of decimal values in mass shifts

## Installation

```bash
npm install sequaljs
```

## Usage

### Basic Parsing

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Parse a simple peptide with modification
const seq = Sequence.fromProforma('ELVIS[Phospho]K');
console.log(seq.seq[4].value); // "S"
console.log(seq.seq[4].mods[0].modValue.primaryValue); // "Phospho"

// Convert back to ProForma notation
console.log(seq.toProforma()); // "ELVIS[Phospho]K"
```

### Terminal Modifications

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// N-terminal and C-terminal modifications
const seq = Sequence.fromProforma('[Acetyl]-PEPTIDE-[Amidated]');

// Access N-terminal modification (position -1)
const nTermMod = seq.mods.get(-1);
if (nTermMod) {
  console.log(nTermMod[0].modValue.primaryValue); // "Acetyl"
}

// Access C-terminal modification (position -2)
const cTermMod = seq.mods.get(-2);
if (cTermMod) {
  console.log(cTermMod[0].modValue.primaryValue); // "Amidated"
}
```

### Global Modifications

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Global fixed modification
const seq = Sequence.fromProforma('<[Carbamidomethyl]@C>PEPTCDE');
console.log(seq.globalMods[0].modValue.primaryValue); // "Carbamidomethyl"
console.log(seq.globalMods[0].targetResidues); // ["C"]
```

### Working with INFO Tags

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Parse sequence with INFO tag
const seq = Sequence.fromProforma('ELVIS[Phospho|INFO:newly discovered]K');
const mod = seq.seq[4].mods[0];
console.log(mod.modValue.primaryValue); // "Phospho"
console.log(mod.infoTags[0]); // "newly discovered"

// Multiple INFO tags
const seq2 = Sequence.fromProforma('ELVIS[Phospho|INFO:newly discovered|INFO:Created on 2021-06]K');
console.log(seq2.seq[4].mods[0].infoTags.length); // 2
console.log(seq2.seq[4].mods[0].infoTags); // ["newly discovered", "Created on 2021-06"]
```

### Joint Representation

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Parse sequence with joint interpretation and mass
const seq = Sequence.fromProforma('ELVIS[U:Phospho|+79.966331]K');
const mod = seq.seq[4].mods[0];
console.log(mod.modValue.primaryValue); // "Phospho"
console.log(mod.source); // "U"
console.log(mod.modValue.pipeValues[1].mass); // 79.966331

// With observed mass
const seq2 = Sequence.fromProforma('ELVIS[U:Phospho|Obs:+79.978]K');
const mod2 = seq2.seq[4].mods[0];
console.log(mod2.modValue.primaryValue); // "Phospho"
console.log(mod2.modValue.pipeValues[1].observedMass); // 79.978
```

### Crosslinks and Complex Features

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Crosslinks with mass shifts and info tags
const seq = Sequence.fromProforma('PEPTK[XL:DSS#XL1|+138.068|INFO:reaction=NHS]IDE');
const mod = seq.seq[4].mods[0];
console.log(mod.modValue.primaryValue); // "DSS"
console.log(mod.source); // "XL"
console.log(mod.crosslinkId); // "XL1"
console.log(mod.modValue.pipeValues[1].mass); // 138.068
console.log(mod.infoTags[0]); // "reaction=NHS"

// Complex example with multiple modification types
const complex = Sequence.fromProforma(
  'PEP[U:Deamidation|+0.984]T[U:Phospho#1(0.75)|+79.966]K[XL:DSS#XL2]IDE'
);
```

### Gap Notation

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Parse sequence with gap of known mass
const seq = Sequence.fromProforma('RTAAX[+367.0537]WT');
console.log(seq.toStrippedString()); // "RTAAXWT"
console.log(seq.seq[4].value); // "X"
console.log(seq.seq[4].mods[0].modType); // "gap"
console.log(seq.seq[4].mods[0].mass); // 367.0537
```
### Charged Peptides

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Parse a peptide with charge state
const seq = Sequence.fromProforma('PEPTIDE/2');
console.log(seq.charge); // 2

// Parse a peptide with modification and charge state
const seq2 = Sequence.fromProforma('ELVIS[Phospho]K/3');
console.log(seq2.charge); // 3
console.log(seq2.toProforma()); // "ELVIS[Phospho]K/3"

// Modify charge state
seq2.charge = 4;
console.log(seq2.toProforma()); // "ELVIS[Phospho]K/4"

// Peptide with ionic species
const seq3 = Sequence.fromProforma('PEPTIDE/2[+Na+]');
console.log(seq3.charge); // 2
console.log(seq3.ionicSpecies); // "+Na+"
```

### Chimeric Spectra

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Parse a basic chimeric spectrum with two peptides
const chimeric = Sequence.fromProforma('PEPTIDE/2+ANOTHER/3');
console.log(chimeric.isChimeric); // true
console.log(chimeric.toStrippedString()); // "PEPTIDE" (first component)
console.log(chimeric.peptidoforms.length); // 2
console.log(chimeric.charge); // 2
console.log(chimeric.peptidoforms[1].toStrippedString()); // "ANOTHER"
console.log(chimeric.peptidoforms[1].charge); // 3

// Complex chimeric spectrum with modifications
const complexChimeric = Sequence.fromProforma(
  '[Acetyl]-PEP[+79.966]TIDE-[Amidated]/2[+Na+]+S[Phospho]EQ/3'
);
console.log(complexChimeric.peptidoforms.length); // 2
console.log(complexChimeric.mods.get(-1)[0].modValue.primaryValue); // "Acetyl"
console.log(complexChimeric.seq[2].mods[0].modValue.primaryValue); // "+79.966"
console.log(complexChimeric.ionicSpecies); // "+Na+"
console.log(complexChimeric.peptidoforms[1].seq[0].mods[0].modValue.primaryValue); // "Phospho"
```

## ProForma 2.1 Features

### Charged Formulas

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Charged formula notation
const seq = Sequence.fromProforma('PEPT[Formula:C2H3NO:z-1]IDE');
const mod = seq.seq[3].mods[0];
console.log(mod.modValue.source); // "Formula"
console.log(mod.modValue.primaryValue); // "C2H3NO"
console.log(mod.modValue.chargeValue); // -1

// Multiple charged formulas
const seq2 = Sequence.fromProforma('PEPT[Formula:C2H3NO:z-1]IDE[Formula:Zn1:z+2]K');
console.log(seq2.seq[3].mods[0].modValue.chargeValue); // -1
console.log(seq2.seq[6].mods[0].modValue.chargeValue); // 2
```

### Ion Notation

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Fragment ion notation
const seq = Sequence.fromProforma('PEPTIDE-[b-type-ion]');
const cTermMod = seq.mods.get(-2);
console.log(cTermMod[0].isIonType); // true
console.log(cTermMod[0].modValue.primaryValue); // "b-type-ion"

// Multiple ion types
const seq2 = Sequence.fromProforma('[a-type-ion]-PEPTIDE-[y-type-ion]');
console.log(seq2.mods.get(-1)[0].isIonType); // true
console.log(seq2.mods.get(-2)[0].isIonType); // true
```

### Placement Controls

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Position constraint
const seq = Sequence.fromProforma('<[TMT6plex|Position:M,C]@K>MTPEILTCNSIGCLKG');
console.log(seq.globalMods[0].positionConstraint); // ["M", "C"]

// Limit per position
const seq2 = Sequence.fromProforma('<[Oxidation|Limit:2]@M>MMMMMMMM');
console.log(seq2.globalMods[0].limitPerPosition); // 2

// Colocalization constraints
const seq3 = Sequence.fromProforma('<[Phospho|CoMKP]@S,T,Y>STYPEPTIDE');
console.log(seq3.globalMods[0].colocalizeKnown); // true

const seq4 = Sequence.fromProforma('<[Oxidation|CoMUP]@M>MMMPEPTIDE');
console.log(seq4.globalMods[0].colocalizeUnknown); // true

// Combined placement controls
const seq5 = Sequence.fromProforma(
  '<[TMT6plex|Position:M,C|Limit:1|CoMKP]@K,N-term>MTPEILTCNSIGCLKG'
);
console.log(seq5.globalMods[0].positionConstraint); // ["M", "C"]
console.log(seq5.globalMods[0].limitPerPosition); // 1
console.log(seq5.globalMods[0].colocalizeKnown); // true
```

### Named Entities

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Peptidoform name
const seq = Sequence.fromProforma('(>TMT-labeled peptide)PEPTIDEK');
console.log(seq.peptidoformName); // "TMT-labeled peptide"

// Peptidoform ion name
const seq2 = Sequence.fromProforma('(>>Precursor z=2)PEPTIDEK/2');
console.log(seq2.peptidoformIonName); // "Precursor z=2"
console.log(seq2.charge); // 2

// Compound ion name
const seq3 = Sequence.fromProforma('(>>>Chimeric Spectrum 1234)PEPTIDEK/2');
console.log(seq3.compoundIonName); // "Chimeric Spectrum 1234"

// All three naming levels
const seq4 = Sequence.fromProforma(
  '(>>>Chimeric Spectrum 1234)(>>Precursor z=2)(>Phospho-peptide)PEPS[Phospho]T/2'
);
console.log(seq4.compoundIonName); // "Chimeric Spectrum 1234"
console.log(seq4.peptidoformIonName); // "Precursor z=2"
console.log(seq4.peptidoformName); // "Phospho-peptide"
```

### Custom Monosaccharides in Glycans

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// Custom monosaccharide notation
const seq = Sequence.fromProforma('N[Glycan:{C8H13N1O5}1Hex2]PEPTIDE');
const mod = seq.seq[0].mods[0];
console.log(mod.modValue.source); // "Glycan"
console.log(mod.modValue.isValidGlycan); // true

// Labile custom monosaccharides
const seq2 = Sequence.fromProforma('{Glycan:{C8H13N1O5}1Hex2}PEPTIDE');
const labileMods = seq2.mods.get(-3);
console.log(labileMods[0].modValue.source); // "Glycan"

// Mixed custom and standard monosaccharides
const seq3 = Sequence.fromProforma('N[Glycan:{C11H17N1O9}2Hex3HexNAc2]PEPTIDE');
console.log(seq3.seq[0].mods[0].modValue.isValidGlycan); // true

// Custom monosaccharides with isotopes
const seq4 = Sequence.fromProforma('N[Glycan:{C8H13[15N1]O5}2Hex1]PEPTIDE');
console.log(seq4.seq[0].mods[0].modValue.isValidGlycan); // true
```

### Terminal-Specific Global Modifications

```typescript
import { Sequence } from 'sequaljs/dist/sequence';

// N-terminal specific global modification
const seq = Sequence.fromProforma('<[TMT6plex]@N-term>PEPTIDEK');
console.log(seq.globalMods[0].targetResidues); // [{"type": "terminal", "terminal": "N-term"}]

// C-terminal specific global modification
const seq2 = Sequence.fromProforma('<[Amidated]@C-term>PEPTIDEK');
console.log(seq2.globalMods[0].targetResidues); // [{"type": "terminal", "terminal": "C-term"}]

// Terminal-specific with amino acid constraint
const seq3 = Sequence.fromProforma('<[Gln->pyro-Glu]@N-term:Q>QPEPTIDE');
console.log(seq3.globalMods[0].targetResidues);
// [{"type": "terminal_specific", "terminal": "N-term", "aminoAcid": "Q"}]

// Multiple targets including terminals
const seq4 = Sequence.fromProforma('<[TMT6plex]@K,N-term>PEPTIDEK');
console.log(seq4.globalMods[0].targetResidues);
// ["K", {"type": "terminal", "terminal": "N-term"}]

// Complex terminal global modifications
const seq5 = Sequence.fromProforma(
  '<[Acetyl]@N-term><[Oxidation]@M,C-term:G>MTPEILTCNSIGCLKG'
);
console.log(seq5.globalMods.length); // 2
console.log(seq5.globalMods[1].targetResidues);
// ["M", {"type": "terminal_specific", "terminal": "C-term", "aminoAcid": "G"}]
```

## API Reference

### Core Methods

- `Sequence.fromProforma(string)`: Parse a ProForma string into a Sequence object
- `Sequence.toProforma()`: Convert a Sequence object back to a ProForma string
- `Sequence.toStrippedString()`: Get the plain amino acid sequence without modifications

### Properties

- `Sequence.seq`: Access the individual residues with their modifications
- `Sequence.mods`: Access modifications by position, including terminal modifications
  - Position -1: N-terminal modifications
  - Position -2: C-terminal modifications
  - Position -3: Labile modifications
  - Position -4: Unknown position modifications
- `Sequence.globalMods`: Access global modifications
- `Sequence.sequenceAmbiguities`: Access sequence ambiguity information
- `Sequence.charge`: Charge state of the peptide
- `Sequence.ionicSpecies`: Ionic species (e.g., "+Na+", "+K+")
- `Sequence.isChimeric`: Boolean indicating if this is a chimeric spectrum
- `Sequence.peptidoforms`: Array of component peptides in chimeric spectra

### ProForma 2.1 Properties

- `Sequence.peptidoformName`: Name of the peptidoform (single > prefix)
- `Sequence.peptidoformIonName`: Name of the peptidoform ion (double >> prefix)
- `Sequence.compoundIonName`: Name of the compound ion (triple >>> prefix)

### Modification Properties

- `Modification.modValue.chargeValue`: Charge value for charged formulas
- `Modification.isIonType`: Boolean indicating if this is an ion type modification
- `Modification.positionConstraint`: Position constraint for placement controls
- `Modification.limitPerPosition`: Limit per position for placement controls
- `Modification.colocalizeKnown`: Colocalize with known peptidoforms flag
- `Modification.colocalizeUnknown`: Colocalize with unknown peptidoforms flag

### Global Modification Properties

- `GlobalModification.targetResidues`: Array of target residues (can include terminal targets)
  - String values: amino acid codes (e.g., "K", "M")
  - Object values for terminals: `{"type": "terminal", "terminal": "N-term" | "C-term"}`
  - Object values for terminal-specific: `{"type": "terminal_specific", "terminal": "N-term" | "C-term", "aminoAcid": string}`

## License

MIT
