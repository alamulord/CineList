/**
 * lib/store.js — Client-side watchlist state (localStorage + React hook)
 */

const STORAGE_KEY = 'cinelist_watchlist_v1';

export const STATUS_CYCLE = ['want_to_watch', 'watching', 'watched'];
export const STATUS_LABEL = {
  want_to_watch: 'Want to Watch',
  watching: 'Watching',
  watched: 'Watched',
};

// ── Raw localStorage helpers ──────────────────────────────────────────────────

export function readList() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function writeList(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent('watchlist:change', { detail: { list } }));
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function addToWatchlist(item) {
  const list = readList();
  if (list.some(i => i.id === item.id && i.type === item.type)) return;
  writeList([{
    id: item.id, type: item.type, title: item.title,
    posterPath: item.posterPath ?? null, year: item.year ?? '—',
    rating: item.rating ?? 0, status: 'want_to_watch',
    addedAt: new Date().toISOString(), userRating: null, notes: '',
  }, ...list]);
}

export function removeFromWatchlist(id, type) {
  writeList(readList().filter(i => !(i.id === id && i.type === type)));
}

export function isInWatchlist(id, type) {
  return readList().some(i => i.id === id && i.type === type);
}

export function getWatchlistItem(id, type) {
  return readList().find(i => i.id === id && i.type === type) ?? null;
}

export function updateStatus(id, type, status) {
  writeList(readList().map(i => i.id === id && i.type === type ? { ...i, status } : i));
}

export function cycleStatus(id, type) {
  const item = getWatchlistItem(id, type);
  if (!item) return null;
  const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(item.status) + 1) % STATUS_CYCLE.length];
  updateStatus(id, type, next);
  return next;
}

export function setUserRating(id, type, rating) {
  writeList(readList().map(i => i.id === id && i.type === type ? { ...i, userRating: rating } : i));
}

export function setNotes(id, type, notes) {
  writeList(readList().map(i => i.id === id && i.type === type ? { ...i, notes } : i));
}

export function clearWatched() {
  writeList(readList().filter(i => i.status !== 'watched'));
}

export function getByStatus(status) {
  const list = readList();
  if (status === 'all') return list;
  return list.filter(i => i.status === status);
}

export function sortList(list, field) {
  const c = [...list];
  switch (field) {
    case 'title':      return c.sort((a, b) => a.title.localeCompare(b.title));
    case 'rating':     return c.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case 'userRating': return c.sort((a, b) => (b.userRating ?? 0) - (a.userRating ?? 0));
    default:           return c.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  }
}

export function getCounts() {
  const list = readList();
  return {
    all:           list.length,
    want_to_watch: list.filter(i => i.status === 'want_to_watch').length,
    watching:      list.filter(i => i.status === 'watching').length,
    watched:       list.filter(i => i.status === 'watched').length,
  };
}

export function getProgress() {
  const list    = readList();
  const total   = list.length;
  const watched = list.filter(i => i.status === 'watched').length;
  return { total, watched, pct: total === 0 ? 0 : Math.round((watched / total) * 100) };
}

// ── Share helpers ─────────────────────────────────────────────────────────────

function encode(json) {
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decode(str) {
  return decodeURIComponent(escape(atob(str.replace(/-/g,'+').replace(/_/g,'/'))));
}

export function exportList() { return encode(JSON.stringify(readList())); }

export function importList(encoded) {
  let incoming;
  try { incoming = JSON.parse(decode(encoded)); if (!Array.isArray(incoming)) throw 0; }
  catch { throw new Error('Invalid watchlist data'); }
  const existing    = readList();
  const existingKeys = new Set(existing.map(i => `${i.id}:${i.type}`));
  const newItems    = incoming.filter(i => !existingKeys.has(`${i.id}:${i.type}`));
  writeList([...newItems, ...existing]);
  return newItems.length;
}
