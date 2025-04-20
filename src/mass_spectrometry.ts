/**
 * This module provides functionality for fragmenting sequences into ion fragments for mass spectrometry analysis.
 */

import { Ion } from './ion';
import { Sequence } from './sequence';
import { Modification } from './modification';
import {AminoAcid} from "./amino_acid";

export const ax = "ax";
export const by = "by";
export const cz = "cz";

/**
 * Calculate non-labile modifications and yield associated transitions.
 *
 * For example, "by" would yield a tuple of "b" and "y" transitions.
 *
 * @param sequence - The sequence to be fragmented
 * @param fragmentType - The type of fragment transition (e.g., "by", "ax")
 */
export function* fragmentNonLabile(
  sequence: Sequence,
  fragmentType: string
): Generator<[Ion, Ion]> {
  for (let i = 1; i < sequence.seqLength; i++) {
    const left = new Ion(
      sequence.getItem([0, i]) as Sequence,
      1,
      fragmentType[0],
      i
    );
    const right = new Ion(
      sequence.getItem(i) as Sequence,
      1,
      fragmentType[1],
      sequence.seqLength - i
    );
    yield [left, right];
  }
}

/**
 * Calculate all labile modification variants for the sequence and its associated labile modifications.
 *
 * @param sequence - The sequence to be fragmented
 * @returns An Ion object representing the fragmented sequence with labile modifications
 */
export function fragmentLabile(sequence: Sequence): Ion {
  let fragmentNumber = 0;
  for (const p in sequence.mods.keys()) {
    const modList = sequence.mods.get(Number(p));
    if (modList) {
      for (const i of modList) {
        if (i.labile) {
          fragmentNumber += i.labileNumber;
        }
      }
    }

  }
  return new Ion(sequence, 1, "Y", fragmentNumber);
}

/**
 * A factory class for generating ion fragments from sequences.
 */
export class FragmentFactory {
  fragment_type: string;
  ignore: Modification[];

  /**
   * Initialize a FragmentFactory object.
   *
   * @param fragmentType - The type of fragment transition (e.g., "by", "ax")
   * @param ignore - A list of modifications to ignore
   */
  constructor(fragmentType: string, ignore: Modification[] = []) {
    this.fragment_type = fragmentType;
    this.ignore = ignore || [];
  }

  /**
   * Set the list of modifications to ignore.
   *
   * @param ignore - A list of modifications to ignore
   */
  setIgnore(ignore: Modification[]): void {
    this.ignore = ignore;
  }
}