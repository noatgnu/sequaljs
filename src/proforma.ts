import { GlobalModification, Modification, ModificationValue } from './modification';

// Matches a global isotope token, e.g. D, T, 13C, 15N.
const ISOTOPE_PATTERN = /^(?:[Dd]|[Tt]|\d+[A-Z][a-z]?)$/;

/**
 * Represents a sequence ambiguity in a ProForma string.
 */
export class SequenceAmbiguity {
  value: string;
  position: number;

  /**
   * Initializes a SequenceAmbiguity object.
   *
   * @param value - The value of the sequence ambiguity.
   * @param position - The position of the sequence ambiguity.
   */
  constructor(value: string, position: number) {
    this.value = value;
    this.position = position;
  }

  /**
   * Returns a string representation of the sequence ambiguity.
   * @returns The string representation.
   */
  toString(): string {
    return `SequenceAmbiguity(value='${this.value}', position=${this.position})`;
  }
}



/**
 * A parser for ProForma 2.1 strings.
 */
export class ProFormaParser {
  static readonly MASS_SHIFT_PATTERN = /^[+-]\d+(\.\d+)?$/;
  //static readonly TERMINAL_PATTERN = /^(\[([^\]]+)\])+-(.*)-(\[([^\]]+)\])+$/;
  //static readonly N_TERMINAL_PATTERN = /^(\[([^\]]+)\])+-(.*)$/;
  //static readonly C_TERMINAL_PATTERN = /^(.*)-(\[([^\]]+)\])+$/;
  static readonly CROSSLINK_PATTERN = /^([^#]+)#(XL[A-Za-z0-9]+)$/;
  static readonly CROSSLINK_REF_PATTERN = /^#(XL[A-Za-z0-9]+)$/;
  static readonly BRANCH_PATTERN = /^([^#]+)#BRANCH$/;
  static readonly BRANCH_REF_PATTERN = /^#BRANCH$/;
  //static readonly UNKNOWN_POSITION_PATTERN = /(\[([^\]]+)\])(\^(\d+))?(\?)/;

  /**
   * Parses a ProForma string.
   *
   * @param proformaStr - The ProForma string to parse.
   * @returns A tuple containing the base sequence, modifications, global modifications, sequence ambiguities, charge information, peptidoform name, peptidoform ion name, and compound ion name.
   */
  static parse(proformaStr: string): [string, Record<number, Modification[]>, GlobalModification[], SequenceAmbiguity[], [number | null, string | null], string | null, string | null, string | null] {
    let baseSequence = "";
    const modifications: Record<number, Modification[]> = {};
    const globalMods: GlobalModification[] = [];
    const sequenceAmbiguities: SequenceAmbiguity[] = [];

    // ProForma 2.1: Parse naming notations (Section 8.2)
    let peptidoformName: string | null = null;
    let peptidoformIonName: string | null = null;
    let compoundIonName: string | null = null;

    // Extract compound ion name (>>>name)
    if (proformaStr.startsWith("(>>>")) {
      const endParen = this._findBalancedParen(proformaStr, 0);
      if (endParen === -1) {
        throw new Error("Unclosed compound ion name parenthesis");
      }
      compoundIonName = proformaStr.substring(4, endParen);
      proformaStr = proformaStr.substring(endParen + 1);
    }

    // Extract peptidoform ion name (>>name)
    if (proformaStr.startsWith("(>>")) {
      const endParen = this._findBalancedParen(proformaStr, 0);
      if (endParen === -1) {
        throw new Error("Unclosed peptidoform ion name parenthesis");
      }
      peptidoformIonName = proformaStr.substring(3, endParen);
      proformaStr = proformaStr.substring(endParen + 1);
    }

    // Extract peptidoform name (>name)
    if (proformaStr.startsWith("(>")) {
      const endParen = this._findBalancedParen(proformaStr, 0);
      if (endParen === -1) {
        throw new Error("Unclosed peptidoform name parenthesis");
      }
      peptidoformName = proformaStr.substring(2, endParen);
      proformaStr = proformaStr.substring(endParen + 1);
    }

    const getModsAtPosition = (pos: number): Modification[] => {
      if (!modifications[pos]) {
        modifications[pos] = [];
      }
      return modifications[pos];
    };

    while (proformaStr.startsWith("<")) {
      let endBracket: number;

      if (proformaStr.startsWith("<[")) {
        const closingBracket = proformaStr.indexOf("]", 2);
        if (closingBracket === -1) {
          throw new Error("Unclosed square bracket in global modification");
        }
        endBracket = proformaStr.indexOf(">", closingBracket);
      } else {
        endBracket = proformaStr.indexOf(">");
      }

      if (endBracket === -1) {
        throw new Error("Unclosed global modification angle bracket");
      }

      const globalModStr = proformaStr.substring(1, endBracket);
      proformaStr = proformaStr.substring(endBracket + 1);

      if (globalModStr.includes("@")) {
        // Fixed protein modification
        const [modPart, targets] = globalModStr.split("@");
        let modValue = modPart;

        if (modPart.startsWith("[") && modPart.endsWith("]")) {
          modValue = modPart.substring(1, modPart.length - 1);  // Remove brackets
        }

        if (modValue.includes("#")) {
          throw new Error("Fixed global modifications cannot be ambiguous, cross-linked, or branched");
        }

        // ProForma 2.1: Parse placement control tags (Section 11.2)
        let positionConstraint: string[] | undefined;
        let limitPerPosition: number | undefined;
        let colocalizeKnown = false;
        let colocalizeUnknown = false;

        if (modValue.includes('|')) {
          const modParts = modValue.split('|');
          const nonPlacementParts: string[] = [modParts[0]]; // First part is always the modification name

          // Parse control tags and keep non-placement parts
          for (let i = 1; i < modParts.length; i++) {
            const part = modParts[i];

            if (part.startsWith('Position:')) {
              positionConstraint = part.substring(9).split(',');
            } else if (part.startsWith('Limit:')) {
              limitPerPosition = parseInt(part.substring(6));
            } else if (part === 'CoMKP' || part === 'ColocaliseModificationsOfKnownPosition') {
              colocalizeKnown = true;
            } else if (part === 'CoMUP' || part === 'ColocaliseModificationsOfUnknownPosition') {
              colocalizeUnknown = true;
            } else {
              // Not a placement control tag, keep it for ModificationValue
              nonPlacementParts.push(part);
            }
          }

          // Reconstruct modValue with non-placement parts only
          modValue = nonPlacementParts.join('|');
        }

        const targetResidues = targets.split(",");
        globalMods.push(
          new GlobalModification(
            modValue,
            targetResidues,
            "fixed",
            positionConstraint,
            limitPerPosition,
            colocalizeKnown,
            colocalizeUnknown
          )
        );
      } else {
        // Isotope labeling: must be D, T, or an isotope number followed by an element symbol
        // (an optional "|INFO:..." suffix is allowed and not part of the isotope token itself).
        const isotopeToken = globalModStr.split("|")[0];
        if (!ISOTOPE_PATTERN.test(isotopeToken)) {
          throw new Error(`Invalid global isotope modification '${isotopeToken}'`);
        }
        globalMods.push(new GlobalModification(globalModStr, null, "isotope"));
      }
    }

    if (proformaStr.includes("?")) {
      let i = 0;
      const unknownPosMods: string[] = [];
      while (i < proformaStr.length) {
        if (proformaStr[i] !== "[") {
          if (
            unknownPosMods.length > 0 &&
            i < proformaStr.length &&
            proformaStr[i] === "?"
          ) {
            for (const modStr of unknownPosMods) {
              const mod = ProFormaParser._createModification(
                modStr,
                { isUnknownPosition: true }
              );
              getModsAtPosition(-4).push(mod);
            }
            i += 1;
          } else {
            // No '?' terminator: not actually an unknown-position block, leave string as-is.
            i = 0;
          }
          unknownPosMods.length = 0;
          break;
        }

        let bracketCount = 1;
        let j = i + 1;
        while (j < proformaStr.length && bracketCount > 0) {
          if (proformaStr[j] === "[") {
            bracketCount += 1;
          } else if (proformaStr[j] === "]") {
            bracketCount -= 1;
          }
          j += 1;
        }

        if (bracketCount > 0) {
          throw new Error(`Unclosed bracket at position ${i}`);
        }

        const modStr = proformaStr.substring(i + 1, j - 1);

        let count = 1;
        if (j < proformaStr.length && proformaStr[j] === "^") {
          j += 1;
          const numStart = j;
          while (j < proformaStr.length && /\d/.test(proformaStr[j])) {
            j += 1;
          }
          if (j > numStart) {
            count = parseInt(proformaStr.substring(numStart, j));
          }
        }

        for (let k = 0; k < count; k++) {
          unknownPosMods.push(modStr);
        }
        i = j;
      }
      proformaStr = proformaStr.substring(i);
    }

    let i = 0;
    while (i < proformaStr.length && proformaStr[i] === "{") {
      const j = this._findBalancedCurlyBrace(proformaStr, i);
      if (j === -1) {
        throw new Error(`Unclosed curly brace at position ${i}`);
      }

      const modStr = proformaStr.substring(i + 1, j);

      const mod = ProFormaParser._createModification(
        modStr,
        { isLabile: true }
      );
      getModsAtPosition(-3).push(mod);
      i = j + 1;
    }

    proformaStr = proformaStr.substring(i);

    if (proformaStr.startsWith('[')) {
      let bracketLevel = 0;
      let terminatorPos = -1;

      // Find the terminal hyphen that's outside all brackets
      for (let i = 0; i < proformaStr.length; i++) {
        if (proformaStr[i] === '[') bracketLevel++;
        else if (proformaStr[i] === ']') bracketLevel--;
        else if (proformaStr[i] === '-' && bracketLevel === 0) {
          terminatorPos = i;
          break;
        }
      }

      if (terminatorPos !== -1) {
        const nTerminalPart = proformaStr.substring(0, terminatorPos);
        proformaStr = proformaStr.substring(terminatorPos + 1);

        // Parse N-terminal modifications
        let currentPos = 0;
        while (currentPos < nTerminalPart.length) {
          if (nTerminalPart[currentPos] === '[') {
            let bracketDepth = 1;
            let endPos = currentPos + 1;

            // Find matching closing bracket
            while (endPos < nTerminalPart.length && bracketDepth > 0) {
              if (nTerminalPart[endPos] === '[') bracketDepth++;
              if (nTerminalPart[endPos] === ']') bracketDepth--;
              endPos++;
            }

            if (bracketDepth === 0) {
              const modString = nTerminalPart.substring(currentPos + 1, endPos - 1);
              const nTermMod = ProFormaParser._createBracketModification(modString, { isTerminal: true });
              getModsAtPosition(-1).push(nTermMod);
            }

            currentPos = endPos;
          } else {
            currentPos++;
          }
        }
      }
    }

    const chargeInfo = ProFormaParser.parseChargeInfo(proformaStr);

    proformaStr = chargeInfo[0]


    if (proformaStr.includes('-')) {
      let bracketLevel = 0;
      let terminatorPos = -1;

      // Find the terminal hyphen that's outside all brackets, scanning from right to left
      for (let i = proformaStr.length - 1; i >= 0; i--) {
        // When scanning backward, we need to check closing bracket first, then opening
        if (proformaStr[i] === ']') bracketLevel++;
        else if (proformaStr[i] === '[') bracketLevel--;
        else if (proformaStr[i] === '-' && bracketLevel === 0) {
          terminatorPos = i;
          break;
        }
      }

      if (terminatorPos !== -1) {
        const cTerminalPart = proformaStr.substring(terminatorPos + 1);
        if (cTerminalPart === "") {
          throw new Error("Dangling C-terminal separator with no modification");
        }
        proformaStr = proformaStr.substring(0, terminatorPos);

        // Parse C-terminal modifications
        let currentPos = 0;
        while (currentPos < cTerminalPart.length) {
          if (cTerminalPart[currentPos] === '[') {
            let bracketDepth = 1;
            let endPos = currentPos + 1;

            // Find matching closing bracket
            while (endPos < cTerminalPart.length && bracketDepth > 0) {
              if (cTerminalPart[endPos] === '[') bracketDepth++;
              if (cTerminalPart[endPos] === ']') bracketDepth--;
              endPos++;
            }

            if (bracketDepth === 0) {
              const modString = cTerminalPart.substring(currentPos + 1, endPos - 1);
              const cTermMod = ProFormaParser._createBracketModification(modString, { isTerminal: true });
              getModsAtPosition(-2).push(cTermMod);
            }

            currentPos = endPos;
          } else {
            currentPos++;
          }
        }
      }
    }

    i = 0;
    let nextModIsGap = false;
    const rangeStack: number[] = [];

    while (i < proformaStr.length) {
      const char = proformaStr[i];

      if (i + 1 < proformaStr.length && proformaStr.substring(i, i + 2) === "(?") {
        if (rangeStack.length > 0) {
          throw new Error("Sequence ambiguity must not overlap with a range modification");
        }
        const closingParen = proformaStr.indexOf(")", i + 2);
        if (closingParen === -1) {
          throw new Error("Unclosed sequence ambiguity parenthesis");
        }

        const ambiguousSeq = proformaStr.substring(i + 2, closingParen);
        sequenceAmbiguities.push(
          new SequenceAmbiguity(ambiguousSeq, baseSequence.length)
        );

        // Skip past the ambiguity notation
        i = closingParen + 1;
        continue;
      }

      if (char === "(") {
        // Start of a range
        if (rangeStack.length > 0) {
          throw new Error("Overlapping range modifications are not supported");
        }
        rangeStack.push(baseSequence.length);
        i += 1;
        continue;
      }
      else if (char === ")") {
        // End of a range
        if (!rangeStack.length) {
          throw new Error("Unmatched closing parenthesis");
        }

        const rangeStart = rangeStack.pop()!;
        const rangeEnd = baseSequence.length - 1;

        if (rangeEnd < rangeStart) {
          throw new Error("Empty range group '()' is not valid");
        }

        // Look for modification after the range
        let j = i + 1;
        while (j < proformaStr.length && proformaStr[j] === "[") {
          // Extract the modification that applies to the range
          const modStart = j;
          let bracketCount = 1;
          j += 1;

          while (j < proformaStr.length && bracketCount > 0) {
            if (proformaStr[j] === "[") {
              bracketCount += 1;
            } else if (proformaStr[j] === "]") {
              bracketCount -= 1;
            }
            j += 1;
          }

          if (bracketCount === 0) {
            const modStr = proformaStr.substring(modStart + 1, j - 1);
            const mod = ProFormaParser._createModification(
              modStr,
              {
                inRange: true,
                rangeStart: rangeStart,
                rangeEnd: rangeEnd
              }
            );

            for (let pos = mod.rangeStart!; pos <= mod.rangeEnd!; pos++) {
              getModsAtPosition(pos).push(mod);
            }
          }
        }

        i = j;

      }
      else if (char === "[") {
        let bracketCount = 1;
        let j = i + 1;
        while (j < proformaStr.length && bracketCount > 0) {
          if (proformaStr[j] === "[") {
            bracketCount += 1;
          } else if (proformaStr[j] === "]") {
            bracketCount -= 1;
          }
          j += 1;
        }

        if (bracketCount > 0) {
          throw new Error(`Unclosed square bracket at position ${i}`);
        }
        j -= 1;
        if (j === -1) {
          throw new Error(`Unclosed square bracket at position ${i}`);
        }

        const modStr = proformaStr.substring(i + 1, j);
        let mod: Modification;

        if (nextModIsGap) {
          mod = ProFormaParser._createModification(modStr, { isGap: true });
          nextModIsGap = false;
        }
        // Check if this is a crosslink reference
        else if (ProFormaParser.CROSSLINK_REF_PATTERN.test(modStr)) {
          mod = ProFormaParser._createModification(modStr, { isCrosslinkRef: true });
        }
        else if (ProFormaParser.BRANCH_REF_PATTERN.test(modStr)) {
          mod = ProFormaParser._createModification(modStr, { isBranchRef: true });
        }
        else {
          const crosslinkMatch = ProFormaParser.CROSSLINK_PATTERN.exec(modStr);
          const branchMatch = ProFormaParser.BRANCH_PATTERN.exec(modStr);

          if (crosslinkMatch) {
            const [, modBase, crosslinkId] = crosslinkMatch;
            mod = ProFormaParser._createModification(modStr, { crosslinkId });
          }
          else if (branchMatch) {
            const modBase = branchMatch[1];
            mod = ProFormaParser._createModification(modStr, { isBranch: true });
          }
          else {
            mod = ProFormaParser._createModification(modStr);
          }
        }

        if (baseSequence) {
          getModsAtPosition(baseSequence.length - 1).push(mod);
        }

        i = j + 1;
      }
      else if (char === "{") {
        const j = proformaStr.indexOf("}", i);
        if (j === -1) {
          throw new Error(`Unclosed curly brace at position ${i}`);
        }

        const modStr = proformaStr.substring(i + 1, j);
        const mod = ProFormaParser._createModification(modStr, { isAmbiguous: true });

        if (baseSequence) {
          getModsAtPosition(baseSequence.length - 1).push(mod);
        }

        i = j + 1;
      }
      else {
        baseSequence += char;
        const isGap = (
          char === "X" &&
          i + 1 < proformaStr.length &&
          proformaStr[i + 1] === "["
        );
        if (isGap) {
          nextModIsGap = true;
        }
        i += 1;
      }
    }

    return [baseSequence, modifications, globalMods, sequenceAmbiguities, [chargeInfo[1], chargeInfo[2]], peptidoformName, peptidoformIonName, compoundIonName];
  }

  /**
   * Finds the matching closing parenthesis for an opening parenthesis at a given position.
   *
   * @param str - The string to search in.
   * @param startPos - The position of the opening parenthesis.
   * @returns The position of the matching closing parenthesis, or -1 if not found.
   * @private
   */
  static _findBalancedParen(str: string, startPos: number): number {
    let depth = 0;
    for (let i = startPos; i < str.length; i++) {
      if (str[i] === '(') {
        depth++;
      } else if (str[i] === ')') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Finds the matching closing angle bracket for an opening angle bracket at a given position.
   *
   * @param str - The string to search in.
   * @param startPos - The position of the opening angle bracket.
   * @returns The position of the matching closing angle bracket, or -1 if not found.
   * @private
   */
  static _findBalancedAngleBracket(str: string, startPos: number): number {
    let depth = 0;
    for (let i = startPos; i < str.length; i++) {
      if (str[i] === '<') {
        depth++;
      } else if (str[i] === '>') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Finds the matching closing curly brace for an opening curly brace at a given position.
   *
   * @param str - The string to search in.
   * @param startPos - The position of the opening curly brace.
   * @returns The position of the matching closing curly brace, or -1 if not found.
   * @private
   */
  static _findBalancedCurlyBrace(str: string, startPos: number): number {
    let depth = 0;
    for (let i = startPos; i < str.length; i++) {
      if (str[i] === '{') {
        depth++;
      } else if (str[i] === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Creates a modification, detecting crosslink/branch reference-or-definition shape first
   * (e.g. "#XL1", "Foo#XL1", "#BRANCH", "Foo#BRANCH") so callers outside the main sequence loop
   * (N-terminal/C-terminal mods) classify these the same way residue-level mods do.
   */
  static _createBracketModification(
    modStr: string,
    extraOptions: { isTerminal?: boolean; isLabile?: boolean; isAmbiguous?: boolean } = {}
  ): Modification {
    if (ProFormaParser.CROSSLINK_REF_PATTERN.test(modStr)) {
      return ProFormaParser._createModification(modStr, { ...extraOptions, isCrosslinkRef: true });
    }
    if (ProFormaParser.BRANCH_REF_PATTERN.test(modStr)) {
      return ProFormaParser._createModification(modStr, { ...extraOptions, isBranchRef: true });
    }
    const crosslinkMatch = ProFormaParser.CROSSLINK_PATTERN.exec(modStr);
    if (crosslinkMatch) {
      return ProFormaParser._createModification(modStr, { ...extraOptions, crosslinkId: crosslinkMatch[2] });
    }
    if (ProFormaParser.BRANCH_PATTERN.test(modStr)) {
      return ProFormaParser._createModification(modStr, { ...extraOptions, isBranch: true });
    }
    return ProFormaParser._createModification(modStr, extraOptions);
  }

  /**
   * Creates a modification object from a modification string.
   *
   * @param modStr - The modification string.
   * @param options - The options for creating the modification.
   * @returns The modification object.
   * @private
   */
  static _createModification(
    modStr: string,
    options: {
      isTerminal?: boolean;
      isAmbiguous?: boolean;
      isLabile?: boolean;
      isUnknownPosition?: boolean;
      crosslinkId?: string;
      isCrosslinkRef?: boolean;
      isBranch?: boolean;
      isBranchRef?: boolean;
      isGap?: boolean;
      inRange?: boolean;
      rangeStart?: number;
      rangeEnd?: number;
    } = {}
  ): Modification {
    const {
      isTerminal = false,
      isAmbiguous = false,
      isLabile = false,
      isUnknownPosition = false,
      crosslinkId = undefined,
      isCrosslinkRef = false,
      isBranch = false,
      isBranchRef = false,
      isGap = false,
      inRange = false,
      rangeStart = undefined,
      rangeEnd = undefined
    } = options;

    const modValue = new ModificationValue(modStr);
    let modType = "static";

    // ProForma 2.1: Detect ion type modifications (Section 11.6)
    const isIonType = Modification.isIonTypeModification(modStr);

    if (isTerminal) {
      modType = "terminal";
    } else if (isAmbiguous) {
      modType = "ambiguous";
    } else if (isLabile) {
      modType = "labile";
    } else if (isUnknownPosition) {
      modType = "unknown_position";
    } else if (crosslinkId || isCrosslinkRef) {
      modType = "crosslink";
    } else if (isBranch || isBranchRef) {
      modType = "branch";
    } else if (isGap) {
      modType = "gap";
    }

    const ambiguityMatch = /(.+?)#([A-Za-z0-9]+)(?:\(([0-9.]+)\))?$/.exec(modStr);
    const ambiguityRefMatch = /#([A-Za-z0-9]+)(?:\(([0-9.]+)\))?$/.exec(modStr);
    let ambiguityGroup = undefined;
    let localizationScore = undefined;
    let isAmbiguityRef = false;

    if (ProFormaParser.MASS_SHIFT_PATTERN.test(modStr) && !modStr.includes("#")) {
      const massValue = parseFloat(modStr);
      if (isGap) {
        return new Modification(
          modStr,        // value
          undefined,     // position
          undefined,     // regexPattern
          undefined,     // fullName
          "gap",         // modType
          false,         // labile
          0,             // labilNumber
          massValue,     // mass
          false,         // allFilled
          undefined,     // crosslinkId
          false,         // isCrosslinkRef
          false,         // isBranchRef
          false,         // isBranch
          undefined,     // ambiguityGroup
          false,         // isAmbiguityRef
          inRange,       // inRange
          rangeStart,    // rangeStart
          rangeEnd,      // rangeEnd
          undefined,     // localizationScore
          modValue,      // modValue
          isIonType      // isIonType (ProForma 2.1)
        );
      } else if (inRange) {
        return new Modification(
          modStr,
          undefined,
          undefined,
          undefined,
          "variable",
          false,
          0,
          massValue,
          false,
          undefined,
          false,
          false,
          false,
          undefined,
          false,
          true,
          rangeStart,
          rangeEnd,
          undefined,
          modValue,
          isIonType      // isIonType (ProForma 2.1)
        );
      }
      return new Modification(
        `Mass:${modStr}`,
        undefined,
        undefined,
        undefined,
        "static",
        false,
        0,
        massValue,
        false,
        undefined,
        false,
        false,
        false,
        undefined,
        false,
        inRange,
        rangeStart,
        rangeEnd,
        undefined,
        modValue,
        isIonType      // isIonType (ProForma 2.1)
      );
    }

    if (
      modStr.includes("#") &&
      !isCrosslinkRef &&
      !isBranch &&
      !isBranchRef &&
      !crosslinkId
    ) {
      if (ambiguityMatch && !ambiguityMatch[2].startsWith("XL")) {
        modStr = ambiguityMatch[1];
        ambiguityGroup = ambiguityMatch[2];
        if (ambiguityMatch[3]) {  // Score is present
          localizationScore = parseFloat(ambiguityMatch[3]);
        }

        // ProForma 2.1: Re-detect ion type after stripping ambiguity (Section 11.6)
        const isIonTypeAfterStrip = Modification.isIonTypeModification(modStr);

        // A labile modification keeps its "labile" type even with a location label (spec 7.9);
        // everything else defaults to "ambiguous" as before.
        return new Modification(
          modStr,
          undefined,
          undefined,
          undefined,
          isLabile ? "labile" : "ambiguous",
          isLabile,
          0,
          0.0,
          false,
          undefined,
          false,
          false,
          false,
          ambiguityGroup,
          false,
          inRange,
          rangeStart,
          rangeEnd,
          localizationScore,
          modValue,
          isIonTypeAfterStrip      // isIonType (ProForma 2.1)
        );
      } else if (ambiguityRefMatch && !ambiguityRefMatch[1].startsWith("XL")) {
        ambiguityGroup = ambiguityRefMatch[1];
        if (ambiguityRefMatch[2]) {  // Score is present
          localizationScore = parseFloat(ambiguityRefMatch[2]);
        }
        return new Modification(
          "",
          undefined,
          undefined,
          undefined,
          "ambiguous",
          false,
          0,
          0.0,
          false,
          undefined,
          false,
          false,
          false,
          ambiguityGroup,
          true,
          inRange,
          rangeStart,
          rangeEnd,
          localizationScore,
          modValue,
          isIonType      // isIonType (ProForma 2.1)
        );
      }
    }

    // Create the modification with appropriate attributes
    return new Modification(
      modStr,
      undefined,
      undefined,
      undefined,
      modType,
      isLabile,
      0,
      0.0,
      false,
      crosslinkId,
      isCrosslinkRef,
      isBranchRef,
      isBranch,
      undefined,
      false,
      inRange,
      rangeStart,
      rangeEnd,
      undefined,
      modValue,
      isIonType      // isIonType (ProForma 2.1)
    );
  }

  /**
   * Parses the charge information from a ProForma string.
   *
   * @param proformaStr - The ProForma string to parse.
   * @returns A tuple containing the ProForma string without the charge information, the charge value, and the ionic species.
   */
  static parseChargeInfo(proformaStr: string): [string, number | null, string | null] {
    if (!proformaStr.includes('/')) {
      return [proformaStr, null, null];
    }

    let chargePos = -1;
    let bracketLevel = 0;

    // Find the charge separator (/) that's not inside brackets
    for (let i = 0; i < proformaStr.length; i++) {
      const char = proformaStr[i];
      if (char === '[' || char === '(') {
        bracketLevel++;
      } else if (char === ']' || char === ')') {
        bracketLevel--;
      } else if (char === '/' && bracketLevel === 0) {
        chargePos = i;
        break;
      }
    }

    if (chargePos === -1) {
      return [proformaStr, null, null];
    }

    const beforeCharge = proformaStr.substring(0, chargePos);
    const afterCharge = proformaStr.substring(chargePos + 1);

    let i = 0;
    let sign = 1;

    // Handle negative sign
    if (i < afterCharge.length && afterCharge[i] === '-') {
      sign = -1;
      i++;
    }

    // Parse digits
    const startDigit = i;
    while (i < afterCharge.length && /\d/.test(afterCharge[i])) {
      i++;
    }

    let chargeValue: number | null = null;
    if (startDigit !== i) {
      chargeValue = parseInt(afterCharge.substring(startDigit, i)) * sign;
    }

    // Check for ionic species / charge carriers in square brackets. These may appear on their
    // own, e.g. "/[Na:z+1]", without a preceding numeric charge (section 11.5).
    let remaining = afterCharge.substring(i);
    let ionicSpecies: string | null = null;

    if (remaining && remaining[0] === '[') {
      // Find the matching closing bracket
      let bracketLevel = 1;
      let endPos = 0;

      for (let j = 1; j < remaining.length; j++) {
        if (remaining[j] === '[') {
          bracketLevel++;
        } else if (remaining[j] === ']') {
          bracketLevel--;
        }

        if (bracketLevel === 0) {
          endPos = j;
          break;
        }
      }

      if (endPos > 0) {
        ionicSpecies = remaining.substring(1, endPos);
        remaining = remaining.substring(endPos + 1);
      }
    }

    if (chargeValue === null && ionicSpecies === null) {
      return [proformaStr, null, null];
    }

    // Reconstruct the string without charge information
    let resultStr = beforeCharge;
    if (remaining) {
      resultStr += remaining;
    }

    return [resultStr, chargeValue, ionicSpecies];
  }
}