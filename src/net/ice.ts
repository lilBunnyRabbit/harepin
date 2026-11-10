import type { TurnServerConfig } from "trystero";
import { decode_turn } from "./turn-code";

declare const __HAREPIN_TURN__: string;

const STUN = "stun:stun.relay.metered.ca:80";
const TURN = [
  "turn:global.relay.metered.ca:80",
  "turn:global.relay.metered.ca:80?transport=tcp",
  "turn:global.relay.metered.ca:443",
  "turns:global.relay.metered.ca:443?transport=tcp",
];

// Bun tests load this without Vite's define.
const login = decode_turn(typeof __HAREPIN_TURN__ === "string" ? __HAREPIN_TURN__ : "");

/** Added to trystero's default STUN list as `turnConfig`; without a login from the build, nothing is added. */
export const TURN_SERVERS: TurnServerConfig[] = login ? [{ urls: STUN }, ...TURN.map((urls) => ({ urls, ...login }))] : [];
