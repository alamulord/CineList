/**
 * Client-side API — calls /api/tmdb/* proxy (token stays server-side)
 */

const PROXY = '/api/tmdb';
export const IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export const IMG_SIZE = {
  THUMB: `${IMAGE_BASE}w185`,
  CARD:  `${IMAGE_BASE}w342`,
  POSTER:`${IMAGE_BASE}w500`,
  BACK_LG:`${IMAGE_BASE}w1280`,
  AVATAR:`${IMAGE_BASE}w185`,
  LOGO:  `${IMAGE_BASE}original`,
};

async function api(path, params = {}, signal) {
  const url = new URL(`${PROXY}/${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const getTrending      = (t='all', w='week') => api(`trending/${t}/${w}`);
export const getPopularMovies = (page=1)            => api('movie/popular', { page });
export const getPopularTV     = (page=1)            => api('tv/popular',    { page });
export const getMovieGenres   = ()                  => api('genre/movie/list');
export const getTVGenres      = ()                  => api('genre/tv/list');
export const getMovieDetails  = (id)                => api(`movie/${id}`, { append_to_response: 'credits,videos,watch/providers' });
export const getTVDetails     = (id)                => api(`tv/${id}`,    { append_to_response: 'credits,videos,watch/providers' });
export const searchMulti      = (query, opts={})    => api('search/multi', { query, page: 1, include_adult: false }, opts.signal);
export const discoverMovies   = ({genreId,page=1}={}) => api('discover/movie', { with_genres: genreId, sort_by:'popularity.desc', page });
export const discoverTV       = ({genreId,page=1}={}) => api('discover/tv',    { with_genres: genreId, sort_by:'popularity.desc', page });

// ── Shared helpers ────────────────────────────────────────────────────────────
export function imgUrl(path, size='CARD') {
  if (!path) return '/placeholder.svg';
  return `${IMG_SIZE[size] ?? IMG_SIZE.CARD}${path}`;
}
export const getTitle     = i => i?.title || i?.name || 'Unknown';
export const getYear      = i => (i?.release_date || i?.first_air_date || '').slice(0,4) || '—';
export const getMediaType = i => (i?.media_type === 'tv' || i?.first_air_date !== undefined) ? 'tv' : 'movie';
export const formatRating = v => v ? Number(v).toFixed(1) : '—';

export function getTrailerKey(videos) {
  return videos?.results?.find(v => v.site==='YouTube' && (v.type==='Trailer'||v.type==='Teaser'))?.key ?? null;
}

export function getProviders(watchProviders, country='US') {
  const region = (watchProviders?.results ?? {})[country] ?? (watchProviders?.results ?? {})['US'] ?? null;
  if (!region) return [];
  const seen = new Set();
  return [...(region.flatrate??[]),...(region.free??[])].filter(p => {
    if (seen.has(p.provider_id)) return false; seen.add(p.provider_id); return true;
  });
}

export function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); };
}
