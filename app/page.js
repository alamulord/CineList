import { getTrending, getPopularMovies, getPopularTV, getMovieGenres, getTVGenres, getMediaType } from '@/lib/tmdb';
import HomePage from '@/components/HomePage';

export default async function Page() {
  // All fetches happen server-side — token never leaves the server
  const [trending, movies, tv, movieGenres, tvGenres] = await Promise.allSettled([
    getTrending('all', 'week'),
    getPopularMovies(),
    getPopularTV(),
    getMovieGenres(),
    getTVGenres(),
  ]);

  const trendingItems = (trending.value?.results ?? [])
    .filter(r => r.backdrop_path && (r.media_type === 'movie' || r.media_type === 'tv'));

  const movieItems = (movies.value?.results ?? []).map(m => ({ ...m, media_type: 'movie' }));
  const tvItems    = (tv.value?.results    ?? []).map(t => ({ ...t, media_type: 'tv' }));

  // Merge & de-dupe genres
  const allGenres = [...(movieGenres.value?.genres ?? []), ...(tvGenres.value?.genres ?? [])];
  const seen      = new Set();
  const genres    = allGenres.filter(g => { if (seen.has(g.name)) return false; seen.add(g.name); return true; });

  return (
    <HomePage
      trendingItems={trendingItems}
      movieItems={movieItems}
      tvItems={tvItems}
      genres={genres.slice(0, 15)}
    />
  );
}
