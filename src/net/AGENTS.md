# net/

- Live players run older builds. Every message stays readable by them: same channel names (`car`, `chat`, `event`, `hello`), new fields optional, nothing renamed or removed. Old peers ignore unknown channels.
- `PROTOCOL` in `net.ts` goes up when old and new peers can no longer play together; `protocol_of(id)` tells the UI.
- The `car` packet is binary (`car-packet.ts`), append-only within a protocol: a new field goes after the build, a new flag takes a free bit, and decoders ignore trailing bytes and unknown bits. Reordering or resizing a field bumps `PROTOCOL`.
- Peer data is hostile: every channel has a sanitizer; a channel that can be flooded or must come from a known peer adds a per-sender rate limit and an `accept` check, which runs before the limit.
- One leader rule everywhere: `Net.leader_id`, the lowest id among same-map peers.
- Tests inject the room factory; no process-wide `mock.module("trystero")`.
