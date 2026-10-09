export const ROOM_CODE_LENGTH = 6;

/**
 * Characters allowed in a room code. Ambiguous characters (0/O, 1/I/L) are
 * excluded so a code typed by hand is unambiguous. Uppercase only.
 */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Normalizes user input into a canonical room code, or returns null when the
 * input cannot be a valid code (wrong length or unknown characters).
 */
export function normalizeRoomCode(input: string): string | null {
  const cleaned = input
    .trim()
    .replace(/[\s-]+/g, "")
    .toUpperCase();
  if (cleaned.length !== ROOM_CODE_LENGTH) return null;
  for (const char of cleaned) {
    if (!ROOM_CODE_ALPHABET.includes(char)) return null;
  }
  return cleaned;
}

export function isValidRoomCode(code: string): boolean {
  return normalizeRoomCode(code) !== null;
}