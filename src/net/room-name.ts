export const DIRECTORY_ROOM = "harepin-directory";
/** The open room a bare link lands in: free roam on whatever map the player picked. */
export const LOBBY_ROOM = "lobby";
export const ROOM_LENGTH = 32;

export function clean_room(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const room = raw.trim();
  if (!room || /\p{C}/u.test(room) || [...room].length > ROOM_LENGTH || room === DIRECTORY_ROOM) return null;
  return room;
}
