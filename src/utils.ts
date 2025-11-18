/**
 * Calculates the hash code of a string.
 *
 * @param input - The string to calculate the hash code for.
 * @returns The hash code.
 */
export function calculateHashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}