# net/

- Live players run older builds. Every message stays readable by them: same channel names (`car`, `chat`, `event`, `hello`), new fields optional, nothing renamed or removed. Old peers ignore unknown channels.
- `PROTOCOL` in `net.ts` goes up when old and new peers can no longer play together; `protocol_of(id)` tells the UI.
- The `car` packet is binary (`car-packet.ts`), append-only within a protocol: a new field goes after the build, a new flag takes a free bit, and decoders ignore trailing bytes and unknown bits. Reordering or resizing a field bumps `PROTOCOL`.
- Peer data is hostile: every channel has a sanitizer; a channel that can be flooded or must come from a known peer adds a per-sender rate limit and an `accept` check, which runs before the limit.
- One leader rule everywhere: `Net.leader_id`, the lowest id among same-map peers.
- Tests inject the room factory; no process-wide `mock.module("trystero")`.
- ICE: trystero's default STUN (Google, Cloudflare) plus `TURN_SERVERS` from `ice.ts`, passed as `turnConfig` to every `joinRoom` (game and directory rooms). TURN only carries peers with no direct path (carrier NAT); without the build env `TURN_USERNAME` / `TURN_CREDENTIAL` it is empty and play falls back to direct only. The login is encoded into the bundle by `turn-code.ts` through a Vite define: obfuscated, not secret; rotate it in Metered if abused.
