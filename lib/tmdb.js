/**
 * lib/tmdb.js — Server-side TMDB API client
 * Token is read from env — NEVER sent to the browser.
 */

const BASE_URL = 'https://api.themoviedb.org/3';
export const IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export const IMG_SIZE = {
  THUMB:   `${IMAGE_BASE}w185`,
  CARD:    `${IMAGE_BASE}w342`,
  POSTER:  `${IMAGE_BASE}w500`,
  BACK_SM: `${IMAGE_BASE}w780`,
  BACK_LG: `${IMAGE_BASE}w1280`,
  AVATAR:  `${IMAGE_BASE}w185`,
  LOGO:    `${IMAGE_BASE}original`,
};

async function tmdb(endpoint, params = {}) {
  const token = process.env.TMDB_BEARER_TOKEN;
  if (!token) throw new Error('TMDB_BEARER_TOKEN is not set in .env.local');

  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 3600 }, // Cache for 1 hour (Next.js fetch caching)
  });

  if (!res.ok) {
    const err = new Error(`TMDB ${res.status}: ${res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export const getTrending    = (type = 'all', window = 'week') => tmdb(`/trending/${type}/${window}`);
export const getPopularMovies = (page = 1) => tmdb('/movie/popular', { page });
export const getPopularTV   = (page = 1)   => tmdb('/tv/popular', { page });
export const getMovieGenres = ()           => tmdb('/genre/movie/list');
export const getTVGenres    = ()           => tmdb('/genre/tv/list');

export const getMovieDetails = (id) =>
  tmdb(`/movie/${id}`, { append_to_response: 'credits,videos,watch/providers' });

export const getTVDetails = (id) =>
  tmdb(`/tv/${id}`, { append_to_response: 'credits,videos,watch/providers' });

export const searchMulti = (query, page = 1) =>
  tmdb('/search/multi', { query, page, include_adult: false });

export const discoverMovies = ({ genreId, page = 1 } = {}) =>
  tmdb('/discover/movie', { with_genres: genreId, sort_by: 'popularity.desc', page });

export const discoverTV = ({ genreId, page = 1 } = {}) =>
  tmdb('/discover/tv', { with_genres: genreId, sort_by: 'popularity.desc', page });

// ── Helpers (shared with client) ─────────────────────────────────────────────

export function imgUrl(path, size = 'CARD') {
  if (!path) return '/placeholder.svg';
  return `${IMG_SIZE[size] ?? IMG_SIZE.CARD}${path}`;
}

export function getTitle(item)  { return item?.title || item?.name || 'Unknown'; }
export function getYear(item)   { return (item?.release_date || item?.first_air_date || '').slice(0, 4) || '—'; }
export function getMediaType(item) {
  return item?.media_type === 'tv' || item?.first_air_date !== undefined ? 'tv' : 'movie';
}
export function formatRating(v) { return v ? Number(v).toFixed(1) : '—'; }

export function getTrailerKey(videos) {
  return videos?.results?.find(
    v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  )?.key ?? null;
}

export function getProviders(watchProviders, country = 'US') {
  const results = watchProviders?.results ?? {};
  const region  = results[country] ?? results['US'] ?? null;
  if (!region) return [];
  const all  = [...(region.flatrate ?? []), ...(region.free ?? [])];
  const seen = new Set();
  return all.filter(p => { if (seen.has(p.provider_id)) return false; seen.add(p.provider_id); return true; });
}
