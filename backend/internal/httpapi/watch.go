package httpapi

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

// Snapshot reads can wait for the room to change instead of the client polling on a timer (long polling).
// GET /rooms/{id}?after=<version> holds the request open until the room's version passes <version>, the next
// timed transition (round, vote or camp deadline) is due, or maxRoomWait elapses, whichever comes first. A party
// then sees each other's actions and every round's result as soon as the server has them.
//
// Wake-ups are in-process. Saves made by another server instance (briefly, during a rolling deploy) are still
// seen at the next deadline or within maxRoomWait, so correctness never depends on the notification.
//
// The limit stays well under the client's request timeout and any proxy idle timeout, and keeps presence
// (online/disconnected, which changes with time rather than with a save) at most this stale.
var maxRoomWait = 15 * time.Second

// roomWatchers wakes long-polling readers of a room when it is saved. It works from its zero value.
type roomWatchers struct {
	mu    sync.Mutex
	rooms map[string]chan struct{}
}

// watch returns a channel that is closed at the room's next save. Callers must subscribe before reading the
// room, so a save between the read and the wait is never missed.
func (w *roomWatchers) watch(roomID string) <-chan struct{} {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.rooms == nil {
		w.rooms = make(map[string]chan struct{})
	}
	ch, ok := w.rooms[roomID]
	if !ok {
		ch = make(chan struct{})
		w.rooms[roomID] = ch
	}
	return ch
}

// changed wakes every reader waiting on the room. A room nobody waits on costs nothing.
func (w *roomWatchers) changed(roomID string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if ch, ok := w.rooms[roomID]; ok {
		close(ch)
		delete(w.rooms, roomID)
	}
}

// waitAfter reads the ?after=<version> query: ok is false when the client did not ask to wait.
func waitAfter(r *http.Request) (int64, bool) {
	value := r.URL.Query().Get("after")
	if value == "" {
		return 0, false
	}
	after, err := strconv.ParseInt(value, 10, 64)
	if err != nil || after < 0 {
		return 0, false
	}
	return after, true
}

// nextDeadline is the earliest future moment the server would advance the room on its own, or zero for none.
// A deadline already past is ignored: advanceRoomIfDue has handled it, or it will never fire for this room.
func nextDeadline(room *game.Room, now time.Time) time.Time {
	var next time.Time
	consider := func(at time.Time) {
		if at.After(now) && (next.IsZero() || at.Before(next)) {
			next = at
		}
	}
	run := room.Run
	if run == nil {
		return next
	}
	if run.CombatRound != nil {
		consider(run.CombatRound.Deadline)
	}
	if run.NavigationVote != nil {
		consider(run.NavigationVote.Deadline)
	}
	if run.EventVote != nil {
		consider(run.EventVote.Deadline)
	}
	if run.InterFloorVote != nil {
		consider(run.InterFloorVote.Deadline)
	}
	if run.Camp != nil && run.Camp.Deadline != nil {
		consider(*run.Camp.Deadline)
	}
	return next
}

// waitForRoom blocks until the room changes past `after`, its next deadline is due, the wait limit passes or
// the client goes away. load re-reads the room (and advances anything due) after each wake-up; it is called
// at least once. The latest room is returned.
func (h *Handler) waitForRoom(r *http.Request, roomID string, after int64, load func() (*game.Room, error)) (*game.Room, error) {
	limit := time.NewTimer(maxRoomWait)
	defer limit.Stop()
	for {
		changed := h.watchers.watch(roomID)
		room, err := load()
		if err != nil || room.Version > after {
			return room, err
		}
		var due <-chan time.Time
		var timer *time.Timer
		if deadline := nextDeadline(room, h.now().UTC()); !deadline.IsZero() {
			// A little past the deadline, so the server's own clock has certainly reached it on the re-read.
			timer = time.NewTimer(deadline.Sub(h.now().UTC()) + 25*time.Millisecond)
			due = timer.C
		}
		stop := func() {
			if timer != nil {
				timer.Stop()
			}
		}
		select {
		case <-changed:
			stop()
		case <-due:
		case <-limit.C:
			stop()
			return load()
		case <-r.Context().Done():
			stop()
			return room, nil
		}
	}
}
