import { Sequence } from './sequence';
import { calculateMass } from './mass';
import { proton } from './resources';
import { Modification } from './modification';

const modifier = {
  "b": -18 - 19,
};

/**
 * Represents an ion fragment sequence object, inheriting properties from the Sequence class.
 *
 * This class is used to convert a Sequence object into an Ion fragment, with additional properties
 * such as charge, ion type, and fragment number. It also handles modifications and labile groups
 * within the sequence.
 */
export class Ion extends Sequence {
  charge: number;
  ion_type: string | null;
  fragment_number: number | null;
  mods: Map<number, Modification[]>;
  has_labile: boolean;

  /**
   * Initialize an Ion object.
   *
   * @param seq - The Sequence object to be converted into an Ion fragment
   * @param charge - The charge of the ion (default is 1)
   * @param ion_type - The name of the transition type
   * @param fragment_number - The number of the transition
   */
  constructor(
    seq: Sequence,
    charge: number = 1,
    ion_type: string | null = null,
    fragment_number: number | null = null
  ) {
    super(seq);
    this.charge = charge;
    this.ion_type = ion_type;
    this.fragment_number = fragment_number;
    this.mods = new Map();
    this.has_labile = false;

    // Iterating through each amino acid position and build a modification list for the ion
    this.seq.forEach((aa, i) => {
      if (aa.mods) {
        for (const m of aa.mods) {
          if (!(i in this.mods)) {
            this.mods.set(i, []);
          }

          this.mods.get(i)?.push(m);
          if (m.labile) {
            this.has_labile = true;
          }
        }
      }
    });
  }

  /**
   * Calculate the mass-to-charge ratio (m/z) of the ion.
   *
   * @param charge - The charge of the ion. If not specified, the object's charge is used
   * @param with_water - Whether the mass will be calculated with or without water
   * @param extra_mass - Extra modification of mass that is not represented within the sequence
   * @returns The calculated m/z value of the ion
   */
  mzCalculate(charge?: number, with_water: boolean = false, extra_mass: number = 0): number {
    if (!charge) {
      charge = this.charge;
    }
    const m = calculateMass(this.seq, undefined, 0, 0, with_water) + extra_mass;

    // Charge is calculated with the hardcoded mass of protons
    const mi = (m + charge * proton) / charge;
    return mi;
  }
}