import {
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "../../../shared/roomCode";

export { isValidRoomCode, normalizeRoomCode };

/** Cryptographically unbiased random value in [0, 1). */
function secureRandom(): number {
  const buffer = new Uint32Array(2);
  crypto.getRandomValues(buffer);
  const a = buffer[0] ?? 0;
  const b = buffer[1] ?? 0;
  return (a * 4294967296 + Number(b)) / 2 ** 64;
}

/**
 * Generates a random room code with enough entropy that rooms cannot be
 * guessed trivially. Codes are bearer secrets: whoever knows the code can
 * join the room.
 */
export function generateRoomCode(rng: () => number = secureRandom): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.floor(rng() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET.charAt(index);
  }
  return code;
}

/** Builds the shareable URL for a room based on the current page origin. */
export function buildRoomUrl(roomCode: string, origin = window.location.origin, pathname = window.location.pathname): string {
  return `${origin}${pathname}#${roomCode}`;
}

/**
 * Extracts a room code from a URL such as `https://sinisana.app/#K7MXP2`.
 * Returns null when the URL does not contain a valid room code.
 */
export function parseRoomCodeFromUrl(url: string): string | null {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;
  const fragment = url.slice(hashIndex + 1);
  if (fragment.length === 0) return null;
  return normalizeRoomCode(decodeURIComponent(fragment));
}