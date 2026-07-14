/**
 * store.js — Watchlist state manager (localStorage)
 *
 * Schema per item:
 * {
 *   id:         number,
 *   type:       'movie' | 'tv',
 *   title:      string,
 *   posterPath: string | null,
 *   year:       string,
 *   rating:     number,
 *   status:     'want_to_watch' | 'watching' | 'watched',
 *   addedAt:    ISO string,
 *   userRating: number | null,   // 1–10
 *   notes:      string,
 * }
 */

const STORAGE_KEY = 'cinelist_watchlist_v1';

// Status cycle order
export const STATUS_CYCLE = ['want_to_watch', 'watching', 'watched'];

export const STATUS_LABEL = {
  want_to_watch: 'Want to Watch',
  watching: 'Watching',
  watched: 'Watched',
};

export const STATUS_EMOJI = {
  want_to_watch: '🔖',
  watching: '▶️',
  watched: '✅',
};

// ── Internal: read raw list ──────────────────────────────────────────────────
function readList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Internal: persist list ──────────────────────────────────────────────────
function writeList(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  // Dispatch a custom event so any listener can react
  window.dispatchEvent(new CustomEvent('watchlist:change', { detail: { list } }));
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Return the full watchlist array. */
export function getWatchlist() {
  return readList();
}

/** Return items filtered by status ('all' returns everything). */
export function getByStatus(status) {
  const list = readList();
  if (status === 'all') return list;
  return list.filter(i => i.status === status);
}

/**
 * Add a new item to the watchlist.
 * @param {{ id, type, title, posterPath, year, rating }} item
 */
export function addToWatchlist(item) {
  const list = readList();
  if (list.some(i => i.id === item.id && i.type === item.type)) return; // already in list
  list.unshift({
    id: item.id,
    type: item.type,
    title: item.title,
    posterPath: item.posterPath ?? null,
    year: item.year ?? '—',
    rating: item.rating ?? 0,
    status: 'want_to_watch',
    addedAt: new Date().toISOString(),
    userRating: null,
    notes: '',
  });
  writeList(list);
}

/** Remove an item from the watchlist. */
export function removeFromWatchlist(id, type) {
  const list = readList().filter(i => !(i.id === id && i.type === type));
  writeList(list);
}

/** Check if an item is in the watchlist. */
export function isInWatchlist(id, type) {
  return readList().some(i => i.id === id && i.type === type);
}

/** Get a single watchlist item. */
export function getWatchlistItem(id, type) {
  return readList().find(i => i.id === id && i.type === type) ?? null;
}

/** Update the watching status for an item. */
export function updateStatus(id, type, status) {
  const list = readList().map(i => {
    if (i.id === id && i.type === type) return { ...i, status };
    return i;
  });
  writeList(list);
}

/** Cycle to the next status (want → watching → watched → want). */
export function cycleStatus(id, type) {
  const item = getWatchlistItem(id, type);
  if (!item) return null;
  const idx = STATUS_CYCLE.indexOf(item.status);
  const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  updateStatus(id, type, nextStatus);
  return nextStatus;
}

/** Set a user personal rating (1–10). */
export function setUserRating(id, type, rating) {
  const list = readList().map(i => {
    if (i.id === id && i.type === type) return { ...i, userRating: rating };
    return i;
  });
  writeList(list);
}

/** Set personal notes. */
export function setNotes(id, type, notes) {
  const list = readList().map(i => {
    if (i.id === id && i.type === type) return { ...i, notes };
    return i;
  });
  writeList(list);
}

/** Remove all items with status 'watched'. */
export function clearWatched() {
  const list = readList().filter(i => i.status !== 'watched');
  writeList(list);
}

/** Sort the watchlist by a given field. */
export function sortList(list, field) {
  const clone = [...list];
  switch (field) {
    case 'title':
      clone.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'rating':
      clone.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case 'userRating':
      clone.sort((a, b) => (b.userRating ?? 0) - (a.userRating ?? 0));
      break;
    case 'addedAt':
    default:
      clone.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
      break;
  }
  return clone;
}

/** Count items by status. */
export function getCounts() {
  const list = readList();
  return {
    all: list.length,
    want_to_watch: list.filter(i => i.status === 'want_to_watch').length,
    watching: list.filter(i => i.status === 'watching').length,
    watched: list.filter(i => i.status === 'watched').length,
  };
}

/** Progress stats. */
export function getProgress() {
  const list = readList();
  const total = list.length;
  const watched = list.filter(i => i.status === 'watched').length;
  const pct = total === 0 ? 0 : Math.round((watched / total) * 100);
  return { total, watched, pct };
}

// ── Import / Export ──────────────────────────────────────────────────────────

/** Serialize the watchlist to a JSON string. */
export function exportList() {
  return JSON.stringify(readList());
}

/**
 * Import a JSON string, merging with existing list (no duplicates).
 * @param {string} json
 * @returns {number} Number of items imported
 */
export function importList(json) {
  let incoming;
  try {
    incoming = JSON.parse(json);
    if (!Array.isArray(incoming)) throw new Error('Not an array');
  } catch {
    throw new Error('Invalid watchlist data');
  }

  const existing = readList();
  const existingKeys = new Set(existing.map(i => `${i.id}:${i.type}`));
  const newItems = incoming.filter(i => !existingKeys.has(`${i.id}:${i.type}`));
  writeList([...newItems, ...existing]);
  return newItems.length;
}
