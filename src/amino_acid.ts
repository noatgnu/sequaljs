import { BaseBlock } from './base_block';
import { Modification } from './modification';
import { AA_mass } from './resources';

/**
 * Represents an amino acid block that can carry position, modifications, and amino acid value.
 *
 * Inherits from the BaseBlock class and adds functionality specific to amino acids, such as
 * handling modifications and inferring mass from a predefined dictionary.
 */
export class AminoAcid extends BaseBlock {
  private _mods: Modification[] = [];

  /**
   * Initialize an AminoAcid object.
   *
   * @param value - The amino acid one letter or three letter code
   * @param position - The position of this amino acid in a sequence
   * @param mass - The mass of the amino acid. If not provided, inferred from AA_mass dictionary
   */
  constructor(value: string, position?: number, mass?: number) {
    if (!(value in AA_mass) && mass === undefined) {
      throw new Error(`Unknown amino acid '${value}' and no mass provided`);
    }

    const inferred_mass = mass !== undefined ? mass : AA_mass[value];
    super(value, position, false, inferred_mass);
  }

  /**
   * Get the list of modifications applied to this amino acid.
   */
  get mods(): Modification[] {
    return [...this._mods]; // Return a copy to prevent direct modification
  }

  /**
   * Add a modification to this amino acid.
   *
   * @param mod - The modification to add
   */
  addModification(mod: Modification): void {
    this._mods.push(mod);
  }

  /**
   * Add a modification to this amino acid (legacy method).
   *
   * @param mod - The modification to add
   */
  setModification(mod: Modification): void {
    this.addModification(mod);
  }

  /**
   * Remove a modification from this amino acid.
   *
   * @param mod - The modification or modification value to remove
   * @returns True if modification was removed, False if not found
   */
  removeModification(mod: Modification | string): boolean {
    if (typeof mod === 'string') {
      for (let i = 0; i < this._mods.length; i++) {
        if (this._mods[i].value === mod) {
          this._mods.splice(i, 1);
          return true;
        }
      }
    } else {
      const index = this._mods.indexOf(mod);
      if (index !== -1) {
        this._mods.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Check if this amino acid has a specific modification.
   *
   * @param mod - The modification or modification value to check for
   * @returns True if the modification exists, False otherwise
   */
  hasModification(mod: Modification | string): boolean {
    if (typeof mod === 'string') {
      return this._mods.some(m => m.value === mod);
    }
    return this._mods.includes(mod);
  }

  /**
   * Calculate the total mass including all modifications.
   *
   * @returns The total mass of the amino acid with all modifications
   */
  getTotalMass(): number {
    let total = this.mass || 0;
    for (const mod of this._mods) {
      if (mod.mass) {
        total += mod.mass;
      }
    }
    return total;
  }

  /**
   * Convert the amino acid to a dictionary representation.
   *
   * @returns Dictionary containing the amino acid's attributes including modifications
   */
  toDict(): Record<string, any> {
    const result = super.toDict();
    result["mods"] = this._mods.map(mod => mod.toDict());
    result["total_mass"] = this.getTotalMass();
    return result;
  }

  /**
   * Check if two amino acids are equal including their modifications.
   */
  equals(other: any): boolean {
    if (!super.equals(other)) {
      return false;
    }
    if (!(other instanceof AminoAcid)) {
      return false;
    }
    if (this._mods.length !== other._mods.length) {
      return false;
    }
    // Sort mods by value for comparison
    const selfMods = [...this._mods].sort((a, b) => a.value.localeCompare(b.value));
    const otherMods = [...other._mods].sort((a, b) => a.value.localeCompare(b.value));
    return selfMods.every((a, i) => a.equals(otherMods[i]));
  }

  /**
   * Generate a hash for the amino acid including modifications.
   */
  hashCode(): number {
    const modHash = this._mods.map(m => m.value).sort().join('');
    return super.hashCode() ^ modHash.split('').reduce((a, b) => {
      return ((a << 5) - a) + b.charCodeAt(0);
    }, 0);
  }

  /**
   * Return a string representation with modifications.
   */
  toString(): string {
    let s = this.value;
    for (const mod of this._mods) {
      s += `[${mod.value}]`;
    }
    return s;
  }

  /**
   * Return a detailed string representation for debugging.
   */
  toDebugString(): string {
    const modStr = this._mods.map(m => m.toString()).join(", ");
    return `AminoAcid(value='${this.value}', position=${this.position}, mods=[${modStr}])`;
  }
}