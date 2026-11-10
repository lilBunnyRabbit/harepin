// Not secrecy, only keeps the relay login out of plain-text greps of the bundle; anyone running the game can read it.
const KEY = "harepin-relay";

export interface TurnLogin {
  username: string;
  credential: string;
}

const xor = (bytes: Uint8Array) => bytes.map((byte, i) => byte ^ KEY.charCodeAt(i % KEY.length));

/** Empty when either value is missing, so a build without them runs on STUN alone. */
export function encode_turn(username: string | undefined, credential: string | undefined): string {
  if (!username || !credential) return "";
  return btoa(String.fromCharCode(...xor(new TextEncoder().encode(JSON.stringify([username, credential])))));
}

export function decode_turn(code: string): TurnLogin | null {
  if (!code) return null;
  try {
    const [username, credential]: unknown[] = JSON.parse(new TextDecoder().decode(xor(Uint8Array.from(atob(code), (c) => c.charCodeAt(0)))));
    return typeof username === "string" && typeof credential === "string" && username && credential ? { username, credential } : null;
  } catch (error) {
    console.warn("ice: relay login unreadable, STUN only", error);
    return null;
  }
}
