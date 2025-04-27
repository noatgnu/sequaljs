# SequalJS
----

SequalJS is a JavaScript/TypeScript library for parsing and manipulating ProForma peptide sequence notation. It allows handling protein and peptide sequences with modifications, useful for proteomics research, mass spectrometry data analysis, and bioinformatics applications.

## Features

- Full support for ProForma 2.0 standard for proteoform notation
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


## API Reference

- `Sequence.fromProforma(string)`: Parse a ProForma string into a Sequence object
- `Sequence.toProforma()`: Convert a Sequence object back to a ProForma string
- `Sequence.toStrippedString()`: Get the plain amino acid sequence without modifications
- `Sequence.seq`: Access the individual residues with their modifications
- `Sequence.mods`: Access modifications by position, including terminal modifications
- `Sequence.globalMods`: Access global modifications
- `sequence.sequenceAmbiguities`: Access sequence ambiguity information

## License

MIT
