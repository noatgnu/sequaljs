import { BaseBlock } from './base_block';
import {GlobalModification, Modification, ModificationMap} from './modification';
import {AminoAcid} from "./amino_acid";
import {ProFormaParser, SequenceAmbiguity} from "./proforma";

/**
 * Count unique elements in a sequence.
 *
 * @param seq - The sequence of blocks to count elements from. Each element should
 *              have a `value` attribute and optionally a `mods` attribute.
 * @returns Dictionary where keys are element values and values are their counts.
 */
export function countUniqueElements<T extends BaseBlock>(seq: Iterable<T>): Record<string, number> {
  const elements: Record<string, number> = {};

  for (const item of seq) {
    // Count the amino acid
    elements[item.value] = (elements[item.value] || 0) + 1;

    // Count modifications if present
    if ('mods' in item && item.mods) {
      // Ensure mods is an array of Modification objects
      if (!Array.isArray(item.mods) || !item.mods.every(mod => mod instanceof Modification)) {
        throw new Error('Invalid mods array');
      }
      for (const mod of item.mods) {
        elements[mod.value] = (elements[mod.value] || 0) + 1;
      }
    }
  }

  return elements;
}

/**
 * Generate all possible position combinations for modifications.
 *
 * This function creates all possible subsets of positions, including
 * the empty set and the full set.
 *
 * @param positions - List of positions where modifications could be applied.
 * @yields Each possible combination of positions.
 */
export function* variablePositionPlacementGenerator(positions: number[]): Generator<number[]> {
  if (!positions.length) {
    yield [];
    return;
  }

  // Sort positions for consistent output
  const sortedPositions = [...positions].sort((a, b) => a - b);

  // Generate all possible combinations (2^n possibilities)
  const n = sortedPositions.length;

  // Iterate through all possible binary masks (0 to 2^n - 1)
  for (let i = 0; i < Math.pow(2, n); i++) {
    const result: number[] = [];
    for (let j = 0; j < n; j++) {
      // Check if bit j is set in i
      if ((i & (1 << j)) !== 0) {
        result.push(sortedPositions[j]);
      }
    }
    yield result;
  }
}

/**
 * Serialize a dictionary of positions with consistent ordering.
 *
 * @param positions - Dictionary mapping positions to modifications or other data.
 * @returns JSON string with sorted keys for consistent serialization.
 * @throws Error if the dictionary contains values that cannot be serialized to JSON.
 */
export function orderedSerializePositionDict(positions: Record<number, any>): string {
  try {
    // Get all keys, sort them, and build a new object with sorted keys
    const sortedKeys = Object.keys(positions).map(Number).sort((a, b) => a - b);
    const sortedObj: Record<string, any> = {};

    for (const key of sortedKeys) {
      sortedObj[key] = positions[key];
    }

    return JSON.stringify(sortedObj);
  } catch (e) {
    throw new Error(`Could not serialize positions dictionary: ${e}`);
  }
}

export class Sequence<T extends BaseBlock = AminoAcid> {
  // Regular expression patterns for parsing
  private static _MOD_PATTERN = /[\(|\[]+([^\)]+)[\)|\]]+/;
  private static _MOD_ENCLOSURE_START = new Set(['(', '[', '{']);
  private static _MOD_ENCLOSURE_END = new Set([')', ']', '}']);

  encoder: new (value: string, position?: number) => T;
  parserIgnore: string[];
  seq: T[];
  chains: Sequence[];
  isMultiChain: boolean;
  mods: Map<number, Modification[]>;
  globalMods: GlobalModification[];
  sequenceAmbiguities: SequenceAmbiguity[];
  seqLength: number;
  private currentIterCount: number = 0;

  /**
   * Create a sequence object.
   */
  constructor(
    seq: string | any[] | Sequence,
    encoder: new (value: string, position?: number) => T = AminoAcid as any,
    mods: Record<number, Modification | Modification[]> = {},
    parse: boolean = true,
    parserIgnore: string[] = [],
    modPosition: 'left' | 'right' = 'right',
    chains: Sequence[] = [],
    globalMods: GlobalModification[] = [],
    sequenceAmbiguities: SequenceAmbiguity[] = []
  ) {
    this.encoder = encoder;
    this.parserIgnore = parserIgnore || [];
    this.seq = [];
    this.chains = chains || [this];
    this.isMultiChain = false;
    this.mods = new Map();
    this.globalMods = globalMods || [];
    this.sequenceAmbiguities = sequenceAmbiguities || [];

    if (seq instanceof Sequence) {
      // Copy attributes from existing sequence
      for (const [key, value] of Object.entries(seq)) {
        if (key !== 'mods') {
          (this as any)[key] = this.deepCopy(value);
        }
      }

      if ((seq as any).mods instanceof Map) {
        for (const [pos, modList] of (seq as any).mods.entries()) {
          this.mods.set(pos, this.deepCopy(modList));
        }
      }
    } else {
      // Initialize with provided modifications
      if (mods) {
        for (const [posStr, modItems] of Object.entries(mods)) {
          const pos = parseInt(posStr);
          if (Array.isArray(modItems)) {
            this.mods.set(pos, this.deepCopy(modItems));
          } else {
            if (!this.mods.has(pos)) {
              this.mods.set(pos, []);
            }
            this.mods.get(pos)?.push(this.deepCopy(modItems));
          }
        }
      }

      if (parse) {
        this._parseSequence(seq, modPosition);
      }
    }
    this.seqLength = this.seq.length;
  }

  /**
   * Create a Sequence object from a ProForma string with multi-chain support.
   */
  static fromProforma(proformaStr: string): Sequence {
    if (proformaStr.includes("//")) {
      const chains = proformaStr.split("//");
      const mainSeq = Sequence.fromProforma(chains[0]);
      mainSeq.isMultiChain = true;
      mainSeq.chains = [mainSeq];

      for (const chainStr of chains.slice(1)) {
        const chain = Sequence.fromProforma(chainStr);
        mainSeq.chains.push(chain);
      }

      return mainSeq;
    } else {
      const [
        baseSequence,
        modifications,
        globalMods,
        sequenceAmbiquities
      ] = ProFormaParser.parse(proformaStr);

      const seq = new Sequence(
        baseSequence,
        AminoAcid as any,
        {},
        true,
        [],
        'right',
        [],
        globalMods,
        sequenceAmbiquities
      );

      for (const [posStr, mods] of Object.entries(modifications)) {
        const pos = parseInt(posStr);
        for (const mod of mods) {
          if (pos === -1) { // N-terminal
            if (!seq.mods.has(-1)) seq.mods.set(-1, []);
            seq.mods.get(-1)?.push(mod);
          } else if (pos === -2) { // C-terminal
            if (!seq.mods.has(-2)) seq.mods.set(-2, []);
            seq.mods.get(-2)?.push(mod);
          } else if (pos === -3) {
            if (!seq.mods.has(-3)) seq.mods.set(-3, []);
            seq.mods.get(-3)?.push(mod);
          } else if (pos === -4) {
            if (!seq.mods.has(-4)) seq.mods.set(-4, []);
            seq.mods.get(-4)?.push(mod);
          } else {
            seq.seq[pos].addModification(mod);
          }
        }
      }

      return seq;
    }
  }

  /**
   * Parse the input sequence into a list of BaseBlock objects.
   */
  private _parseSequence(seq: string | any[], modPosition: 'left' | 'right'): void {
    let currentMod: Modification[] = [];
    let currentPosition = 0;

    if (modPosition !== 'left' && modPosition !== 'right') {
      throw new Error("modPosition must be either 'left' or 'right'");
    }

    for (const [block, isMod] of this._sequenceIterator(seq)) {
      if (!isMod) {
        // Handle an amino acid/residue
        if (modPosition === 'left') {
          // Handle left-positioned modifications
          let currentUnit: T;
          if (block instanceof this.encoder) {
            currentUnit = block;
            currentUnit.position = currentPosition;
          } else {
            currentUnit = new this.encoder(block, currentPosition);
          }

          // Apply pending modifications
          this._applyModifications(currentUnit, currentPosition, currentMod);
          this.seq.push(this.deepCopy(currentUnit));
          currentMod = [];
        } else { // modPosition === "right"
          // Apply modifications to previous residue
          if (currentMod.length > 0 && currentPosition > 0) {
            if (Array.isArray(this.seq) && this.seq.every(item => item instanceof AminoAcid)) {
              for (const mod of currentMod) {
                // check if this.seq array is an amino acid array
                this.seq[currentPosition - 1].addModification(mod);
              }
            }
          }

          // Create new residue
          let currentUnit: T;
          if (block instanceof this.encoder) {
            currentUnit = block;
            currentUnit.position = currentPosition;
          } else {
            currentUnit = new this.encoder(block, currentPosition);
          }

          // Apply configured modifications
          if (this.mods.has(currentPosition)) {
            const modsToApply = this.mods.get(currentPosition);
            if (modsToApply) {
              if (currentUnit instanceof AminoAcid) {
                for (const mod of modsToApply) {
                  currentUnit.addModification(mod);
                }
              }
            }

          }

          this.seq.push(this.deepCopy(currentUnit));
          currentMod = [];
        }

        currentPosition += 1;
      } else { // isMod is true
        // Handle a modification
        if (this.mods.size === 0) { // Only if not using predefined mods dict
          // Extract mod string and create Modification object
          const modValue = this._extractModValue(block);
          const modObj = new Modification(modValue);

          if (modPosition === 'right' && currentPosition > 0) {
            // Apply directly to previous residue for right positioning
            if (Array.isArray(this.seq) && this.seq.every(item => item instanceof AminoAcid)) {
              this.seq[currentPosition - 1].addModification(modObj);
            }
          } else {
            // Store for later application with left positioning
            currentMod.push(modObj);
          }
        }
      }
    }
  }

  /**
   * Apply modifications to a block.
   */
  private _applyModifications(block: T, position: number, pendingMods: Modification[]): void {
    // Apply pending modifications
    for (const mod of pendingMods) {
      if (block instanceof AminoAcid) {
        block.addModification(mod);
      }

    }

    // Apply configured modifications
    if (this.mods.has(position)) {
      const modsToApply = this.mods.get(position);
      if (modsToApply) {
        if (block instanceof AminoAcid) {
          for (const mod of modsToApply) {
            block.addModification(mod);
          }
        }
      }
    }
  }

  /**
   * Extract modification value from a string.
   */
  private _extractModValue(modStr: string): string {
    if (
      modStr[0] in Sequence._MOD_ENCLOSURE_START &&
      modStr[modStr.length - 1] in Sequence._MOD_ENCLOSURE_END
    ) {
      return modStr.substring(1, modStr.length - 1);
    }
    return modStr;
  }

  /**
   * Iterate through sequence elements, identifying blocks and modifications.
   */
  private *_sequenceIterator(seq: string | any[]): Generator<[any, boolean]> {
    let modOpen = 0;
    let block = '';
    let isMod = false;

    if (typeof seq === 'string') {
      // Convert string to array of characters
      seq = Array.from(seq);
    }

    for (const item of seq) {
      if (typeof item === 'string') {
        if (Sequence._MOD_ENCLOSURE_START.has(item)) {
          isMod = true;
          modOpen += 1;
        } else if (Sequence._MOD_ENCLOSURE_END.has(item)) {
          modOpen -= 1;
        }
        block += item;
      } else if (item instanceof this.encoder) {
        block = item.value;
      } else if (Array.isArray(item)) {
        // Recursively handle nested iterables
        yield* this._sequenceIterator(item);
        continue;
      }

      if (modOpen === 0 && block) {
        yield [block, isMod];
        isMod = false;
        block = '';
      }
    }
  }


  /**
   * Deep copy an object or array.
   */
  private deepCopy<U>(obj: U): U {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepCopy(item)) as any;
    }

    const copy = Object.create(Object.getPrototypeOf(obj));
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = this.deepCopy((obj as any)[key]);
      }
    }
    return copy as U;
  }

  /**
   * Convert the sequence to ProForma format.
   */
  toProforma(): string {
    if (this.isMultiChain) {
      return this.chains.map(chain => this._chainToProforma(chain)).join("//");
    } else {
      return this._chainToProforma(this as unknown as Sequence<AminoAcid>)
    }
  }

  /**
   * Convert a chain to ProForma format.
   */
  private _chainToProforma(chain: Sequence): string {
    let result = "";

    // Add global modifications
    for (const mod of this.globalMods) {
      result += mod.toProforma();
    }

    // Handle position ranges and modifications
    const ranges: [number, number, Modification][] = [];
    for (let i = 0; i < this.seq.length; i++) {
      const aa = this.seq[i];
      if (aa instanceof AminoAcid) {
        for (const mod of aa.mods) {
          if (
            mod.inRange &&
            mod.rangeStart !== undefined && mod.rangeStart !== null &&
            mod.rangeEnd !== undefined && mod.rangeEnd !== null
          ) {
            ranges.push([mod.rangeStart, mod.rangeEnd, mod]);
          }
        }
      }

    }
    ranges.sort((a, b) => a[0] - b[0]);

    // Handle unknown position modifications
    if (chain.mods.has(-4)) {
      const unknownModsByValue = new Map<string, number>();
      const chainMods = chain.mods.get(-4);
      if (chainMods) {
        for (const mod of chainMods) {
          const modProforma = mod.toProforma();
          unknownModsByValue.set(modProforma, (unknownModsByValue.get(modProforma) || 0) + 1);
        }
      }


      for (const [modValue, count] of unknownModsByValue.entries()) {
        let ambiguityStr = "";
        if (count > 1) {
          ambiguityStr += `[${modValue}]`;
          ambiguityStr += `^${count}?`;
        } else {
          ambiguityStr = `[${modValue}]`;
          ambiguityStr += `?`;
        }
        result += ambiguityStr;
      }
    }

    // Handle labile modifications
    const labileChainMods = chain.mods.get(-3);
    if (labileChainMods) {
      for (const mod of labileChainMods) {
        if (mod.modType === "labile") {
          result += `{${mod.toProforma()}}`;
        }
      }
    }

    // Handle N-terminal modifications
    const nChainMod = chain.mods.get(-1);
    if (nChainMod) {
      let nModStr = "";
      for (const mod of nChainMod) {
        const modStr = `[${mod.toProforma()}]`;
        nModStr += modStr;
      }
      if (nModStr) {
        result += nModStr + "-";
      }
    }

    // Handle sequence ambiguities
    const sortedAmbiguities = [...this.sequenceAmbiguities].sort((a, b) => a.position - b.position);
    let ambiguityIndex = 0;

    // Process each amino acid in the sequence
    let rangeStart = false;
    for (let i = 0; i < chain.seq.length; i++) {
      // Check for ambiguity at this position
      if (
        ambiguityIndex < sortedAmbiguities.length &&
        sortedAmbiguities[ambiguityIndex].position === i
      ) {
        const ambiguity = sortedAmbiguities[ambiguityIndex];
        result += `(?${ambiguity.value})`;
        ambiguityIndex++;
      }

      // Check for range start
      if (!rangeStart) {
        for (const [start, end, mod] of ranges) {
          if (i === start) {
            result += "(";
            rangeStart = true;
            break;
          }
        }
      }

      // Add amino acid value
      result += chain.seq[i].value;

      // Add modifications for this position
      let modStrData = "";
      if (chain.seq[i].mods && chain.seq[i].mods.length > 0) {
        const crosslinkRefsAdded = new Set();
        let branchRefsAdded = false;

        for (const mod of chain.seq[i].mods) {
          let thisModStr = mod.toProforma();
          if (rangeStart && mod.inRange) {
            continue;
          }
          if (mod.modType === "ambiguous") {
            if (!mod.hasAmbiguity) {
              if (mod.inRange) {
                thisModStr = `[${thisModStr}]`;
              } else {
                thisModStr = `{${thisModStr}}`;
              }
            } else {
              thisModStr = `[${thisModStr}]`;
            }
          } else {
            thisModStr = `[${thisModStr}]`;
          }

          modStrData += thisModStr;
        }
        result += modStrData;
      }

      // Check for range end
      if (rangeStart) {
        for (const [start, end, mod] of ranges) {
          if (i === end) {
            result += ")";
            rangeStart = false;
            break;
          }
        }

        if (!rangeStart) {
          result = this.getModAndAddToString(chain.seq[i], result);
        }
      }
    }

    // Handle C-terminal modifications
    const cChainMod = chain.mods.get(-2);
    if (cChainMod) {
      let nModStr = "";
      for (const mod of cChainMod) {
        const modStr = `[${mod.toProforma()}]`;
        nModStr += modStr;
      }
      if (nModStr) {
        result += "-" + nModStr;
      }
    }

    return result;
  }

  /**
   * Get modifications and add to string.
   */
  getModAndAddToString(aa: AminoAcid, result: string): string {
    let modStr = "";
    if (aa.mods && aa.mods.length > 0) {
      for (const mod of aa.mods) {
        let thisModStr = mod.toProforma();
        if (mod.modType === "ambiguous") {
          if (!mod.hasAmbiguity) {
            if (mod.inRange) {
              thisModStr = `[${thisModStr}]`;
            } else {
              thisModStr = `{${thisModStr}}`;
            }
          } else {
            thisModStr = `[${thisModStr}]`;
          }
        } else {
          thisModStr = `[${thisModStr}]`;
        }
        modStr += thisModStr;
      }
      result += modStr;
    }
    return result;
  }

  /**
   * Add info tags to the result string based on the modification.
   */
  private _addInfoTags(result: string, mod: Modification): string {
    let infoStr = "";
    const addedInfo = new Set<string>();

    let strippedResult = result.startsWith("[") ? result.substring(1) : result;
    strippedResult = strippedResult.endsWith("]") ? strippedResult.substring(0, strippedResult.length - 1) : strippedResult;

    addedInfo.add(strippedResult);

    for (const i of strippedResult.split(":", 2)) {
      const iSplitted = i.split("#", 2);
      if (iSplitted.length > 1) {
        for (const i2 of iSplitted) {
          if (i2 && !addedInfo.has(i2)) {
            addedInfo.add(i2);
          }
        }
      }
      addedInfo.add(i);
    }

    if (mod.mass !== undefined) {
      const massStr = mod.mass > 0 ? `+${mod.mass}` : `${mod.mass}`;
      if (!addedInfo.has(massStr)) {
        infoStr += `|${massStr}`;
        addedInfo.add(massStr);
      }
    }

    if ((mod as any).synonyms) {
      for (const synonym of (mod as any).synonyms) {
        if (!addedInfo.has(synonym)) {
          infoStr += `|${synonym}`;
          addedInfo.add(synonym);
        }
      }
    }

    if ((mod as any).observedMass) {
      const obsStr = (mod as any).observedMass > 0 ?
        `Obs:+${(mod as any).observedMass}` :
        `Obs:${(mod as any).observedMass}`;
      if (!addedInfo.has(obsStr)) {
        infoStr += `|${obsStr}`;
        addedInfo.add(obsStr);
      }
    }

    if ((mod as any).infoTags) {
      for (const tag of (mod as any).infoTags) {
        if (!addedInfo.has(tag)) {
          infoStr += `|${tag}`;
          addedInfo.add(tag);
        }
      }
    }

    if (infoStr) {
      if (result.endsWith("]")) {
        result = result.substring(0, result.length - 1) + infoStr + "]";
      } else {
        result += infoStr;
      }
    }

    return result;
  }

  /**
   * Get item or slice from sequence.
   */
  getItem(key: number | [number, number]): BaseBlock | AminoAcid | Sequence {
    if (Array.isArray(key)) {
      const [start, end] = key;
      const newSeq = new Sequence(this.seq, this.encoder, {}, false);
      newSeq.seq = this.seq.slice(start, end);
      newSeq.seqLength = newSeq.seq.length;
      return newSeq as unknown as Sequence;
    }
    return this.seq[key];
  }

  /**
   * Get length of sequence.
   */
  get length(): number {
    return this.seqLength;
  }

  /**
   * String representation of sequence.
   */
  toString(): string {
    return this.seq.map(block => block.toString()).join("");
  }

  /**
   * Programmatic representation of sequence.
   */
  toRepr(): string {
    return `Sequence('${this.toString()}')`;
  }

  /**
   * Make the sequence iterable.
   */
  [Symbol.iterator](): Iterator<T> {
    let index = 0;
    const seq = this.seq;

    return {
      next(): IteratorResult<T> {
        if (index < seq.length) {
          return { value: seq[index++], done: false };
        } else {
          return { value: undefined, done: true };
        }
      }
    };
  }

  /**
   * Check if two sequences are equal.
   */
  equals(other: any): boolean {
    if (!(other instanceof Sequence)) {
      return false;
    }
    if (this.seqLength !== other.seqLength) {
      return false;
    }
    for (let i = 0; i < this.seqLength; i++) {
      if (!(this.seq[i] as any).equals(other.seq[i])) {
        return false;
      }
    }
    return true;
  }

  /**
   * Add modifications to residues at specified positions.
   */
  addModifications(modDict: Record<number, Modification[]>): void {
    for (const aa of this.seq) {
      if (aa.position && aa instanceof AminoAcid) {
        if (aa.position in modDict) {
          for (const mod of modDict[aa.position]) {
            aa.addModification(mod);
          }
        }
      }
    }
  }

  /**
   * Return the sequence as a string without any modification annotations.
   */
  toStrippedString(): string {
    return this.seq.map(block => block.value).join("");
  }

  /**
   * Customize the sequence string with annotations.
   */
  toStringCustomize(
    data: Record<number, string | string[]>,
    annotationPlacement: 'left' | 'right' = 'right',
    blockSeparator: string = "",
    annotationEncloseCharacters: [string, string] = ["[", "]"],
    individualAnnotationEnclose: boolean = false,
    individualAnnotationEncloseCharacters: [string, string] = ["[", "]"],
    individualAnnotationSeparator: string = ""
  ): string {
    if (annotationPlacement !== 'left' && annotationPlacement !== 'right') {
      throw new Error("annotationPlacement must be either 'left' or 'right'");
    }

    const elements: string[] = [];

    for (let i = 0; i < this.seq.length; i++) {
      // Add annotation before residue if placement is left
      if (annotationPlacement === 'left' && i in data) {
        const annotation = this._formatAnnotation(
          data[i],
          individualAnnotationEnclose,
          individualAnnotationEncloseCharacters,
          individualAnnotationSeparator,
          annotationEncloseCharacters
        );
        elements.push(annotation);
      }

      // Add residue
      elements.push(this.seq[i].value);

      // Add annotation after residue if placement is right
      if (annotationPlacement === 'right' && i in data) {
        const annotation = this._formatAnnotation(
          data[i],
          individualAnnotationEnclose,
          individualAnnotationEncloseCharacters,
          individualAnnotationSeparator,
          annotationEncloseCharacters
        );
        elements.push(annotation);
      }
    }

    return elements.join(blockSeparator);
  }

  /**
   * Format annotation strings.
   */
  private _formatAnnotation(
    annotations: string | string[],
    individualEnclose: boolean,
    individualEncloseChars: [string, string],
    separator: string,
    groupEncloseChars: [string, string]
  ): string {
    let annText: string;

    if (typeof annotations === 'string') {
      annText = annotations;
    } else {
      if (individualEnclose) {
        const enclosedAnnotations = annotations.map(
          item => `${individualEncloseChars[0]}${item}${individualEncloseChars[1]}`
        );
        annText = enclosedAnnotations.join(separator);
      } else {
        annText = annotations.join(separator);
      }
    }

    if (groupEncloseChars) {
      return `${groupEncloseChars[0]}${annText}${groupEncloseChars[1]}`;
    }

    return annText;
  }

  /**
   * Find positions in the sequence that match a given regex motif.
   */
  *findWithRegex(motif: string, ignore?: boolean[]): Iterable<[number, number]> {
    const pattern = new RegExp(motif, 'g');
    let seqStr: string;

    if (ignore) {
      // Build string excluding ignored positions
      seqStr = this.seq
        .filter((_, i) => i < ignore.length && !ignore[i])
        .map(aa => aa.value)
        .join('');
    } else {
      seqStr = this.toStrippedString();
    }

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(seqStr)) !== null) {
      if (!match.groups || Object.keys(match.groups).length === 0) {
        yield [match.index, match.index + match[0].length];
      } else {
        for (let i = 1; i < match.length; i++) {
          if (match[i]) {
            const groupStart = seqStr.indexOf(match[i], match.index);
            yield [groupStart, groupStart + match[i].length];
          }
        }
      }
    }
  }

  /**
   * Identify gaps in the sequence.
   */
  gaps(): boolean[] {
    return this.seq.map(block => block.value === "-");
  }

  /**
   * Count occurrences of a character in a range.
   */
  count(char: string, start: number, end: number): number {
    const subStr = this.toStrippedString().substring(start, end);
    return (subStr.match(new RegExp(char, 'g')) || []).length;
  }

  /**
   * Convert the sequence to a dictionary representation.
   */
  toDict(): Record<string, any> {
    // Collect all modifications by position
    const modsByPosition: Record<string, any[]> = {};

    for (let i = 0; i < this.seq.length; i++) {
      const aa = this.seq[i];
      if (aa instanceof AminoAcid) {
        if (aa.mods && aa.mods.length > 0) {
          modsByPosition[i] = aa.mods.map(mod => mod.toDict());
        }
      }
    }

    return {
      sequence: this.toStrippedString(),
      modifications: modsByPosition
    };
  }
}


/**
 * Generator for sequences with different modification combinations.
 *
 * This class creates all possible modified sequences by applying combinations
 * of static and variable modifications to a base sequence.
 */
export class ModdedSequenceGenerator {
  private seq: string;
  private staticMods: Modification[];
  private variableMods: Modification[];
  private usedScenariosSet: Set<string>;
  private ignorePosition: Set<number>;
  private staticModPositionDict: Record<number, Modification[]>;
  private variableMapScenarios: Record<string, number[][]>;
  private staticMap?: ModificationMap;
  private variableMap?: ModificationMap;

  /**
   * Initialize a ModdedSequenceGenerator object.
   *
   * @param seq - The base sequence to modify
   * @param variableMods - List of variable modifications to apply
   * @param staticMods - List of static modifications to apply
   * @param usedScenarios - Set of serialized modification scenarios to avoid duplicates
   * @param parseModPosition - Whether to parse positions using modification regex patterns
   * @param modPositionDict - Pre-computed positions for modifications
   * @param ignorePosition - Set of positions to ignore when applying modifications
   */
  constructor(
    seq: string,
    variableMods: Modification[] = [],
    staticMods: Modification[] = [],
    usedScenarios: Set<string> = new Set(),
    parseModPosition: boolean = true,
    modPositionDict: Record<string, number[]> = {},
    ignorePosition: Set<number> = new Set()
  ) {
    this.seq = seq;
    this.staticMods = staticMods || [];
    this.variableMods = variableMods || [];
    this.usedScenariosSet = usedScenarios || new Set();
    this.ignorePosition = ignorePosition || new Set();
    this.staticModPositionDict = {};
    this.variableMapScenarios = {};

    // Initialize modification maps and position dictionaries
    if (this.staticMods.length > 0) {
      this.staticMap = new ModificationMap(
        seq,
        this.staticMods,
        new Set(), // Initially no ignored positions for static mods
        parseModPosition,
        modPositionDict
      );
      this.staticModPositionDict = this._generateStaticModPositions();

      // Update ignore positions with static mod positions
      for (const pos of Object.keys(this.staticModPositionDict).map(Number)) {
        this.ignorePosition.add(pos);
      }
    }

    if (this.variableMods.length > 0) {
      // Create variable modification map, considering ignored positions
      this.variableMap = new ModificationMap(
        seq,
        this.variableMods,
        this.ignorePosition,
        parseModPosition,
        modPositionDict
      );
    }
  }

  /**
   * Generate all possible modification combinations.
   */
  *generate(): Generator<Record<number, Modification[]>> {
    if (this.variableMods.length === 0) {
      // If only static mods, yield the single scenario if not already used
      const serialized = orderedSerializePositionDict(this.staticModPositionDict);
      if (!this.usedScenariosSet.has(serialized)) {
        this.usedScenariosSet.add(serialized);
        yield this.staticModPositionDict;
      }
      return;
    }

    // Generate all variable mod scenarios
    this._generateVariableModScenarios();

    // Explore all combinations
    for (const variableScenario of this._exploreScenarios()) {
      // Combine static and variable modifications
      const combinedScenario: Record<number, Modification[]> = { ...this.staticModPositionDict };

      // Update with variable modifications
      for (const [posStr, mods] of Object.entries(variableScenario)) {
        const pos = Number(posStr);
        if (pos in combinedScenario) {
          combinedScenario[pos] = [...combinedScenario[pos], ...mods];
        } else {
          combinedScenario[pos] = [...mods];
        }
      }

      // Serialize to check for duplicates
      const serialized = orderedSerializePositionDict(combinedScenario);
      if (!this.usedScenariosSet.has(serialized)) {
        this.usedScenariosSet.add(serialized);
        yield combinedScenario;
      }
    }
  }

  /**
   * Generate dictionary of positions for static modifications.
   */
  private _generateStaticModPositions(): Record<number, Modification[]> {
    const positionDict: Record<number, Modification[]> = {};

    for (const mod of this.staticMods) {
      if (!this.staticMap) continue;

      const positions = this.staticMap.getModPositions(String(mod.value));
      if (positions && positions.length > 0) {
        for (const position of positions) {
          if (!(position in positionDict)) {
            positionDict[position] = [];
          }
          positionDict[position].push(mod);
        }
      }
    }

    return positionDict;
  }

  /**
   * Generate all possible position combinations for variable modifications.
   */
  private _generateVariableModScenarios(): void {
    this.variableMapScenarios = {};

    for (const mod of this.variableMods) {
      if (!this.variableMap) continue;

      const positions = this.variableMap.getModPositions(String(mod.value)) || [];

      if (!mod.allFilled) {
        // Generate all possible subsets of positions
        const scenarios = Array.from(variablePositionPlacementGenerator(positions));
        this.variableMapScenarios[mod.value] = scenarios;
      } else {
        // For allFilled mods, only empty list or all positions are valid
        this.variableMapScenarios[mod.value] = [[], positions];
      }
    }
  }

  /**
   * Recursively explore all possible modification scenarios.
   *
   * @param currentModIdx - Index of the current modification being processed
   * @param currentScenario - Current scenario being built
   */
  private *_exploreScenarios(
    currentModIdx: number = 0,
    currentScenario: Record<number, Modification[]> = {}
  ): Generator<Record<number, Modification[]>> {
    // Base case: processed all modifications
    if (currentModIdx >= this.variableMods.length) {
      yield { ...currentScenario };
      return;
    }

    const currentMod = this.variableMods[currentModIdx];
    const positionCombinations = this.variableMapScenarios[currentMod.value] || [[]];

    for (const positions of positionCombinations) {
      // Create a copy of the current scenario
      const scenarioCopy: Record<number, Modification[]> = this._deepCopyScenario(currentScenario);

      // Add current modification to positions
      for (const pos of positions) {
        if (!(pos in scenarioCopy)) {
          scenarioCopy[pos] = [];
        }
        // Create a deep copy of the modification
        scenarioCopy[pos].push(this._deepCopyModification(currentMod));
      }

      // Recursively continue with next modification
      yield* this._exploreScenarios(currentModIdx + 1, scenarioCopy);
    }
  }

  /**
   * Create a deep copy of a modification scenario.
   */
  private _deepCopyScenario(scenario: Record<number, Modification[]>): Record<number, Modification[]> {
    const copy: Record<number, Modification[]> = {};

    for (const [pos, mods] of Object.entries(scenario)) {
      copy[Number(pos)] = mods.map(mod => this._deepCopyModification(mod));
    }

    return copy;
  }

  /**
   * Create a deep copy of a modification.
   */
  private _deepCopyModification(mod: Modification): Modification {
    return Object.assign(Object.create(Object.getPrototypeOf(mod)),
      JSON.parse(JSON.stringify(mod)));
  }
}