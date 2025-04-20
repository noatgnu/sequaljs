import {H, O} from "./resources";

export function calculateMass(
  seq: any[],
  massDict?: Record<string, number>,
  NTerminus: number = 0,
  OTerminus: number = 0,
  withWater: boolean = true
): number {
  let mass = 0;

  if (withWater) {
    mass += H * 2 + O;
  }

  for (const i of seq) {
    if (!i.mass) {
      if (massDict) {
        if (i.value in massDict) {
          mass += massDict[i.value];
        } else {
          throw new Error(`Block ${i.value} not found in massDict`);
        }
      } else {
        throw new Error(
          `Block ${i.value} mass is not available in mass attribute and no additional massDict was supplied`
        );
      }
    } else {
      mass += i.mass;
    }

    if (i.mods) {
      for (const m of i.mods) {
        if (m.mass !== 0 && !m.mass) {
          if (massDict) {
            if (m.value in massDict) {
              mass += massDict[m.value];
            } else {
              throw new Error(`Block ${m.value} not found in massDict`);
            }
          } else {
            throw new Error(
              `Block ${m.value} mass is not available in mass attribute and no additional massDict was supplied`
            );
          }
        } else {
          mass += m.mass;
        }
      }
    }
  }

  return mass + NTerminus + OTerminus;
}