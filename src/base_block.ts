import {calculateHashCode} from "./utils";

export class BaseBlock {
  /**
   * Base class for biochemical building blocks with position and mass properties.
   *
   * This abstract base class provides core functionality for blocks such as
   * amino acids, modifications, and other biochemical components.
   */

  protected _value: string;
  private _position?: number | null;
  private _branch: boolean;
  private _mass?: number | null;
  private _extra?: any;

  constructor(
    value: string,
    position?: number | null,
    branch: boolean = false,
    mass?: number | null
  ) {
    /**
     * Initialize a BaseBlock object.
     *
     * Parameters
     * ----------
     * value : string
     *     The identifier of the block.
     * position : number, optional
     *     The position of the block within a chain.
     * branch : boolean, optional
     *     Indicates whether this block is a branch of another block.
     * mass : number, optional
     *     The mass of the block in Daltons.
     */
    this._value = value;
    this._position = position ?? null;
    this._branch = branch;
    this._mass = mass ?? null;
    this._extra = undefined;
  }

  get value(): string {
    /** Get the identifier of the block. */
    return this._value;
  }

  set value(value: string) {
    /** Set the identifier of the block. */
    this._value = value;
  }

  get position(): number | null {
    /** Get the position of the block. */
    return this._position ?? null;
  }

  set position(position: number | null) {
    /** Set the position of the block. */
    this._position = position;
  }

  get branch(): boolean {
    /** Check if the block is a branch. */
    return this._branch;
  }

  get mass(): number | null {
    /** Get the mass of the block. */
    return this._mass ?? null;
  }

  set mass(mass: number | null) {
    /** Set the mass of the block. */
    this._mass = mass;
  }

  get extra(): any {
    /** Get extra information associated with the block. */
    return this._extra;
  }

  set extra(value: any) {
    /** Set extra information for the block. */
    this._extra = value;
  }

  toDict(): Record<string, any> {
    /**
     * Convert the block to a dictionary representation.
     *
     * Returns
     * -------
     * Dictionary containing the block's attributes.
     */
    return {
      value: this._value,
      position: this._position,
      branch: this._branch,
      mass: this._mass,
      extra: this._extra,
    };
  }

  equals(other: BaseBlock): boolean {
    /** Check if two blocks are equal. */
    if (!(other instanceof BaseBlock)) {
      return false;
    }
    return (
      this._value === other.value &&
      this._position === other.position &&
      this._branch === other.branch
    );
  }

  hashCode(): number {
    /** Generate a hash for the block. */
    const valueHash = calculateHashCode(this._value);
    const branchHash = this._branch ? 1 : 0;
    if (this._position === undefined || this._position === null) {
      return (valueHash ?? 0) ^ branchHash;
    } else {
      const positionHash = calculateHashCode(this._position.toString());
      return (valueHash ?? 0) ^ (positionHash ?? 0) ^ branchHash;
    }
  }

  toString(): string {
    /** Return a string representation of the block. */
    return this._value;
  }

  toRepr(): string {
    /** Return a detailed string representation of the block. */
    return `${this.constructor.name}(value='${this._value}', position=${this._position})`;
  }
}
