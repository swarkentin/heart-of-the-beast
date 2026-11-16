package art

// RoomKind is the kind of room backdrop, such as the entry hall or a boss chamber. Use the generated RoomKind*
// variables; like SpriteID the field is unexported, so a kind that has no art cannot be written down.
type RoomKind struct{ id string }

// String returns the stable kind name used in file names and sent to clients.
func (k RoomKind) String() string { return k.id }

// Backdrop is the pair of pixel-art backgrounds (first-person and cinematic) for one theme and room kind.
type Backdrop struct {
	Theme ThemeID
	Kind  RoomKind
	// First and Cinema are PNG paths relative to frontend/public/art/rooms.
	First  string
	Cinema string
}

// RoomKinds returns every room kind the art pipeline paints, in presentation order.
func RoomKinds() []RoomKind { return append([]RoomKind(nil), roomKinds...) }

// Backdrops returns every generated backdrop.
func Backdrops() []Backdrop { return append([]Backdrop(nil), backdrops...) }

// BackdropFor returns the backdrop of a room kind in a theme, or false when the pipeline did not paint one.
func BackdropFor(theme ThemeID, kind RoomKind) (Backdrop, bool) {
	for _, backdrop := range backdrops {
		if backdrop.Theme == theme && backdrop.Kind == kind {
			return backdrop, true
		}
	}
	return Backdrop{}, false
}

// ParseRoomKind resolves a kind name, such as one from a client request.
func ParseRoomKind(name string) (RoomKind, bool) {
	for _, kind := range roomKinds {
		if kind.id == name {
			return kind, true
		}
	}
	return RoomKind{}, false
}
