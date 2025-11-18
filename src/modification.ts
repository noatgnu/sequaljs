import {monosaccharides} from "./resources";
import {BaseBlock} from "./base_block";

/**
 * Represents a value in a ProForma modification string.
 */
export class PipeValue {
  static SYNONYM = "synonym";
  static INFO_TAG = "info_tag";
  static MASS = "mass";
  static OBSERVED_MASS = "observed_mass";
  static CROSSLINK = "crosslink";
  static BRANCH = "branch";
  static AMBIGUITY = "ambiguity";
  static GLYCAN = "glycan";
  static GAP = "gap";
  static FORMULA = "formula";

  value: string;
  private _type: string;
  crosslinkId: string | null = null;
  isBranch: boolean = false;
  isBranchRef: boolean = false;
  isCrosslinkRef: boolean = false;
  ambiguityGroup: string | null = null;
  isAmbiguityRef: boolean = false;
  localizationScore: number | null = null;
  source: string | null = null;
  originalValue: string | null;
  mass: number | null = null;
  observedMass: number | null = null;
  isValidGlycan: boolean = false;
  isValidFormula: boolean = false;
  assignedTypes: string[] = [];

  charge: string | null = null;        // e.g., "z+2", "z-1"
  chargeValue: number | null = null;   // e.g., 2, -1

  /**
   * Initializes a PipeValue object.
   *
   * @param value - The value of the pipe value.
   * @param valueType - The type of the pipe value.
   * @param originalValue - The original value of the pipe value.
   */
  constructor(value: string, valueType: string, originalValue: string | null = null) {
    this.value = value;
    this._type = valueType;
    this.originalValue = originalValue;
    this._extractProperties();
  }

  /**
   * Extracts properties from the value.
   * @private
   */
  private _extractProperties(): void {
    if (this.type === PipeValue.CROSSLINK && this.value.includes("#")) {
      const parts = this.value.split("#", 2);
      if (parts[1] === "BRANCH") {
        this.isBranch = true;
      } else {
        this.crosslinkId = parts[1];
      }
    } else if (this.type === PipeValue.AMBIGUITY && this.value.includes("#")) {
      const parts = this.value.split("#", 2);
      this.ambiguityGroup = parts[1];
      if (this.ambiguityGroup.includes("(") && this.ambiguityGroup.includes(")")) {
        const match = this.ambiguityGroup.match(/\(([\d.]+)\)/);
        if (match) {
          this.localizationScore = parseFloat(match[1]);
        }
      }
    }

    // ProForma 2.1: Handle charged formulas (Section 11.1)
    if (this.type === PipeValue.FORMULA) {
      const chargeMatch = this.value.match(/:z([+-]\d+)$/);
      if (chargeMatch) {
        this.charge = 'z' + chargeMatch[1];
        this.chargeValue = parseInt(chargeMatch[1]);
        // Remove charge notation from value
        this.value = this.value.replace(/:z[+-]\d+$/, '');
      }
    }
  }

  /**
   * Returns a string representation of the pipe value.
   * @returns The string representation.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Gets the type of the pipe value.
   */
  get type(): string {
    return this._type;
  }

  /**
   * Sets the type of the pipe value.
   * @param value - The new type.
   */
  set type(value: string) {
    this._type = value;
    if (this.assignedTypes.length > 0) {
      this.assignedTypes[0] = value;
    } else {
      this.assignType(value);
    }
  }

  /**
   * Assigns a type to the pipe value.
   * @param value - The type to assign.
   */
  assignType(value: string): void {
    if (!this.assignedTypes.includes(value)) {
      this.assignedTypes.push(value);
    }
  }
}

/**
 * Represents the value of a modification.
 */
export class ModificationValue {
  private static KNOWN_SOURCES = new Set<string>([
    "Unimod",
    "U",
    "PSI-MOD",
    "M",
    "RESID",
    "R",
    "XL-MOD",
    "X",
    "XLMOD",
    "GNO",
    "G",
    "MOD",
    "Obs",
    "Formula",
    "FORMULA",
    "GLYCAN",
    "Glycan",
    "Info",
    "INFO",
    "OBS",
    "XL"
  ]);

  private _primaryValue: string = "";
  private _source: string | null = null;
  private _mass: number | null;
  private _pipeValues: PipeValue[] = [];

  /**
   * Initializes a ModificationValue object.
   *
   * @param value - The value of the modification.
   * @param mass - The mass of the modification.
   */
  constructor(value: string, mass: number | null = null) {
    this._mass = mass;
    this._parseValue(value);
  }

  /**
   * Validates a glycan string.
   *
   * @param glycan - The glycan string to validate.
   * @returns True if the glycan is valid, false otherwise.
   */
  static validateGlycan(glycan: string): boolean {
    return ModificationValue._validateGlycan(glycan);
  }

  /**
   * Validates a formula string.
   *
   * @param formula - The formula string to validate.
   * @returns True if the formula is valid, false otherwise.
   */
  static validateFormula(formula: string): boolean {
    return ModificationValue._validateFormula(formula);
  }

  /**
   * Gets the localization score of the modification.
   */
  get localizationScore(): number | null {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.AMBIGUITY)
      .map((pv) => pv.localizationScore)[0] || null;
  }

  /**
   * Parses the value of the modification.
   * @param value - The value to parse.
   * @private
   */
  private _parseValue(value: string): void {
    if (value.includes("|")) {
      const components = value.split("|");
      this._processPrimaryValue(components[0]);
      for (let i = 1; i < components.length; i++) {
        this._processPipeComponent(components[i]);
      }
    } else {
      this._processPrimaryValue(value);
    }
  }

  /**
   * Processes the primary value of the modification.
   * @param value - The primary value to process.
   * @private
   */
  private _processPrimaryValue(value: string): void {
    if (value === "#BRANCH") {
      this._primaryValue = "";
      const pipeVal: PipeValue = new PipeValue(value, PipeValue.BRANCH, value);
      pipeVal.isBranchRef = true;
      pipeVal.isBranch = true;
      this._pipeValues.push(pipeVal);
      return;
    } else if (value.startsWith("#")) {
      this._primaryValue = "";
      const pipeValType = value.substring(1).startsWith("XL")
        ? PipeValue.CROSSLINK
        : PipeValue.AMBIGUITY;

      const pipeVal: PipeValue = new PipeValue(value, pipeValType, value);
      pipeVal.isCrosslinkRef = pipeValType === PipeValue.CROSSLINK;
      pipeVal.isAmbiguityRef = pipeValType === PipeValue.AMBIGUITY;
      pipeVal.crosslinkId = pipeVal.isCrosslinkRef ? value.substring(1) : null;
      pipeVal.ambiguityGroup = pipeVal.isAmbiguityRef ? value.substring(1) : null;

      if (pipeVal.ambiguityGroup) {
        const scoreMatch = /\(([\d.]+)\)/.exec(pipeVal.ambiguityGroup);
        if (scoreMatch) {
          try {
            pipeVal.localizationScore = parseFloat(scoreMatch[1]);
            pipeVal.ambiguityGroup = pipeVal.ambiguityGroup.replace(scoreMatch[0], "");
          } catch (e) {
            // Parse error handling
          }
        }
      }
      this._pipeValues.push(pipeVal);
      return;
    }

    // Handle source prefix
    if (value.includes(":")) {
      // ProForma 2.1: Split only on first colon to preserve charge notation (Section 11.1)
      const firstColonIndex = value.indexOf(":");
      const parts = [value.substring(0, firstColonIndex), value.substring(firstColonIndex + 1)];
      if (ModificationValue.KNOWN_SOURCES.has(parts[0])) {
        this._source = parts[0];
        this._primaryValue = parts[1];
        let isValidGlycan = false;
        let isValidFormula = false;

        // ProForma 2.1: Extract charge notation from formula before validation (Section 11.1)
        let chargeNotation: string | null = null;
        if (this._source.toUpperCase() === "FORMULA") {
          const chargeMatch = this._primaryValue.match(/:z([+-]\d+)$/);
          if (chargeMatch) {
            chargeNotation = 'z' + chargeMatch[1];
            this._primaryValue = this._primaryValue.replace(/:z[+-]\d+$/, '');
          }
          isValidFormula = ModificationValue._validateFormula(this._primaryValue);
        } else if (this._source.toUpperCase() === "GLYCAN") {
          isValidGlycan = ModificationValue._validateGlycan(this._primaryValue);
        }

        if (this._primaryValue.includes("#")) {
          const pvParts = this._primaryValue.split("#", 2);
          this._primaryValue = pvParts[0];
          let pipeVal: PipeValue;

          if (["XL", "XLMOD", "XL-MOD", "X"].includes(this._source)) {
            pipeVal = new PipeValue(`${this._primaryValue}`, PipeValue.CROSSLINK, value);
            pipeVal.source = this._source;
            pipeVal.crosslinkId = pvParts[1];
          } else if (pvParts[1] === "BRANCH") {
            pipeVal = new PipeValue(pvParts[0], PipeValue.BRANCH);
            pipeVal.source = this._source;
            pipeVal.isBranch = true;
          } else {
            pipeVal = new PipeValue(`${this._primaryValue}`, PipeValue.AMBIGUITY, value);
            if (isValidGlycan) {
              pipeVal.isValidGlycan = isValidGlycan;
              pipeVal.assignedTypes.push("glycan");
            } else if (isValidFormula) {
              pipeVal.isValidFormula = isValidFormula;
              pipeVal.assignedTypes.push("formula");
            }

            if (this._source.toUpperCase() === "GNO" || this._source.toUpperCase() === "G") {
              pipeVal.isValidGlycan = true;
              pipeVal.assignedTypes.push("glycan");
            }

            pipeVal.source = this._source;
            pipeVal.ambiguityGroup = pvParts[1];

            const scoreMatch = /\(([\d.]+)\)/.exec(pipeVal.ambiguityGroup);
            if (scoreMatch) {
              try {
                pipeVal.localizationScore = parseFloat(scoreMatch[1]);
                pipeVal.ambiguityGroup = pipeVal.ambiguityGroup.replace(scoreMatch[0], "");
              } catch (e) {
                // Parse error handling
              }
            }
          }
          this._pipeValues.push(pipeVal);
        } else {
          let pipeVal: PipeValue;

          if (this._source.toUpperCase() === "INFO") {
            pipeVal = new PipeValue(parts[1], PipeValue.INFO_TAG, value);
          } else if (this._source.toUpperCase() === "OBS") {
            pipeVal = new PipeValue(parts[1], PipeValue.OBSERVED_MASS, value);
            pipeVal.observedMass = parseFloat(parts[1]);
          } else if (this._source.toUpperCase() === "GLYCAN") {
            pipeVal = new PipeValue(parts[1], PipeValue.GLYCAN, value);
            pipeVal.isValidGlycan = isValidGlycan;
          } else if (this._source.toUpperCase() === "GNO" || this._source.toUpperCase() === "G") {
            pipeVal = new PipeValue(parts[1], PipeValue.GAP, value);
            pipeVal.isValidGlycan = true;
          } else if (this._source.toUpperCase() === "FORMULA") {
            pipeVal = new PipeValue(this._primaryValue, PipeValue.FORMULA, value);
            pipeVal.isValidFormula = isValidFormula;

            // ProForma 2.1: Set charge notation if present (Section 11.1)
            if (chargeNotation) {
              pipeVal.charge = chargeNotation;
              pipeVal.chargeValue = parseInt(chargeNotation.substring(1));
            }
          } else {
            pipeVal = new PipeValue(parts[1], PipeValue.SYNONYM, value);
          }

          pipeVal.source = this._source;
          this._pipeValues.push(pipeVal);
        }
      } else if (parts[0].toUpperCase() === "MASS") {
        this._primaryValue = value;

        try {
          this._mass = parseFloat(parts[1]);
          const pipeVal = new PipeValue(parts[1], PipeValue.MASS, value);
          pipeVal.mass = this._mass;

          if (parts[1].includes("#")) {
            const pvParts = this._primaryValue.split("#", 2);
            this._primaryValue = pvParts[0];
            pipeVal.value = pvParts[0];

            if (pvParts[1] === "BRANCH") {
              pipeVal.isBranch = true;
              pipeVal.type = PipeValue.BRANCH;
            } else if (pvParts[1].startsWith("XL")) {
              pipeVal.crosslinkId = pvParts[1];
              pipeVal.type = PipeValue.CROSSLINK;
            } else {
              pipeVal.ambiguityGroup = pvParts[1];
              pipeVal.type = PipeValue.AMBIGUITY;

              const scoreMatch = /\(([\d.]+)\)/.exec(pipeVal.ambiguityGroup);
              if (scoreMatch) {
                try {
                  pipeVal.localizationScore = parseFloat(scoreMatch[1]);
                  pipeVal.ambiguityGroup = pipeVal.ambiguityGroup.replace(scoreMatch[0], "");
                } catch (e) {
                  // Parse error handling
                }
              }
            }
            pipeVal.assignedTypes.push(PipeValue.MASS);
          }
          this._pipeValues.push(pipeVal);
        } catch (e) {
          // Parse error handling
        }
      } else {
        this._primaryValue = value;
        const pipeVal = new PipeValue(value, PipeValue.SYNONYM, value);
        this._pipeValues.push(pipeVal);
      }
    } else {
      if (value.includes("#")) {
        const parts = value.split("#", 2);
        this._primaryValue = parts[0];
        let pipeVal: PipeValue;

        if (parts[1] === "BRANCH") {
          pipeVal = new PipeValue(`${parts[0]}`, PipeValue.BRANCH, value);
          pipeVal.isBranch = true;
        } else if (parts[1].startsWith("XL")) {
          pipeVal = new PipeValue(`${parts[0]}`, PipeValue.CROSSLINK, value);
          pipeVal.crosslinkId = parts[1];
        } else {
          pipeVal = new PipeValue(`${parts[0]}`, PipeValue.AMBIGUITY, value);
          pipeVal.ambiguityGroup = parts[1];

          const scoreMatch = /\(([\d.]+)\)/.exec(pipeVal.ambiguityGroup);
          if (scoreMatch) {
            try {
              pipeVal.localizationScore = parseFloat(scoreMatch[1]);
              pipeVal.ambiguityGroup = pipeVal.ambiguityGroup.replace(scoreMatch[0], "");
            } catch (e) {
              // Parse error handling
            }
          }
        }

        if (parts[0].startsWith("+") || parts[0].startsWith("-")) {
          try {
            this._mass = parseFloat(parts[0]);
            pipeVal.mass = this._mass;
            pipeVal.assignedTypes.push(PipeValue.MASS);
          } catch (e) {
            // Parse error handling
          }
        } else {
          pipeVal.assignedTypes.push(PipeValue.SYNONYM);
        }
        this._pipeValues.push(pipeVal);
      } else {
        this._primaryValue = value;

        if ((this._primaryValue.startsWith("+") || this._primaryValue.startsWith("-")) &&
          /\d/.test(this._primaryValue)) {
          try {
            this._mass = parseFloat(this._primaryValue);
            const pipeVal = new PipeValue(this._primaryValue, PipeValue.MASS, value);
            pipeVal.mass = this._mass;
            this._pipeValues.push(pipeVal);
          } catch (e) {
            const pipeVal = new PipeValue(value, PipeValue.SYNONYM, value);
            this._pipeValues.push(pipeVal);
          }
        } else {
          const pipeVal = new PipeValue(value, PipeValue.SYNONYM, value);
          this._pipeValues.push(pipeVal);
        }
      }
    }
  }

  /**
   * Validates a glycan string.
   * @param glycan - The glycan string to validate.
   * @returns True if the glycan is valid, false otherwise.
   * @private
   */
  private static _validateGlycan(glycan: string): boolean {
    const glycanClean = glycan.replace(/\s/g, "");
    const sortedMonos = [...monosaccharides].sort((a, b) => b.length - a.length);

    const escapedMonos = sortedMonos.map(m => m.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const monoPatternString = "(" + escapedMonos.join("|") + ")((\\((\\d+)\\))|\\d+)?";

    const monoPattern = new RegExp(monoPatternString);

    let i = 0;
    while (i < glycanClean.length) {
      if (glycanClean[i] === '{') {
        const closeBrace = glycanClean.indexOf('}', i);
        if (closeBrace === -1) {
          return false;
        }

        const formulaPart = glycanClean.substring(i + 1, closeBrace);
        if (!this._validateCustomMonosaccharide(formulaPart)) {
          return false;
        }

        i = closeBrace + 1;

        if (i < glycanClean.length && glycanClean[i] === '(') {
          const closeParen = glycanClean.indexOf(')', i);
          if (closeParen !== -1) {
            i = closeParen + 1;
          }
        } else if (i < glycanClean.length && /\d/.test(glycanClean[i])) {
          while (i < glycanClean.length && /\d/.test(glycanClean[i])) {
            i++;
          }
        }
        continue;
      }

      const match = glycanClean.substring(i).match(monoPattern);
      if (!match) {
        return false;
      }
      i += match[0].length;
    }

    return i === glycanClean.length;
  }

  /**
   * Validates a custom monosaccharide formula.
   * @param formula - The formula to validate.
   * @returns True if the formula is valid, false otherwise.
   * @private
   */
  private static _validateCustomMonosaccharide(formula: string): boolean {
    let cleanFormula = formula;

    if (cleanFormula.includes(':z')) {
      const chargeIndex = cleanFormula.lastIndexOf(':z');
      const chargeNotation = cleanFormula.substring(chargeIndex);
      if (!/^:z[+-]\d+$/.test(chargeNotation)) {
        return false;
      }
      cleanFormula = cleanFormula.substring(0, chargeIndex);
    }

    return this._validateFormula(cleanFormula);
  }

  /**
   * Validates a formula string.
   * @param formula - The formula to validate.
   * @returns True if the formula is valid, false otherwise.
   * @private
   */
  private static _validateFormula(formula: string): boolean {
    if (!formula.trim()) {
      return false;
    }

    // Check for balanced brackets
    if ((formula.match(/\[/g) || []).length !== (formula.match(/\]/g) || []).length) {
      return false;
    }

    const formulaNoSpaces = formula.replace(/\s/g, "");

    let i = 0;
    while (i < formulaNoSpaces.length) {
      if (formulaNoSpaces[i] === "[") {
        const endBracket = formulaNoSpaces.indexOf("]", i);
        if (endBracket === -1) {
          return false;
        }

        const isotopePart = formulaNoSpaces.substring(i + 1, endBracket);
        if (!isotopePart.match(/\d+[A-Z][a-z]?(-?\d+)?/)) {
          return false;
        }
        i = endBracket + 1;

        if (i < formulaNoSpaces.length &&
          (formulaNoSpaces[i] === '-' || /\d/.test(formulaNoSpaces[i]))) {
          let start = i;
          if (formulaNoSpaces[i] === '-') {
            i++;
          }
          while (i < formulaNoSpaces.length && /\d/.test(formulaNoSpaces[i])) {
            i++;
          }
          if (parseInt(formulaNoSpaces.substring(start, i)) === 0) {
            return false;
          }
        }
      }
      else if (/[A-Z]/.test(formulaNoSpaces[i])) {
        if (i + 1 < formulaNoSpaces.length && /[a-z]/.test(formulaNoSpaces[i + 1])) {
          i += 2;
        } else {
          i++;
        }

        if (i < formulaNoSpaces.length &&
          (formulaNoSpaces[i] === '-' || /\d/.test(formulaNoSpaces[i]))) {
          let start = i;
          if (formulaNoSpaces[i] === '-') {
            i++;
          }
          while (i < formulaNoSpaces.length && /\d/.test(formulaNoSpaces[i])) {
            i++;
          }
          if (parseInt(formulaNoSpaces.substring(start, i)) === 0) {
            return false;
          }
        }
      }
      else {
        // Unexpected character
        return false;
      }
    }

    return true;
  }

  /**
   * Processes a pipe component of the modification.
   * @param component - The pipe component to process.
   * @private
   */
  private _processPipeComponent(component: string): void {
    if (component === "#BRANCH") {
      const pipeVal: PipeValue = new PipeValue(component, PipeValue.BRANCH, component);
      pipeVal.isBranchRef = true;
      pipeVal.isBranch = true;
      this._pipeValues.push(pipeVal);
      return;
    } else if (component.startsWith("#")) {
      const pipeValType = component.substring(1).startsWith("XL")
        ? PipeValue.CROSSLINK
        : PipeValue.AMBIGUITY;

      const pipeVal: PipeValue = new PipeValue(component, pipeValType, component);
      pipeVal.isCrosslinkRef = pipeValType === PipeValue.CROSSLINK;
      pipeVal.isAmbiguityRef = pipeValType === PipeValue.AMBIGUITY;
      pipeVal.crosslinkId = pipeVal.isCrosslinkRef ? component.substring(1) : null;
      pipeVal.ambiguityGroup = pipeVal.isAmbiguityRef ? component.substring(1) : null;

      if (pipeVal.ambiguityGroup) {
        const scoreMatch = /\(([\d.]+)\)/.exec(pipeVal.ambiguityGroup);
        if (scoreMatch) {
          try {
            pipeVal.localizationScore = parseFloat(scoreMatch[1]);
            pipeVal.ambiguityGroup = pipeVal.ambiguityGroup.replace(scoreMatch[0], "");
          } catch (e) {
            // Parse error handling
          }
        }
      }
      this._pipeValues.push(pipeVal);
      return;
    }

    // Handle source prefix
    if (component.includes(":")) {
      const parts = component.split(":", 2);
      if (ModificationValue.KNOWN_SOURCES.has(parts[0])) {
        const source = parts[0];
        const value = parts[1];

        // Handle crosslinks or ambiguity in value
        if (value.includes("#")) {
          const pvParts = value.split("#", 2);
          const componentValue = pvParts[0];
          let isValidGlycan = false;
          let isValidFormula = false;

          if (source.toUpperCase() === "FORMULA") {
            isValidFormula = ModificationValue._validateFormula(componentValue);
          } else if (source.toUpperCase() === "GLYCAN") {
            isValidGlycan = ModificationValue._validateGlycan(componentValue);
          }

          let pipeVal: PipeValue;
          if (source === "XL" || source === "XLMOD" || source === "XL-MOD" || source === "X") {
            pipeVal = new PipeValue(componentValue, PipeValue.CROSSLINK);
            pipeVal.crosslinkId = pvParts[1];
          } else if (pvParts[1] === "BRANCH") {
            pipeVal = new PipeValue(componentValue, PipeValue.BRANCH);
            pipeVal.isBranch = true;
          } else if (source.toUpperCase() === "GLYCAN") {
            pipeVal = new PipeValue(componentValue, PipeValue.GLYCAN);
            pipeVal.isValidGlycan = isValidGlycan;
          } else if (source.toUpperCase() === "GNO" || source.toUpperCase() === "G") {
            pipeVal = new PipeValue(componentValue, PipeValue.GAP);
            pipeVal.isValidGlycan = true;
          } else if (source.toUpperCase() === "FORMULA") {
            pipeVal = new PipeValue(componentValue, PipeValue.FORMULA);
            pipeVal.isValidFormula = isValidFormula;
          } else {
            pipeVal = new PipeValue(componentValue, PipeValue.AMBIGUITY);
            pipeVal.ambiguityGroup = pvParts[1];

            const scoreMatch = /\(([\d.]+)\)/.exec(pipeVal.ambiguityGroup);
            if (scoreMatch) {
              try {
                pipeVal.localizationScore = parseFloat(scoreMatch[1]);
                pipeVal.ambiguityGroup = pipeVal.ambiguityGroup.replace(scoreMatch[0], "");
              } catch (e) {
                // Parse error handling
              }
            }
          }

          pipeVal.source = source;
          this._pipeValues.push(pipeVal);
        } else {
          let pipeVal: PipeValue;

          if (source.toUpperCase() === "INFO") {
            pipeVal = new PipeValue(value, PipeValue.INFO_TAG, component);
          } else if (source.toUpperCase() === "OBS") {
            pipeVal = new PipeValue(value, PipeValue.OBSERVED_MASS, component);
            pipeVal.observedMass = parseFloat(value);
          } else if (source.toUpperCase() === "GLYCAN") {
            pipeVal = new PipeValue(value, PipeValue.GLYCAN, component);
            pipeVal.isValidGlycan = ModificationValue._validateGlycan(value);
          } else if (source.toUpperCase() === "GNO" || source.toUpperCase() === "G") {
            pipeVal = new PipeValue(value, PipeValue.GAP, component);
            pipeVal.isValidGlycan = true;
          } else if (source.toUpperCase() === "FORMULA") {
            pipeVal = new PipeValue(value, PipeValue.FORMULA, component);
            pipeVal.isValidFormula = ModificationValue._validateFormula(value);
          } else {
            pipeVal = new PipeValue(value, PipeValue.SYNONYM, component);
          }

          pipeVal.source = source;
          this._pipeValues.push(pipeVal);
        }
      } else if (parts[0].toUpperCase() === "MASS") {
        try {
          const mass = parseFloat(parts[1]);
          const pipeVal = new PipeValue(parts[1], PipeValue.MASS, component);
          pipeVal.mass = mass;

          if (parts[1].includes("#")) {
            const hashParts = parts[1].split("#", 2);
            if (hashParts[1] === "BRANCH") {
              pipeVal.isBranch = true;
              pipeVal.type = PipeValue.BRANCH;
            } else if (hashParts[1].startsWith("XL")) {
              pipeVal.crosslinkId = hashParts[1];
              pipeVal.type = PipeValue.CROSSLINK;
            } else {
              pipeVal.ambiguityGroup = hashParts[1];
              pipeVal.type = PipeValue.AMBIGUITY;

              const scoreMatch = /\(([\d.]+)\)/.exec(pipeVal.ambiguityGroup);
              if (scoreMatch) {
                try {
                  pipeVal.localizationScore = parseFloat(scoreMatch[1]);
                  pipeVal.ambiguityGroup = pipeVal.ambiguityGroup.replace(scoreMatch[0], "");
                } catch (e) {
                  // Parse error handling
                }
              }
            }
          }
          this._pipeValues.push(pipeVal);
        } catch (e) {
          this._pipeValues.push(
            new PipeValue(component, PipeValue.SYNONYM, component)
          );
        }
      } else {
        this._pipeValues.push(
          new PipeValue(component, PipeValue.SYNONYM, component)
        );
      }
    } else {
      // Handle crosslink ID or ambiguity for values without source prefix
      if (component.includes("#")) {
        const parts = component.split("#", 2);
        const value = parts[0];
        let pipeVal: PipeValue;

        if (parts[1] === "BRANCH") {
          pipeVal = new PipeValue(value, PipeValue.BRANCH, component);
          pipeVal.isBranch = true;
        } else if (parts[1].startsWith("XL")) {
          pipeVal = new PipeValue(value, PipeValue.CROSSLINK, component);
          pipeVal.crosslinkId = parts[1];
        } else {
          pipeVal = new PipeValue(value, PipeValue.AMBIGUITY, component);
          pipeVal.ambiguityGroup = parts[1];

          const scoreMatch = /\(([\d.]+)\)/.exec(pipeVal.ambiguityGroup);
          if (scoreMatch) {
            try {
              pipeVal.localizationScore = parseFloat(scoreMatch[1]);
              pipeVal.ambiguityGroup = pipeVal.ambiguityGroup.replace(scoreMatch[0], "");
            } catch (e) {
              // Parse error handling
            }
          }
        }

        if ((value.startsWith("+") || value.startsWith("-")) && /\d/.test(value)) {
          try {
            const mass = parseFloat(value);
            pipeVal.mass = mass;
            pipeVal.assignedTypes.push(PipeValue.MASS);
          } catch (e) {
            // Parse error handling
          }
        } else {
          pipeVal.assignedTypes.push(PipeValue.SYNONYM);
        }
        this._pipeValues.push(pipeVal);
      } else {
        // Handle mass shifts
        if ((component.startsWith("+") || component.startsWith("-")) && /\d/.test(component)) {
          try {
            const mass = parseFloat(component);
            const pipeVal = new PipeValue(component, PipeValue.MASS, component);
            pipeVal.mass = mass;
            this._pipeValues.push(pipeVal);
          } catch (e) {
            this._pipeValues.push(
              new PipeValue(component, PipeValue.SYNONYM, component)
            );
          }
        } else {
          this._pipeValues.push(
            new PipeValue(component, PipeValue.SYNONYM, component)
          );
        }
      }
    }
  }

  /**
   * Gets the source of the modification.
   */
  get source(): string | null {
    return this._source;
  }

  /**
   * Gets the primary value of the modification.
   */
  get primaryValue(): string {
    return this._primaryValue;
  }

  /**
   * Gets the mass of the modification.
   */
  get mass(): number | null {
    return this._mass;
  }

  /**
   * Gets the pipe values of the modification.
   */
  get pipeValues(): PipeValue[] {
    return this._pipeValues;
  }

  /**
   * Gets the info tags of the modification.
   */
  get infoTags(): string[] {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.INFO_TAG)
      .map((pv) => pv.value);
  }

  /**
   * Gets the synonyms of the modification.
   */
  get synonyms(): string[] {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.SYNONYM)
      .map((pv) => pv.value);
  }

  /**
   * Gets the observed mass of the modification.
   */
  get observedMass(): number | null {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.OBSERVED_MASS)
      .map((pv) => pv.observedMass)[0] || null;
  }

  /**
   * Gets the ambiguity group of the modification.
   */
  get ambiguityGroup(): string | null {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.AMBIGUITY)
      .map((pv) => pv.ambiguityGroup)[0] || null;
  }

  /**
   * Checks if the modification is an ambiguity reference.
   */
  get isAmbiguityRef(): boolean {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.AMBIGUITY)
      .map((pv) => pv.isAmbiguityRef)[0] || false;
  }

  /**
   * Checks if the modification is a crosslink reference.
   */
  get isCrosslinkRef(): boolean {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.CROSSLINK)
      .map((pv) => pv.isCrosslinkRef)[0] || false;
  }

  /**
   * Checks if the modification is a branch reference.
   */
  get isBranchRef(): boolean {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.BRANCH)
      .map((pv) => pv.isBranchRef)[0] || false;
  }

  /**
   * Checks if the modification is a branch.
   */
  get isBranch(): boolean {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.BRANCH)
      .map((pv) => pv.isBranch)[0] || false;
  }

  /**
   * Gets the crosslink ID of the modification.
   */
  get crossLinkId(): string | null {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.CROSSLINK)
      .map((pv) => pv.crosslinkId)[0] || null;
  }
}

/**
 * Represents a modification to a sequence.
 */
export class Modification extends BaseBlock {
  static readonly KNOWN_SOURCES: Set<string> = new Set([
    "Unimod", "U", "PSI-MOD", "M", "RESID", "R", "XL-MOD",
    "X", "XLMOD", "GNO", "G", "MOD", "Obs", "Formula", "Glycan"
  ]);

  private _source: string | null;
  private _originalValue: string;
  private _crosslinkId: string | null;
  private _isCrosslinkRef: boolean;
  private _isBranchRef: boolean;
  private _isBranch: boolean;
  private _isAmbiguityRef: boolean;
  private _ambiguityGroup: string | null;
  private _regex: RegExp | null;
  private _modType: string;
  private _labile: boolean;
  private _labileNumber: number;
  private _fullName: string | null;
  private _allFilled: boolean;
  private _modValue: ModificationValue;
  public inRange: boolean;
  public rangeStart: number | null;
  public rangeEnd: number | null;
  public localizationScore: number | null;

  // ProForma 2.1: Ion notation (Section 11.6)
  private _isIonType: boolean;

  // ProForma 2.1: Placement controls (Section 11.2)
  private _positionConstraint: string[] | null;
  private _limitPerPosition: number | null;
  private _colocalizeKnown: boolean;
  private _colocalizeUnknown: boolean;

  /**
   * Initializes a Modification object.
   *
   * @param value - The value of the modification.
   * @param position - The position of the modification in the sequence.
   * @param regexPattern - The regex pattern for the modification.
   * @param fullName - The full name of the modification.
   * @param modType - The type of the modification.
   * @param labile - Whether the modification is labile.
   * @param labilNumber - The labile number of the modification.
   * @param mass - The mass of the modification.
   * @param allFilled - Whether all positions of the modification are filled.
   * @param crosslinkId - The crosslink ID of the modification.
   * @param isCrosslinkRef - Whether the modification is a crosslink reference.
   * @param isBranchRef - Whether the modification is a branch reference.
   * @param isBranch - Whether the modification is a branch.
   * @param ambiguityGroup - The ambiguity group of the modification.
   * @param isAmbiguityRef - Whether the modification is an ambiguity reference.
   * @param inRange - Whether the modification is in a range.
   * @param rangeStart - The start of the range.
   * @param rangeEnd - The end of the range.
   * @param localizationScore - The localization score of the modification.
   * @param modValue - The modification value.
   * @param isIonType - Whether the modification is an ion type.
   * @param positionConstraint - The position constraint of the modification.
   * @param limitPerPosition - The limit per position of the modification.
   * @param colocalizeKnown - Whether to colocalize known modifications.
   * @param colocalizeUnknown - Whether to colocalize unknown modifications.
   */
  constructor(
    value: string,
    position?: number,
    regexPattern?: string,
    fullName?: string,
    modType: string = "static",
    labile: boolean = false,
    labilNumber: number = 0,
    mass: number = 0.0,
    allFilled: boolean = false,
    crosslinkId?: string,
    isCrosslinkRef: boolean = false,
    isBranchRef: boolean = false,
    isBranch: boolean = false,
    ambiguityGroup?: string,
    isAmbiguityRef: boolean = false,
    inRange: boolean = false,
    rangeStart?: number,
    rangeEnd?: number,
    localizationScore?: number,
    modValue?: ModificationValue,
    isIonType: boolean = false,
    positionConstraint?: string[],
    limitPerPosition?: number,
    colocalizeKnown: boolean = false,
    colocalizeUnknown: boolean = false
  ) {
    // Initialize parameters for superclass
    let processedValue = value;
    if (value.startsWith("#") && isCrosslinkRef) {
      crosslinkId = value.substring(1);
      processedValue = "#" + crosslinkId;
    }

    // Call BaseBlock constructor
    super(processedValue, position, true, mass);

    // Initialize Modification specific properties
    this._source = null;
    this._originalValue = value;
    this._crosslinkId = crosslinkId || null;
    this._isCrosslinkRef = isCrosslinkRef;
    this._isBranchRef = isBranchRef;
    this._isBranch = isBranch;
    this._isAmbiguityRef = isAmbiguityRef;
    this._ambiguityGroup = ambiguityGroup || null;
    this.inRange = inRange;
    this.rangeStart = rangeStart || null;
    this.rangeEnd = rangeEnd || null;
    this.localizationScore = localizationScore || null;
    this._modValue = modValue || new ModificationValue(value, mass);

    const validModTypes = new Set([
      "static", "variable", "terminal", "ambiguous", "crosslink",
      "branch", "gap", "labile", "unknown_position", "global"
    ]);

    if ((crosslinkId || isCrosslinkRef) && modType !== "crosslink") {
      modType = "crosslink";
    }

    if (!validModTypes.has(modType)) {
      throw new Error(`mod_type must be one of: ${Array.from(validModTypes).join(', ')}`);
    }

    this._regex = regexPattern ? new RegExp(regexPattern) : null;
    this._modType = modType;
    this._labile = labile;
    this._labileNumber = labilNumber;
    this._fullName = fullName || null;
    this._allFilled = allFilled;

    // ProForma 2.1: Initialize ion type flag (Section 11.6)
    this._isIonType = isIonType;

    // ProForma 2.1: Initialize placement controls (Section 11.2)
    this._positionConstraint = positionConstraint || null;
    this._limitPerPosition = limitPerPosition || null;
    this._colocalizeKnown = colocalizeKnown;
    this._colocalizeUnknown = colocalizeUnknown;

    if (modType === "labile") {
      this._labile = true;
    }

    if (this.inRange) {
      this._modType = "ambiguous";
    }
  }

  /**
   * Gets the value of the modification.
   */
  get value(): string {
    return this._modValue?.primaryValue || super.value;
  }

  /**
   * Sets the value of the modification.
   * @param val - The new value.
   */
  set value(val: string) {
    super.value = val;
  }

  /**
   * Gets the mass of the modification.
   */
  get mass(): number {
    return this._modValue?.mass || super.mass || 0.0;
  }

  /**
   * Sets the mass of the modification.
   * @param val - The new mass.
   */
  set mass(val: number) {
    super.mass = val;
  }

  /**
   * Gets the observed mass of the modification.
   */
  get observedMass(): number | null {
    return this._modValue?.observedMass || null;
  }

  /**
   * Gets the ambiguity group of the modification.
   */
  get ambiguityGroup(): string | null {
    return this._modValue?.ambiguityGroup || this._ambiguityGroup;
  }

  /**
   * Checks if the modification is an ambiguity reference.
   */
  get isAmbiguityRef(): boolean {
    return this._modValue?.isAmbiguityRef || this._isAmbiguityRef;
  }

  /**
   * Gets the synonyms of the modification.
   */
  get synonyms(): string[] {
    return this._modValue.synonyms;
  }

  /**
   * Gets the modification value.
   */
  get modValue(): ModificationValue {
    return this._modValue;
  }

  /**
   * Sets the modification value.
   * @param val - The new modification value.
   */
  set modValue(val: ModificationValue) {
    this._modValue = val;
  }

  /**
   * Gets the info tags of the modification.
   */
  get infoTags(): string[] {
    return this._modValue.infoTags;
  }

  /**
   * Gets the crosslink ID of the modification.
   */
  get crosslinkId(): string | null {
    return this._modValue?.crossLinkId || this._crosslinkId;
  }

  /**
   * Checks if the modification is a crosslink reference.
   */
  get isCrosslinkRef(): boolean {
    return this._modValue?.isCrosslinkRef || this._isCrosslinkRef;
  }

  /**
   * Gets the source of the modification.
   */
  get source(): string | null {
    return this._modValue?.source || this._source;
  }

  /**
   * Gets the original value of the modification.
   */
  get originalValue(): string {
    return this._originalValue;
  }

  /**
   * Gets the regex pattern of the modification.
   */
  get regex(): RegExp | null {
    return this._regex;
  }

  /**
   * Gets the type of the modification.
   */
  get modType(): string {
    return this._modType;
  }

  /**
   * Checks if the modification is labile.
   */
  get labile(): boolean {
    return this._labile;
  }

  /**
   * Gets the labile number of the modification.
   */
  get labileNumber(): number {
    return this._labileNumber;
  }

  /**
   * Gets the full name of the modification.
   */
  get fullName(): string | null {
    return this._fullName;
  }

  /**
   * Checks if all positions of the modification are filled.
   */
  get allFilled(): boolean {
    return this._allFilled;
  }

  /**
   * Checks if the modification is an ion type.
   */
  get isIonType(): boolean {
    return this._isIonType;
  }

  /**
   * Gets the position constraint of the modification.
   */
  getPositionConstraint(): string[] | null {
    return this._positionConstraint;
  }

  /**
   * Gets the limit per position of the modification.
   */
  getLimitPerPosition(): number | null {
    return this._limitPerPosition;
  }

  /**
   * Checks if to colocalize known modifications.
   */
  getColocalizeKnown(): boolean {
    return this._colocalizeKnown;
  }

  /**
   * Checks if to colocalize unknown modifications.
   */
  getColocalizeUnknown(): boolean {
    return this._colocalizeUnknown;
  }

  /**
   * Finds the positions of the modification in a sequence.
   *
   * @param seq - The sequence to search in.
   * @yields The start and end positions of the modification.
   */
  *findPositions(seq: string): Generator<[number, number], void, unknown> {
    if (!this._regex) {
      throw new Error(`No regex pattern defined for modification '${this.value}'`);
    }

    let match;
    let regex = new RegExp(this._regex);
    if (!regex.global) {
      regex = new RegExp(this._regex, 'g');
    }

    while ((match = regex.exec(seq)) !== null) {
      const groups = match.length > 1 ? match.slice(1) : [];
      if (groups.length > 0) {
        for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
          if (groups[groupIdx]) {
            const start = match.index + match[0].indexOf(match[groupIdx + 1]);
            yield [start, start + match[groupIdx + 1].length];
          }
        }
      } else {
        yield [match.index, match.index + match[0].length];
      }
    }
  }

  /**
   * Converts the modification to a dictionary representation.
   * @returns A dictionary containing the modification's attributes.
   */
  toDict(): Record<string, any> {
    const baseDict = super.toDict();
    return {
      ...baseDict,
      source: this._source,
      original_value: this._originalValue,
      regex_pattern: this._regex?.source ?? null,
      full_name: this._fullName,
      mod_type: this._modType,
      labile: this._labile,
      labile_number: this._labileNumber,
      all_filled: this._allFilled,
      crosslink_id: this._crosslinkId,
      is_crosslink_ref: this._isCrosslinkRef
    };
  }

  /**
   * Checks if two modifications are equal.
   * @param other - The other modification to compare with.
   * @returns True if the modifications are equal, false otherwise.
   */
  equals(other: any): boolean {
    if (!super.equals(other)) {
      return false;
    }
    if (!(other instanceof Modification)) {
      return false;
    }
    return (
      this._modType === other.modType &&
      this._labile === other.labile &&
      this._labileNumber === other.labileNumber
    );
  }

  /**
   * Generates a hash for the modification.
   * @returns The hash code.
   */
  hashCode(): number {
    const baseHash = super.hashCode();
    return baseHash ^
      ((this._modType?.length || 0) * 17) ^
      (this._labile ? 1 : 0) ^
      this._labileNumber;
  }

  /**
   * Returns a string representation of the modification.
   * @returns The string representation.
   */
  toString(): string {
    if (this._isCrosslinkRef && this._crosslinkId) {
      return `#${this._crosslinkId}`;
    }
    if (this._isBranchRef) {
      return "#BRANCH";
    }

    let result = this._modValue.toString();
    if (this._crosslinkId && !this._isCrosslinkRef) {
      result += `#${this._crosslinkId}`;
    }
    if (this._isBranch && !this._isBranchRef) {
      result += "#BRANCH";
    }
    if (this._labile) {
      result += `${this._labileNumber}`;
    }

    return result;
  }

  /**
   * Validates a glycan string.
   *
   * @param glycan - The glycan string to validate.
   * @returns True if the glycan is valid, false otherwise.
   */
  static validateGlycan(glycan: string): boolean {
    return ModificationValue.validateGlycan(glycan);
  }

  /**
   * Validates a formula string.
   *
   * @param formula - The formula string to validate.
   * @returns True if the formula is valid, false otherwise.
   */
  static validateFormula(formula: string): boolean {
    return ModificationValue.validateFormula(formula);
  }

  /**
   * Checks if a modification is an ion type modification.
   *
   * @param modStr - The modification string to check.
   * @returns True if the modification is an ion type modification, false otherwise.
   */
  static isIonTypeModification(modStr: string): boolean {
    const modStrLower = modStr.toLowerCase();

    // Check for -type-ion suffix
    if (modStrLower.endsWith('-type-ion')) {
      return true;
    }

    // Known Unimod ion type IDs
    const ionTypeUnimodIds = new Set([
      '140',   // a-type-ion
      '2132',  // b-type-ion
      '4',     // c-type-ion
      '24',    // x-type-ion
      '2133',  // y-type-ion
      '23',    // z-type-ion
    ]);

    // Check for Unimod references (UNIMOD:id or U:id)
    if (modStr.startsWith('UNIMOD:') || modStr.startsWith('U:')) {
      const unimodId = modStr.split(':')[1];
      return ionTypeUnimodIds.has(unimodId);
    }

    return false;
  }

  /**
   * Checks if the modification is a branch reference.
   */
  get isBranchRef(): boolean {
    return this.modValue.isBranchRef || this._isBranchRef;
  }

  /**
   * Checks if the modification is a branch.
   */
  get isBranch(): boolean {
    return this.modValue.isBranch || this._isBranch;
  }

  /**
   * Converts the modification to a ProForma string.
   * @returns The ProForma string.
   */
  toProforma(): string {
    const parts: string[] = [];

    if (this.modValue) {
      const seen = new Set<string>();

      for (const pv of this.modValue.pipeValues) {
        let mod_part = "";

        if (pv.source) {
          mod_part = `${pv.source}:`;
          if (pv.mass) {
            if (pv.mass > 0) {
              mod_part += `+${pv.mass}`;
              seen.add(`+${pv.mass}`);
            } else if (pv.mass < 0) {
              mod_part += `-${pv.mass}`;
              seen.add(`${pv.mass}`);
            }
          } else {
            mod_part += `${pv.value}`;
          }

          // ProForma 2.1: Add charge notation for formulas (Section 11.1)
          if (pv.type === PipeValue.FORMULA && pv.charge) {
            mod_part += `:${pv.charge}`;
          }
        } else {
          if (pv.mass) {
            if (pv.mass > 0) {
              mod_part = `+${pv.mass}`;
            } else if (pv.mass < 0) {
              mod_part = `${pv.mass}`;
            }
          } else if (pv.type === PipeValue.SYNONYM) {
            mod_part = `${pv.value}`;
          } else {
            if (!pv.value.includes("#")) {
              mod_part = `${pv.value}`;
            }
          }
        }

        if (pv.type === PipeValue.CROSSLINK && pv.crosslinkId) {
          mod_part += `#${pv.crosslinkId}`;
        } else if (pv.type === PipeValue.BRANCH && pv.isBranch) {
          mod_part += `#BRANCH`;
        } else if (pv.type === PipeValue.AMBIGUITY && pv.ambiguityGroup) {
          const score_str = pv.localizationScore !== null ?
            `(${pv.localizationScore.toFixed(2)})` : "";
          mod_part += `#${pv.ambiguityGroup}${score_str}`;
        }

        if (seen.has(mod_part)) {
          continue;
        }

        parts.push(mod_part);
        seen.add(mod_part);
      }

      return parts.join("|");
    } else {
      if (this.mass !== null &&
        (this.value.startsWith("+") || this.value.startsWith("-"))) {
        return String(this.mass);
      }
      return this.value;
    }
  }

  /**
   * Checks if the modification has an ambiguity.
   */
  get hasAmbiguity() {
    return this.modValue.pipeValues.some(pv => pv.type === PipeValue.AMBIGUITY);
  }
}

/**
 * Represents a global modification to a sequence.
 */
export class GlobalModification extends Modification {
  targetResidues: string[] | null;
  globalModType: string;

  /**
   * Initializes a GlobalModification object.
   *
   * @param value - The value of the modification.
   * @param target_residues - The target residues of the modification.
   * @param mod_type - The type of the modification.
   * @param positionConstraint - The position constraint of the modification.
   * @param limitPerPosition - The limit per position of the modification.
   * @param colocalizeKnown - Whether to colocalize known modifications.
   * @param colocalizeUnknown - Whether to colocalize unknown modifications.
   */
  constructor(
    value: string,
    target_residues: string[] | null = null,
    mod_type: string = "isotope",
    positionConstraint?: string[],
    limitPerPosition?: number,
    colocalizeKnown: boolean = false,
    colocalizeUnknown: boolean = false
  ) {
    if (mod_type !== "isotope" && mod_type !== "fixed") {
      throw new Error("Global modification type must be 'isotope' or 'fixed'");
    }

    super(
      value,
      undefined, // position
      undefined, // regex_pattern
      undefined, // full_name
      "global", // mod_type
      false, // labile
      0, // labilNumber
      0.0, // mass
      false, // allFilled
      undefined, // crosslinkId
      false, // isCrosslinkRef
      false, // isBranchRef
      false, // isBranch
      undefined, // ambiguityGroup
      false, // isAmbiguityRef
      false, // inRange
      undefined, // rangeStart
      undefined, // rangeEnd
      undefined, // localizationScore
      undefined, // modValue
      false, // isIonType
      positionConstraint, // positionConstraint (ProForma 2.1)
      limitPerPosition, // limitPerPosition (ProForma 2.1)
      colocalizeKnown, // colocalizeKnown (ProForma 2.1)
      colocalizeUnknown // colocalizeUnknown (ProForma 2.1)
    );

    this.modValue = new ModificationValue(value)
    this.targetResidues = target_residues;
    this.globalModType = mod_type;
  }

  /**
   * Converts the modification to a ProForma string.
   * @returns The ProForma string.
   */
  toProforma(): string {
    if (this.globalModType === "isotope") {
      return `<${super.toProforma()}>`;
    } else {
      let mod_value = super.toProforma();

      // Remove brackets if present
      if (mod_value.startsWith("[") && mod_value.endsWith("]")) {
        mod_value = mod_value.substring(1, mod_value.length - 1);
      }

      // ProForma 2.1: Add placement control tags (Section 11.2)
      const tags: string[] = [];

      if (this.getPositionConstraint() && this.getPositionConstraint()!.length > 0) {
        tags.push(`Position:${this.getPositionConstraint()!.join(',')}`);
      }

      if (this.getLimitPerPosition() !== null) {
        tags.push(`Limit:${this.getLimitPerPosition()}`);
      }

      if (this.getColocalizeKnown()) {
        tags.push('CoMKP');
      }

      if (this.getColocalizeUnknown()) {
        tags.push('CoMUP');
      }

      if (tags.length > 0) {
        mod_value += '|' + tags.join('|');
      }

      const mod_str = `[${mod_value}]`;
      const targets = this.targetResidues ? this.targetResidues.join(",") : "";
      return `<${mod_str}@${targets}>`;
    }
  }

  /**
   * Returns a string representation of the modification.
   * @returns The string representation.
   */
  toString(): string {
    return this.toProforma();
  }
}

/**
 * Represents a map of modifications in a sequence.
 */
export class ModificationMap {
  seq: string;
  ignorePositions: Set<number>;
  modDictByName: Record<string, Modification> = {};
  modPositionDict: Record<string, number[]>;
  positionToMods: Map<number, Modification[]> = new Map();

  /**
   * Initializes a ModificationMap object.
   *
   * @param seq - The sequence.
   * @param mods - The modifications in the sequence.
   * @param ignore_positions - The positions to ignore in the sequence.
   * @param parse_position - Whether to parse the position of the modifications.
   * @param mod_position_dict - A dictionary of modification positions.
   */
  constructor(
    seq: string,
    mods: Modification[] = [],
    ignore_positions: Set<number> = new Set(),
    parse_position: boolean = true,
    mod_position_dict?: Record<string, number[]>
  ) {
    this.seq = seq;
    this.ignorePositions = ignore_positions;
    this.modPositionDict = mod_position_dict || {};

    this._buildMappings(mods, parse_position);
  }

  /**
   * Builds the mappings for the modifications.
   * @param mods - The modifications to build the mappings for.
   * @param parse_position - Whether to parse the position of the modifications.
   * @private
   */
  _buildMappings(mods: Modification[], parse_position: boolean): void {
    for (const mod of mods) {
      const mod_name = String(mod);
      this.modDictByName[mod_name] = mod;

      if (mod.position !== undefined && !parse_position) {
        const position = mod.position;
        if (position) {
          if (!this.positionToMods.has(position)) {
            this.positionToMods.set(position, []);
          }
          this.positionToMods.get(position)!.push(mod);

          const mod_value = mod.value;
          if (!this.modPositionDict[mod_value]) {
            this.modPositionDict[mod_value] = [];
          }
          this.modPositionDict[mod_value].push(position);
        }
      } else if (parse_position && mod.regex) {
        const positions: number[] = [];
        try {
          for (const [p_start, _] of mod.findPositions(this.seq)) {
            if (!this.ignorePositions.has(p_start)) {
              positions.push(p_start);

              if (!this.positionToMods.has(p_start)) {
                this.positionToMods.set(p_start, []);
              }
              this.positionToMods.get(p_start)!.push(mod);
            }
          }
        } catch (error) {
          // No regex pattern defined, skip position parsing
        }

        this.modPositionDict[mod_name] = positions;
      }
    }

    for (const mod_name in this.modPositionDict) {
      if (this.modPositionDict.hasOwnProperty(mod_name)) {
        this.modPositionDict[mod_name].sort((a, b) => a - b);
      }
    }
  }

  /**
   * Gets the positions of a modification.
   *
   * @param mod_name - The name of the modification.
   * @returns The positions of the modification.
   */
  getModPositions(mod_name: string): number[] | null {
    return this.modPositionDict[mod_name] || null;
  }

  /**
   * Gets a modification by name.
   *
   * @param mod_name - The name of the modification.
   * @returns The modification.
   */
  getMod(mod_name: string): Modification | null {
    return this.modDictByName[mod_name] || null;
  }

  /**
   * Gets the modifications at a specific position.
   *
   * @param position - The position to get the modifications from.
   * @returns The modifications at the specified position.
   */
  getModsAtPosition(position: number): Modification[] {
    return this.positionToMods.get(position) || [];
  }

  /**
   * Checks if a modification exists at a specific position.
   *
   * @param position - The position to check.
   * @param mod_name - The name of the modification.
   * @returns True if the modification exists at the specified position, false otherwise.
   */
  hasModAtPosition(position: number, mod_name?: string): boolean {
    const mods = this.getModsAtPosition(position);
    if (!mods.length) {
      return false;
    }
    if (mod_name === undefined) {
      return true;
    }
    return mods.some(mod => String(mod) === mod_name);
  }

  /**
   * Converts the modification map to a dictionary representation.
   * @returns A dictionary containing the modification map's attributes.
   */
  toDict(): Record<string, any> {
    return {
      sequence: this.seq,
      ignore_positions: Array.from(this.ignorePositions),
      position_to_mods: Object.fromEntries(
        Array.from(this.positionToMods.entries())
          .map(([pos, mods]) => [
            pos.toString(),
            mods.map(mod => mod.toDict())
          ])
      )
    };
  }
}