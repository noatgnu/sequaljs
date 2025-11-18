import {calculateHashCode} from "./utils";

/**
 * Base class for biochemical building blocks with position and mass properties.
 *
 * This abstract base class provides core functionality for blocks such as
 * amino acids, modifications, and other biochemical components.
 */
export class BaseBlock {

  protected _value: string;
  private _position?: number | null;
  private _branch: boolean;
  private _mass?: number | null;
  private _extra?: any;

  /**
   * Initializes a BaseBlock object.
   *
   * @param value - The identifier of the block.
   * @param position - The position of the block within a chain.
   * @param branch - Indicates whether this block is a branch of another block.
   * @param mass - The mass of the block in Daltons.
   */
  constructor(
    value: string,
    position?: number | null,
    branch: boolean = false,
    mass?: number | null
  ) {
    this._value = value;
    this._position = position ?? null;
    this._branch = branch;
    this._mass = mass ?? null;
    this._extra = undefined;
  }

  /**
   * Gets the identifier of the block.
   */
  get value(): string {
    return this._value;
  }

  /**
   * Sets the identifier of the block.
   * @param value - The new identifier.
   */
  set value(value: string) {
    this._value = value;
  }

  /**
   * Gets the position of the block.
   */
  get position(): number | null {
    return this._position ?? null;
  }

  /**
   * Sets the position of the block.
   * @param position - The new position.
   */
  set position(position: number | null) {
    this._position = position;
  }

  /**
   * Checks if the block is a branch.
   */
  get branch(): boolean {
    return this._branch;
  }

  /**
   * Gets the mass of the block.
   */
  get mass(): number | null {
    return this._mass ?? null;
  }

  /**
   * Sets the mass of the block.
   * @param mass - The new mass.
   */
  set mass(mass: number | null) {
    this._mass = mass;
  }

  /**
   * Gets extra information associated with the block.
   */
  get extra(): any {
    return this._extra;
  }

  /**
   * Sets extra information for the block.
   * @param value - The extra information.
   */
  set extra(value: any) {
    this._extra = value;
  }

  /**
   * Converts the block to a dictionary representation.
   * @returns A dictionary containing the block's attributes.
   */
  toDict(): Record<string, any> {
    return {
      value: this._value,
      position: this._position,
      branch: this._branch,
      mass: this._mass,
      extra: this._extra,
    };
  }

  /**
   * Checks if two blocks are equal.
   * @param other - The other block to compare with.
   * @returns True if the blocks are equal, false otherwise.
   */
  equals(other: BaseBlock): boolean {
    if (!(other instanceof BaseBlock)) {
      return false;
    }
    return (
      this._value === other.value &&
      this._position === other.position &&
      this._branch === other.branch
    );
  }

  /**
   * Generates a hash for the block.
   * @returns The hash code.
   */
  hashCode(): number {
    const valueHash = calculateHashCode(this._value);
    const branchHash = this._branch ? 1 : 0;
    if (this._position === undefined || this._position === null) {
      return (valueHash ?? 0) ^ branchHash;
    } else {
      const positionHash = calculateHashCode(this._position.toString());
      return (valueHash ?? 0) ^ (positionHash ?? 0) ^ branchHash;
    }
  }

  /**
   * Returns a string representation of the block.
   * @returns The string representation.
   */
  toString(): string {
    return this._value;
  }

  /**
   * Returns a detailed string representation of the block.
   * @returns The detailed string representation.
   */
  toRepr(): string {
    return `${this.constructor.name}(value='${this._value}', position=${this._position})`;
  }
}
