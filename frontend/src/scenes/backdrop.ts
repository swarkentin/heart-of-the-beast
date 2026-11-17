// Which pixel-art background a room is shown against. The rule mirrors RoomBackdropKind in
// backend/internal/game/room_backdrop.go (pinned there by TestRoomBackdropKindRule); the art lives in
// frontend/public/art/rooms/<theme>/<kind>-<first|cinema>.png and is described by rooms/index.json.

export type BackdropKind = "entry" | "corridor" | "event" | "boss" | "vault";
export type BackdropView = "first" | "cinema";
export type BackdropRoom = { id: string; roomType?: string; themeId?: string };

export const DEFAULT_THEME_ID = "catacombs";
/** Native size of every backdrop PNG; the scene viewBox is this times four. */
export const BACKDROP_SIZE = { width: 275, height: 155 } as const;

export function backdropKind(room: Pick<BackdropRoom, "id" | "roomType">): BackdropKind {
  if (room.id.endsWith("entry")) return "entry";
  if (room.roomType === "boss" || room.roomType === "miniboss" || room.roomType === "lair") return "boss";
  if (room.roomType === "event") return "event";
  if (room.roomType === "reward") return "vault";
  return "corridor";
}

/** Runs and rooms saved before themes existed have no themeId and are Catacombs. */
export const backdropTheme = (themeId?: string) => themeId || DEFAULT_THEME_ID;

export function backdropUrl(themeId: string | undefined, kind: BackdropKind, view: BackdropView): string {
  return `/art/rooms/${backdropTheme(themeId)}/${kind}-${view}.png`;
}

/** Display name for the cast overlay; falls back to the id for themes not named here. */
export const THEME_TITLES: Record<string, string> = {
  catacombs: "THE FORGOTTEN CATACOMBS", scifi: "SCI-FI RESEARCH FACILITY", mobster: "1930s MOBSTER UNDERWORLD", sunken: "THE SUNKEN KINGDOM",
  clockwork: "THE CLOCKWORK EMPIRE", carnival: "THE HAUNTED CARNIVAL", jungle: "THE ALIEN JUNGLE", dreamscape: "THE DREAMSCAPES",
  arctic: "THE ARCTIC STATION", ghosttown: "THE GHOST TOWN", wasteland: "THE WASTELAND SETTLEMENT",
};
export const themeTitle = (themeId?: string) => THEME_TITLES[backdropTheme(themeId)] ?? backdropTheme(themeId).toUpperCase();
