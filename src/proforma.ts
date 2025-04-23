import { GlobalModification, Modification, ModificationValue } from './modification';

export class SequenceAmbiguity {
  value: string;
  position: number;

  constructor(value: string, position: number) {
    this.value = value;
    this.position = position;
  }

  toString(): string {
    return `SequenceAmbiguity(value='${this.value}', position=${this.position})`;
  }
}



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


  static parse(proformaStr: string): [string, Record<number, Modification[]>, GlobalModification[], SequenceAmbiguity[]] {
    let baseSequence = "";
    const modifications: Record<number, Modification[]> = {};
    const globalMods: GlobalModification[] = [];
    const sequenceAmbiguities: SequenceAmbiguity[] = [];

    const getModsAtPosition = (pos: number): Modification[] => {
      if (!modifications[pos]) {
        modifications[pos] = [];
      }
      return modifications[pos];
    };

    while (proformaStr.startsWith("<")) {
      const endBracket = proformaStr.indexOf(">");
      if (endBracket === -1) {
        throw new Error("Unclosed global modification angle bracket");
      }

      const globalModStr = proformaStr.substring(1, endBracket);
      proformaStr = proformaStr.substring(endBracket + 1);  // Remove processed part

      if (globalModStr.includes("@")) {
        // Fixed protein modification
        const [modPart, targets] = globalModStr.split("@");
        let modValue = modPart;

        if (modPart.startsWith("[") && modPart.endsWith("]")) {
          modValue = modPart.substring(1, modPart.length - 1);  // Remove brackets
        }

        const targetResidues = targets.split(",");
        globalMods.push(
          new GlobalModification(modValue, targetResidues, "fixed")
        );
      } else {
        // Isotope labeling
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
      const j = proformaStr.indexOf("}", i);
      if (j === -1) {
        throw new Error(`Unclosed curly brace at position ${i}`);
      }

      const modStr = proformaStr.substring(i + 1, j);
      if (!modStr.startsWith("Glycan:")) {
        throw new Error(
          `Labile modification must start with 'Glycan:', found: ${modStr}`
        );
      }

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
              const nTermMod = ProFormaParser._createModification(modString, { isTerminal: true });
              getModsAtPosition(-1).push(nTermMod);
            }

            currentPos = endPos;
          } else {
            currentPos++;
          }
        }
      }
    }

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
              const cTermMod = ProFormaParser._createModification(modString, { isTerminal: true });
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
    let currentPosition = 0;

    while (i < proformaStr.length) {
      const char = proformaStr[i];

      if (i + 1 < proformaStr.length && proformaStr.substring(i, i + 2) === "(?") {
        const closingParen = proformaStr.indexOf(")", i + 2);
        if (closingParen === -1) {
          throw new Error("Unclosed sequence ambiguity parenthesis");
        }

        const ambiguousSeq = proformaStr.substring(i + 2, closingParen);
        sequenceAmbiguities.push(
          new SequenceAmbiguity(ambiguousSeq, currentPosition)
        );

        // Skip past the ambiguity notation
        i = closingParen + 1;
        continue;
      }

      if (char === "(") {
        // Start of a range
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

    return [baseSequence, modifications, globalMods, sequenceAmbiguities];
  }

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
          modValue       // modValue
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
          modValue
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
        modValue
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
        return new Modification(
          modStr,
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
          false,
          inRange,
          rangeStart,
          rangeEnd,
          localizationScore,
          modValue
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
          modValue
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
      modValue
    );
  }
}