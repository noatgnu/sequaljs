import { Modification } from './modification';
import type { Sequence } from './sequence';

/**
 * Returns every modification attached anywhere in this sequence: on each residue, plus the
 * N-terminal/C-terminal/labile/unknown-position slots.
 */
export function allModifications(seq: Sequence): Modification[] {
  const mods: Modification[] = [];
  for (const aa of seq.seq) {
    mods.push(...aa.mods);
  }
  for (const posMods of seq.mods.values()) {
    mods.push(...posMods);
  }
  return mods;
}

/**
 * Checks every ambiguity-group reference resolves to a definition.
 */
export function validateAmbiguityLabels(mods: Modification[]): void {
  const defined = new Set<string>();
  for (const m of mods) {
    if (m.ambiguityGroup !== null && !m.isAmbiguityRef) {
      defined.add(m.ambiguityGroup);
    }
  }
  for (const m of mods) {
    if (m.ambiguityGroup !== null && m.isAmbiguityRef && !defined.has(m.ambiguityGroup)) {
      throw new Error(`Ambiguity group reference #${m.ambiguityGroup} has no matching definition`);
    }
  }
}

/**
 * Checks every crosslink/branch reference resolves to a definition. A definition with no
 * reference is valid (a "dead end" crosslink).
 */
export function validateCrosslinkAndBranchLabels(mods: Modification[]): void {
  const definedCrosslinks = new Set<string>();
  let hasBranchDefinition = false;
  for (const m of mods) {
    if (m.crosslinkId !== null && !m.isCrosslinkRef) {
      definedCrosslinks.add(m.crosslinkId);
    }
    if (m.isBranch && !m.isBranchRef) {
      hasBranchDefinition = true;
    }
  }

  for (const m of mods) {
    if (m.crosslinkId !== null && m.isCrosslinkRef && !definedCrosslinks.has(m.crosslinkId)) {
      throw new Error(`Crosslink reference #${m.crosslinkId} has no matching definition`);
    }
    if (m.isBranchRef && !hasBranchDefinition) {
      throw new Error("Branch reference #BRANCH has no matching definition");
    }
  }
}
