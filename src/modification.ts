import {monosaccharides} from "./resources";
import {BaseBlock} from "./base_block";

class PipeValue {
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

  constructor(value: string, valueType: string, originalValue: string | null = null) {
    this.value = value;
    this._type = valueType;
    this.originalValue = originalValue;
    this._extractProperties();
  }

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
  }

  toString(): string {
    return this.value;
  }

  get type(): string {
    return this._type;
  }

  set type(value: string) {
    this._type = value;
    if (this.assignedTypes.length > 0) {
      this.assignedTypes[0] = value;
    } else {
      this.assignType(value);
    }
  }

  assignType(value: string): void {
    if (!this.assignedTypes.includes(value)) {
      this.assignedTypes.push(value);
    }
  }
}

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

  constructor(value: string, mass: number | null = null) {
    this._mass = mass;
    this._parseValue(value);
  }

  static validateGlycan(glycan: string): boolean {
    return ModificationValue._validateGlycan(glycan);
  }

  static validateFormula(formula: string): boolean {
    return ModificationValue._validateFormula(formula);
  }

  get localizationScore(): number | null {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.AMBIGUITY)
      .map((pv) => pv.localizationScore)[0] || null;
  }

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
      const parts = value.split(":", 2);
      if (ModificationValue.KNOWN_SOURCES.has(parts[0])) {
        this._source = parts[0];
        this._primaryValue = parts[1];
        let isValidGlycan = false;
        let isValidFormula = false;

        if (this._source.toUpperCase() === "FORMULA") {
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
            pipeVal = new PipeValue(parts[1], PipeValue.FORMULA, value);
            pipeVal.isValidFormula = isValidFormula;
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
  private static _validateGlycan(glycan: string): boolean {
    const glycanClean = glycan.replace(/\s/g, "");
    const sortedMonos = [...monosaccharides].sort((a, b) => b.length - a.length);

    const escapedMonos = sortedMonos.map(m => m.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const monoPatternString = "(" + escapedMonos.join("|") + ")(\\((\\d+)\\))?";

    const monoPattern = new RegExp(monoPatternString);

    let i = 0;
    while (i < glycanClean.length) {
      const match = glycanClean.substring(i).match(monoPattern);
      if (!match) {
        return false;
      }
      i += match[0].length;
    }

    return i === glycanClean.length;
  }

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

  get source(): string | null {
    return this._source;
  }

  get primaryValue(): string {
    return this._primaryValue;
  }

  get mass(): number | null {
    return this._mass;
  }

  get pipeValues(): PipeValue[] {
    return this._pipeValues;
  }
  get infoTags(): string[] {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.INFO_TAG)
      .map((pv) => pv.value);
  }
  get synonyms(): string[] {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.SYNONYM)
      .map((pv) => pv.value);
  }
  get observedMass(): number | null {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.OBSERVED_MASS)
      .map((pv) => pv.observedMass)[0] || null;
  }
  get ambiguityGroup(): string | null {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.AMBIGUITY)
      .map((pv) => pv.ambiguityGroup)[0] || null;
  }
  get isAmbiguityRef(): boolean {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.AMBIGUITY)
      .map((pv) => pv.isAmbiguityRef)[0] || false;
  }
  get isCrosslinkRef(): boolean {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.CROSSLINK)
      .map((pv) => pv.isCrosslinkRef)[0] || false;
  }
  get isBranchRef(): boolean {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.BRANCH)
      .map((pv) => pv.isBranchRef)[0] || false;
  }
  get isBranch(): boolean {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.BRANCH)
      .map((pv) => pv.isBranch)[0] || false;
  }
  get crossLinkId(): string | null {
    return this._pipeValues
      .filter((pv) => pv.type === PipeValue.CROSSLINK)
      .map((pv) => pv.crosslinkId)[0] || null;
  }
}

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
    modValue?: ModificationValue
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

    if (modType === "labile") {
      this._labile = true;
    }

    if (this.inRange) {
      this._modType = "ambiguous";
    }
  }

  get value(): string {
    return this._modValue?.primaryValue || super.value;
  }

  set value(val: string) {
    super.value = val;
  }

  get mass(): number {
    return this._modValue?.mass || super.mass || 0.0;
  }

  set mass(val: number) {
    super.mass = val;
  }

  get observedMass(): number | null {
    return this._modValue?.observedMass || null;
  }

  get ambiguityGroup(): string | null {
    return this._modValue?.ambiguityGroup || this._ambiguityGroup;
  }

  get isAmbiguityRef(): boolean {
    return this._modValue?.isAmbiguityRef || this._isAmbiguityRef;
  }

  get synonyms(): string[] {
    return this._modValue.synonyms;
  }

  get modValue(): ModificationValue {
    return this._modValue;
  }
  set modValue(val: ModificationValue) {
    this._modValue = val;
  }

  get infoTags(): string[] {
    return this._modValue.infoTags;
  }

  get crosslinkId(): string | null {
    return this._modValue?.crossLinkId || this._crosslinkId;
  }

  get isCrosslinkRef(): boolean {
    return this._modValue?.isCrosslinkRef || this._isCrosslinkRef;
  }

  get source(): string | null {
    return this._modValue?.source || this._source;
  }

  get originalValue(): string {
    return this._originalValue;
  }

  get regex(): RegExp | null {
    return this._regex;
  }

  get modType(): string {
    return this._modType;
  }

  get labile(): boolean {
    return this._labile;
  }

  get labileNumber(): number {
    return this._labileNumber;
  }

  get fullName(): string | null {
    return this._fullName;
  }

  get allFilled(): boolean {
    return this._allFilled;
  }

  // Methods
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

  hashCode(): number {
    const baseHash = super.hashCode();
    return baseHash ^
      ((this._modType?.length || 0) * 17) ^
      (this._labile ? 1 : 0) ^
      this._labileNumber;
  }

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

  static validateGlycan(glycan: string): boolean {
    return ModificationValue.validateGlycan(glycan);
  }
  static validateFormula(formula: string): boolean {
    return ModificationValue.validateFormula(formula);
  }

  get isBranchRef(): boolean {
    return this.modValue.isBranchRef || this._isBranchRef;
  }

  get isBranch(): boolean {
    return this.modValue.isBranch || this._isBranch;
  }


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

  get hasAmbiguity() {
    return this.modValue.pipeValues.some(pv => pv.type === PipeValue.AMBIGUITY);
  }
}

export class GlobalModification extends Modification {
  targetResidues: string[] | null;
  globalModType: string;

  constructor(
    value: string,
    target_residues: string[] | null = null,
    mod_type: string = "isotope"
  ) {
    if (mod_type !== "isotope" && mod_type !== "fixed") {
      throw new Error("Global modification type must be 'isotope' or 'fixed'");
    }

    super(
      value,
      undefined, // position
      undefined, // regex_pattern
      undefined, // full_name
      "global" // mod_type
    );

    this.modValue = new ModificationValue(value)
    this.targetResidues = target_residues;
    this.globalModType = mod_type;
  }


  toProforma(): string {
    if (this.globalModType === "isotope") {
      return `<${super.toProforma()}>`;
    } else {
      const mod_value = super.toProforma();
      let mod_str: string;

      if (!mod_value.startsWith("[")) {
        mod_str = `[${mod_value}]`;
      } else {
        mod_str = mod_value;
      }

      const targets = this.targetResidues ? this.targetResidues.join(",") : "";
      return `<${mod_str}@${targets}>`;
    }
  }

  toString(): string {
    return this.toProforma();
  }
}

export class ModificationMap {
  seq: string;
  ignorePositions: Set<number>;
  modDictByName: Record<string, Modification> = {};
  modPositionDict: Record<string, number[]>;
  positionToMods: Map<number, Modification[]> = new Map();

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

  getModPositions(mod_name: string): number[] | null {
    return this.modPositionDict[mod_name] || null;
  }

  getMod(mod_name: string): Modification | null {
    return this.modDictByName[mod_name] || null;
  }

  getModsAtPosition(position: number): Modification[] {
    return this.positionToMods.get(position) || [];
  }

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