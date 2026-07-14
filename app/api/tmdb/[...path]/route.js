/**
 * app/api/tmdb/[...path]/route.js
 *
 * Proxy all TMDB requests through Next.js server — the bearer token
 * lives only in .env.local and is never exposed to the browser.
 *
 * Client calls: fetch('/api/tmdb/trending/all/week')
 * This route calls: https://api.themoviedb.org/3/trending/all/week
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function GET(request, { params }) {
  const token = process.env.TMDB_BEARER_TOKEN;
  if (!token) {
    return Response.json(
      { error: 'TMDB_BEARER_TOKEN not configured. Add it to .env.local' },
      { status: 500 }
    );
  }

  // Rebuild the TMDB URL from the path segments + original query string
  const path         = (await params).path.join('/');
  const searchParams = new URL(request.url).searchParams.toString();
  const tmdbUrl      = `${TMDB_BASE}/${path}${searchParams ? `?${searchParams}` : ''}`;

  try {
    const res = await fetch(tmdbUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 }, // Cache 1 hour in Next.js data cache
    });

    const data = await res.json();

    return Response.json(data, {
      status: res.status,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    return Response.json({ error: 'Failed to fetch from TMDB' }, { status: 502 });
  }
}
