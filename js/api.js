/**
 * api.js — TMDB API client
 *
 * ⚠️  Add your TMDB API Read Access Token (Bearer) to the CONFIG below.
 *     Get one free at: https://www.themoviedb.org/settings/api
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  BASE_URL: 'https://api.themoviedb.org/3',
  // Paste your "API Read Access Token" (starts with ey…) here:
  BEARER_TOKEN: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxNmI1ZGQ4MmY5MmNjOGE2MDY3MzE1MWVkMmUwZTBmMyIsIm5iZiI6MTc4NDAzNTg4OC4wODA5OTk5LCJzdWIiOiI2YTU2M2EzMDNmNDc4YzhhMmVlMTFkOTIiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.VHqGvBQ1tEUgqF-6wFK8o4FicmQd_B40SoHInRpBxmw',
  IMAGE_BASE: 'https://image.tmdb.org/t/p/',
};

// ── Image size presets ──────────────────────────────────────────────────────
export const IMG = {
  THUMB:   `${CONFIG.IMAGE_BASE}w185`,   // search dropdown thumbnails
  CARD:    `${CONFIG.IMAGE_BASE}w342`,   // card grid posters
  POSTER:  `${CONFIG.IMAGE_BASE}w500`,   // modal poster
  BACK_SM: `${CONFIG.IMAGE_BASE}w780`,   // hero (mobile / lo-fi)
  BACK_LG: `${CONFIG.IMAGE_BASE}w1280`,  // hero (desktop)
  AVATAR:  `${CONFIG.IMAGE_BASE}w185`,   // cast avatars
  LOGO:    `${CONFIG.IMAGE_BASE}original`, // streaming provider logos
};

// ── Internal fetch wrapper ──────────────────────────────────────────────────
async function tmdb(endpoint, params = {}, signal) {
  const url = new URL(`${CONFIG.BASE_URL}${endpoint}`);

  // Merge query params
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, v);
    }
  });

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${CONFIG.BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    signal,
  });

  if (!res.ok) {
    const err = new Error(`TMDB ${res.status}: ${res.statusText}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

// ── Cached configuration (image base URLs) ─────────────────────────────────
let _configCache = null;

export async function getConfig() {
  if (_configCache) return _configCache;
  _configCache = await tmdb('/configuration');
  return _configCache;
}

// ── Trending ────────────────────────────────────────────────────────────────
export function getTrending(mediaType = 'all', window = 'week') {
  return tmdb(`/trending/${mediaType}/${window}`);
}

// ── Popular ─────────────────────────────────────────────────────────────────
export function getPopularMovies(page = 1) {
  return tmdb('/movie/popular', { page });
}

export function getPopularTV(page = 1) {
  return tmdb('/tv/popular', { page });
}

// ── Search ──────────────────────────────────────────────────────────────────
/**
 * Multi-search: returns movies + TV shows combined.
 * @param {string} query
 * @param {object} opts - fetch options (e.g. { signal })
 */
export function searchMulti(query, { signal, page = 1 } = {}) {
  return tmdb('/search/multi', { query, page, include_adult: false }, signal);
}

// ── Details ─────────────────────────────────────────────────────────────────
export function getMovieDetails(id) {
  return tmdb(`/movie/${id}`, { append_to_response: 'credits,videos,watch/providers' });
}

export function getTVDetails(id) {
  return tmdb(`/tv/${id}`, { append_to_response: 'credits,videos,watch/providers' });
}

// ── Genres ──────────────────────────────────────────────────────────────────
export function getMovieGenres() {
  return tmdb('/genre/movie/list');
}

export function getTVGenres() {
  return tmdb('/genre/tv/list');
}

// ── Discover (by genre) ─────────────────────────────────────────────────────
export function discoverMovies({ genreId, page = 1 } = {}) {
  return tmdb('/discover/movie', {
    with_genres: genreId,
    sort_by: 'popularity.desc',
    page,
  });
}

export function discoverTV({ genreId, page = 1 } = {}) {
  return tmdb('/discover/tv', {
    with_genres: genreId,
    sort_by: 'popularity.desc',
    page,
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a responsive image URL for a TMDB path.
 * @param {string|null} path - e.g. "/abc123.jpg"
 * @param {'thumb'|'card'|'poster'|'back_sm'|'back_lg'|'avatar'|'logo'} size
 * @returns {string} Full image URL or placeholder path
 */
export function imgUrl(path, size = 'card') {
  if (!path) return 'assets/placeholder.svg';
  const base = IMG[size.toUpperCase()] ?? IMG.CARD;
  return `${base}${path}`;
}

/**
 * Extract the title from a movie or TV result.
 */
export function getTitle(item) {
  return item.title || item.name || 'Unknown';
}

/**
 * Extract the release year from a movie or TV result.
 */
export function getYear(item) {
  const date = item.release_date || item.first_air_date || '';
  return date ? date.slice(0, 4) : '—';
}

/**
 * Detect media type from a TMDB result object.
 * @returns {'movie'|'tv'}
 */
export function getMediaType(item) {
  return item.media_type === 'tv' || item.first_air_date !== undefined ? 'tv' : 'movie';
}

/**
 * Format a TMDB vote_average to one decimal place.
 */
export function formatRating(vote) {
  if (!vote) return '—';
  return Number(vote).toFixed(1);
}

/**
 * Extract the first YouTube trailer key from a videos response.
 */
export function getTrailerKey(videos) {
  if (!videos?.results?.length) return null;
  const trailer = videos.results.find(
    v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  );
  return trailer?.key ?? null;
}

/**
 * Extract streaming providers for the user's country.
 * @param {object} watchProviders - item['watch/providers']
 * @param {string} country - e.g. 'US', 'GB'
 */
export function getProviders(watchProviders, country = 'US') {
  const results = watchProviders?.results ?? {};
  const region = results[country] ?? results['US'] ?? null;
  if (!region) return [];

  // Combine flatrate + free providers
  const flatrate = region.flatrate ?? [];
  const free = region.free ?? [];
  const all = [...flatrate, ...free];

  // De-dupe by provider_id
  const seen = new Set();
  return all.filter(p => {
    if (seen.has(p.provider_id)) return false;
    seen.add(p.provider_id);
    return true;
  });
}

/**
 * Simple debounce factory.
 * @param {Function} fn
 * @param {number} delay - ms
 */
export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Check whether the API token looks configured.
 */
export function isApiConfigured() {
  return CONFIG.BEARER_TOKEN !== 'YOUR_TMDB_BEARER_TOKEN_HERE' &&
         CONFIG.BEARER_TOKEN.length > 20;
}
