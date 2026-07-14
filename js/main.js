/**
 * main.js — App entry point & orchestrator
 *
 * SETUP: Add your TMDB Bearer Token in js/api.js (CONFIG.BEARER_TOKEN)
 *        Get one free at: https://www.themoviedb.org/settings/api
 */

import {
  getTrending, getPopularMovies, getPopularTV,
  getMovieDetails, getTVDetails,
  getMovieGenres, getTVGenres,
  getTitle, getYear, getMediaType, formatRating,
  imgUrl, getTrailerKey, getProviders, isApiConfigured,
} from './api.js';

import {
  addToWatchlist, removeFromWatchlist,
  isInWatchlist, getWatchlistItem,
  updateStatus, setUserRating, setNotes,
} from './store.js';

import {
  buildCard, buildSkeletons,
  showToast, buildStarRating, buildGenrePills,
  lazyImg, refreshCardButtons,
} from './ui.js';

import { initSearch, renderSearchResults } from './search.js';
import { initWatchlist, openDrawer }       from './watchlist.js';
import { initShare }                        from './share.js';

// ── Hero carousel state ──────────────────────────────────────────────────────
let heroItems   = [];
let heroIndex   = 0;
let heroTimer   = null;
const HERO_INTERVAL = 7000;

// ── Rail scroll helpers ──────────────────────────────────────────────────────

function setupRailNav(prevId, nextId, railId) {
  const rail = document.getElementById(railId);
  const prev = document.getElementById(prevId);
  const next = document.getElementById(nextId);
  if (!rail || !prev || !next) return;

  const SCROLL_AMT = rail.clientWidth * 0.75;
  prev.addEventListener('click', () => rail.scrollBy({ left: -SCROLL_AMT, behavior: 'smooth' }));
  next.addEventListener('click', () => rail.scrollBy({ left:  SCROLL_AMT, behavior: 'smooth' }));
}

// ── Populate a rail with cards ───────────────────────────────────────────────

function fillRail(railId, items) {
  const rail = document.getElementById(railId);
  if (!rail) return;
  rail.innerHTML = '';
  rail.classList.add('stagger-children');

  items.forEach(item => {
    const card = buildCard(item, {
      onCardClick: item => openModal(item),
      onQuickAdd:  (item, btn) => handleQuickAdd(item, btn),
    });
    // Store id+type on card for refreshCardButtons
    card.dataset.id   = item.id;
    card.dataset.type = getMediaType(item);
    rail.appendChild(card);
  });
}

function showRailSkeletons(railId, n = 10) {
  const rail = document.getElementById(railId);
  if (!rail) return;
  rail.innerHTML = '';
  buildSkeletons(n).forEach(s => rail.appendChild(s));
}

// ── Quick Add / Remove ───────────────────────────────────────────────────────

function handleQuickAdd(item, btn) {
  const type   = getMediaType(item);
  const inList = isInWatchlist(item.id, type);

  if (inList) {
    removeFromWatchlist(item.id, type);
    showToast(`Removed "${getTitle(item)}"`, 'info');
    if (btn) { btn.innerHTML = '+'; btn.classList.remove('in-list'); btn.setAttribute('aria-pressed', 'false'); }
  } else {
    addToWatchlist({
      id:         item.id,
      type,
      title:      getTitle(item),
      posterPath: item.poster_path,
      year:       getYear(item),
      rating:     item.vote_average,
    });
    showToast(`Added "${getTitle(item)}" to watchlist 🎬`, 'success');
    if (btn) {
      btn.innerHTML = '✓';
      btn.classList.add('in-list', 'pop');
      btn.setAttribute('aria-pressed', 'true');
      btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
    }
  }

  // Keep all visible card buttons in sync
  refreshAllQuickAdds(item.id, type, !inList);
}

function refreshAllQuickAdds(id, type, nowInList) {
  document.querySelectorAll('.media-card').forEach(card => {
    if (Number(card.dataset.id) !== id || card.dataset.type !== type) return;
    const btn = card.querySelector('.card-quick-add');
    if (!btn) return;
    btn.innerHTML = nowInList ? '✓' : '+';
    btn.classList.toggle('in-list', nowInList);
  });

  // Also update dropdown buttons
  document.querySelectorAll('.dropdown-add-btn').forEach(btn => {
    const item = btn.closest('.dropdown-item');
    if (!item) return;
    if (Number(item.dataset.id) === id && item.dataset.type === type) {
      btn.innerHTML = nowInList ? '✓' : '+';
      btn.classList.toggle('in-list', nowInList);
    }
  });
}

// ── Hero Carousel ────────────────────────────────────────────────────────────

function setHeroItem(item) {
  const type    = getMediaType(item);
  const title   = getTitle(item);
  const year    = getYear(item);
  const rating  = formatRating(item.vote_average);
  const backdrop = imgUrl(item.backdrop_path, 'back_lg');

  // Backdrop
  const backdropEl = document.getElementById('hero-backdrop');
  backdropEl.innerHTML = '';
  const img = document.createElement('img');
  img.className = 'hero-backdrop-img';
  img.src = backdrop;
  img.alt = '';
  img.decoding = 'async';
  const overlay = document.createElement('div');
  overlay.className = 'hero-backdrop-overlay';
  backdropEl.appendChild(img);
  backdropEl.appendChild(overlay);

  // Text
  document.getElementById('hero-title').textContent   = title;
  document.getElementById('hero-overview').textContent = item.overview || '';
  document.getElementById('hero-badge').textContent   = 'Trending';
  document.getElementById('hero-type').textContent    = type === 'movie' ? '🎬 Movie' : '📺 TV Show';
  document.getElementById('hero-rating').innerHTML    = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#f39c12" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
    <span>${rating}</span>
    <span>· ${year}</span>
  `;

  // Buttons
  const detailsBtn = document.getElementById('hero-details-btn');
  const addBtn     = document.getElementById('hero-add-btn');

  detailsBtn.onclick = () => openModal(item);

  const updateAddBtn = () => {
    const inList = isInWatchlist(item.id, type);
    addBtn.textContent = inList ? '✓ In Watchlist' : '+ Add to Watchlist';
    addBtn.classList.toggle('btn--secondary', !inList);
  };
  updateAddBtn();

  addBtn.onclick = () => {
    handleQuickAdd(item, null);
    updateAddBtn();
  };

  // Update dots
  const dots = document.querySelectorAll('.hero-dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === heroIndex));
}

function initHeroCarousel(items) {
  heroItems = items.slice(0, 8);
  heroIndex = 0;

  // Build dots
  const dotsEl = document.getElementById('hero-dots');
  dotsEl.innerHTML = '';
  heroItems.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = `hero-dot${i === 0 ? ' active' : ''}`;
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Featured item ${i + 1}`);
    dot.addEventListener('click', () => {
      heroIndex = i;
      setHeroItem(heroItems[heroIndex]);
      resetHeroTimer();
    });
    dotsEl.appendChild(dot);
  });

  setHeroItem(heroItems[0]);
  startHeroTimer();
}

function startHeroTimer() {
  clearInterval(heroTimer);
  heroTimer = setInterval(() => {
    heroIndex = (heroIndex + 1) % heroItems.length;
    setHeroItem(heroItems[heroIndex]);
  }, HERO_INTERVAL);
}

function resetHeroTimer() {
  clearInterval(heroTimer);
  startHeroTimer();
}

// ── Detail Modal ─────────────────────────────────────────────────────────────

let _currentModalItem = null;

export async function openModal(item) {
  const overlay   = document.getElementById('modal-overlay');
  const modal     = document.getElementById('modal');
  if (!overlay) return;

  // Determine type (may be a store item without media_type)
  const type  = item.type || getMediaType(item);
  const id    = item.id;
  const title = getTitle(item);

  // Open overlay immediately with partial data
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  modal.querySelector('.modal-close').focus();

  // Show placeholder poster
  const posterEl = document.getElementById('modal-poster');
  const backdropEl = document.getElementById('modal-backdrop');
  posterEl.src   = imgUrl(item.posterPath || item.poster_path, 'poster');
  backdropEl.src = imgUrl(item.backdrop_path, 'back_lg');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-type-badge').textContent = type === 'movie' ? '🎬 Movie' : '📺 TV Show';
  document.getElementById('modal-type-badge').className   = `modal-type-badge modal-type-badge--${type}`;

  // Fetch full details
  try {
    const details = type === 'movie'
      ? await getMovieDetails(id)
      : await getTVDetails(id);

    _currentModalItem = { ...details, type };
    renderModalDetails(details, type);
  } catch (err) {
    console.error('Modal details failed:', err);
  }
}

function renderModalDetails(details, type) {
  const title   = getTitle(details);
  const year    = getYear(details);
  const rating  = formatRating(details.vote_average);

  // Poster & backdrop
  document.getElementById('modal-poster').src   = imgUrl(details.poster_path, 'poster');
  document.getElementById('modal-backdrop').src = imgUrl(details.backdrop_path, 'back_lg');

  // Title & badge
  document.getElementById('modal-title').textContent = title;

  // Meta row
  const runtime = type === 'movie'
    ? (details.runtime ? `${details.runtime} min` : '')
    : (details.number_of_seasons ? `${details.number_of_seasons} season${details.number_of_seasons > 1 ? 's' : ''}` : '');

  document.getElementById('modal-meta-row').innerHTML = `
    <span>⭐ ${rating}</span>
    <span class="modal-meta-dot"></span>
    <span>${year}</span>
    ${runtime ? `<span class="modal-meta-dot"></span><span>${runtime}</span>` : ''}
    ${details.vote_count ? `<span class="modal-meta-dot"></span><span>${details.vote_count.toLocaleString()} votes</span>` : ''}
  `;

  // Genres
  const genresEl = document.getElementById('modal-genres');
  genresEl.innerHTML = '';
  (details.genres ?? []).forEach(g => {
    const tag = document.createElement('span');
    tag.className = 'modal-genre-tag';
    tag.textContent = g.name;
    genresEl.appendChild(tag);
  });

  // Overview
  document.getElementById('modal-overview').textContent = details.overview || '';

  // Streaming providers
  const countryCode = navigator.language?.slice(-2).toUpperCase() || 'US';
  const providers   = getProviders(details['watch/providers'], countryCode);
  const streamingEl = document.getElementById('modal-streaming');
  const logosEl     = document.getElementById('streaming-logos');
  if (providers.length) {
    logosEl.innerHTML = '';
    providers.forEach(p => {
      const logoUrl = imgUrl(p.logo_path, 'logo');
      const img = document.createElement('img');
      img.className  = 'streaming-logo';
      img.src        = logoUrl;
      img.alt        = p.provider_name;
      img.title      = p.provider_name;
      img.loading    = 'lazy';
      logosEl.appendChild(img);
    });
    streamingEl.hidden = false;
  } else {
    streamingEl.hidden = true;
  }

  // Cast
  const cast = (details.credits?.cast ?? []).slice(0, 15);
  const castEl = document.getElementById('modal-cast');
  castEl.innerHTML = '';
  cast.forEach(person => {
    const member = document.createElement('div');
    member.className = 'cast-member';
    const avatar = lazyImg(imgUrl(person.profile_path, 'avatar'), person.name, 'cast-avatar');
    const nameEl = document.createElement('p');
    nameEl.className = 'cast-name';
    nameEl.textContent = person.name;
    const roleEl = document.createElement('p');
    roleEl.className = 'cast-role';
    roleEl.textContent = person.character || '';
    member.append(avatar, nameEl, roleEl);
    castEl.appendChild(member);
  });

  // Trailer
  const trailerKey     = getTrailerKey(details.videos);
  const trailerSection = document.getElementById('modal-trailer-section');
  const trailerLink    = document.getElementById('modal-trailer-link');
  const trailerImg     = document.getElementById('modal-trailer-img');
  if (trailerKey) {
    trailerImg.src       = `https://img.youtube.com/vi/${trailerKey}/mqdefault.jpg`;
    trailerLink.href     = `https://www.youtube.com/watch?v=${trailerKey}`;
    trailerSection.hidden = false;
  } else {
    trailerSection.hidden = true;
  }

  // Watchlist controls
  renderModalWatchlistControls(details.id, type);
}

function renderModalWatchlistControls(id, type) {
  const statusSelect = document.getElementById('modal-status-select');
  const notesEl      = document.getElementById('modal-notes');
  const starContainer = document.getElementById('modal-star-rating');

  const wlItem = getWatchlistItem(id, type);

  // Status
  statusSelect.value = wlItem?.status ?? '';

  statusSelect.onchange = () => {
    const newStatus = statusSelect.value;
    if (!newStatus) {
      removeFromWatchlist(id, type);
      showToast('Removed from watchlist', 'info');
    } else if (isInWatchlist(id, type)) {
      updateStatus(id, type, newStatus);
      showToast(`Status: ${newStatus.replace(/_/g, ' ')}`, 'success');
    } else {
      // Auto-add when status is chosen
      const item = _currentModalItem;
      addToWatchlist({
        id,
        type,
        title:      getTitle(item),
        posterPath: item.poster_path,
        year:       getYear(item),
        rating:     item.vote_average,
      });
      updateStatus(id, type, newStatus);
      showToast(`Added to watchlist`, 'success');
    }
    refreshAllQuickAdds(id, type, !!statusSelect.value);
  };

  // Notes
  notesEl.value = wlItem?.notes ?? '';
  notesEl.oninput = debounceNotes(() => {
    if (isInWatchlist(id, type)) setNotes(id, type, notesEl.value);
  });

  // Star rating
  buildStarRating(starContainer, wlItem?.userRating ?? null, rating => {
    if (isInWatchlist(id, type)) setUserRating(id, type, rating);
    else showToast('Add to your watchlist first to rate.', 'info');
  });
}

// Simple debounce for notes textarea
function debounceNotes(fn, delay = 600) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay?.classList.remove('open');
  overlay?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  _currentModalItem = null;
}

// ── Genre filter ─────────────────────────────────────────────────────────────

async function loadGenres() {
  try {
    const [movieGenres, tvGenres] = await Promise.all([getMovieGenres(), getTVGenres()]);

    // Merge & de-dupe genres by name
    const allGenres = [...(movieGenres.genres ?? []), ...(tvGenres.genres ?? [])];
    const seen = new Set();
    const unique = allGenres.filter(g => {
      if (seen.has(g.name)) return false;
      seen.add(g.name);
      return true;
    });

    buildGenrePills(unique, genreId => {
      // Reload trending with genre filter
      if (!genreId) {
        loadDiscover(null);
      } else {
        loadDiscover(genreId);
      }
    });
  } catch (err) {
    console.error('Genres failed:', err);
  }
}

async function loadDiscover(genreId) {
  // When genre is selected, repopulate the trending rail with discovered content
  const rail = document.getElementById('trending-rail');
  if (!rail) return;
  showRailSkeletons('trending-rail', 10);

  try {
    const { discoverMovies, discoverTV } = await import('./api.js');
    const [movies, tv] = await Promise.all([
      discoverMovies({ genreId }),
      discoverTV({ genreId }),
    ]);

    // Interleave results
    const combined = [];
    const ml = movies.results ?? [];
    const tl = tv.results ?? [];
    const max = Math.max(ml.length, tl.length);
    for (let i = 0; i < max; i++) {
      if (ml[i]) combined.push({ ...ml[i], media_type: 'movie' });
      if (tl[i]) combined.push({ ...tl[i], media_type: 'tv' });
    }

    fillRail('trending-rail', combined.slice(0, 20));
  } catch (err) {
    console.error('Discover failed:', err);
  }
}

// ── API key warning ──────────────────────────────────────────────────────────

function showApiKeyWarning() {
  const hero = document.getElementById('hero-content');
  if (hero) {
    hero.innerHTML = `
      <div style="padding: var(--space-lg); max-width: 560px;">
        <h1 style="font-size:1.5rem; margin-bottom: var(--space-md); color: var(--color-accent);">
          ⚙️ One quick setup step
        </h1>
        <p style="color: var(--color-text-muted); margin-bottom: var(--space-md);">
          To use CineList you need a free TMDB API key.
        </p>
        <ol style="color: var(--color-text-muted); padding-left: var(--space-lg); line-height: 2;">
          <li>Go to <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" style="color: var(--color-accent);">themoviedb.org/settings/api</a></li>
          <li>Create a free account and request an API key</li>
          <li>Copy your <strong style="color:var(--color-text);">API Read Access Token</strong> (starts with "ey…")</li>
          <li>Open <strong style="color:var(--color-text);">js/api.js</strong> and paste it into <code style="color:var(--color-accent-tv);">CONFIG.BEARER_TOKEN</code></li>
        </ol>
      </div>
    `;
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function boot() {
  // Check API config first
  if (!isApiConfigured()) {
    showApiKeyWarning();
    initWatchlist(item => openModal(item));
    initShare();
    return;
  }

  // Skeletons for immediate feedback
  showRailSkeletons('trending-rail', 10);
  showRailSkeletons('movies-rail',   10);
  showRailSkeletons('tv-rail',        10);

  // Parallel data fetching
  const [trendingData, popularMoviesData, popularTVData] = await Promise.allSettled([
    getTrending('all', 'week'),
    getPopularMovies(),
    getPopularTV(),
  ]);

  // Hero & trending
  if (trendingData.status === 'fulfilled') {
    const results = (trendingData.value.results ?? []).filter(
      r => r.backdrop_path && (r.media_type === 'movie' || r.media_type === 'tv')
    );
    initHeroCarousel(results);
    fillRail('trending-rail', results);
  }

  // Popular movies
  if (popularMoviesData.status === 'fulfilled') {
    const movies = (popularMoviesData.value.results ?? []).map(m => ({ ...m, media_type: 'movie' }));
    fillRail('movies-rail', movies);
  }

  // Popular TV
  if (popularTVData.status === 'fulfilled') {
    const tv = (popularTVData.value.results ?? []).map(t => ({ ...t, media_type: 'tv' }));
    fillRail('tv-rail', tv);
  }

  // Genres
  loadGenres();

  // Rail nav buttons
  setupRailNav('trending-prev', 'trending-next', 'trending-rail');
  setupRailNav('movies-prev',   'movies-next',   'movies-rail');
  setupRailNav('tv-prev',       'tv-next',        'tv-rail');
}

// ── App Init ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Modal close handlers
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Search
  initSearch({
    onSelect: item => openModal(item),
    onQuickAdd: (item, btn) => handleQuickAdd(item, btn),
    onSeeAll: (query, results) => {
      // Show full results section
      const section = document.getElementById('search-results-section');
      const grid    = document.getElementById('search-results-grid');
      if (!section || !grid) return;
      section.hidden = false;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      renderSearchResults(grid, results, {
        onCardClick: item => openModal(item),
        onQuickAdd:  (item, btn) => handleQuickAdd(item, btn),
      });
    },
  });

  // Clear search
  document.getElementById('btn-clear-search')?.addEventListener('click', () => {
    const section = document.getElementById('search-results-section');
    const input   = document.getElementById('search-input');
    if (section) section.hidden = true;
    if (input)   input.value = '';
  });

  // Watchlist
  initWatchlist(item => {
    // Item from watchlist may not have media_type; we stored type directly
    openModal(item);
  });

  // Sharing
  initShare();

  // Bootstrap data
  boot().catch(err => {
    console.error('Boot failed:', err);
    showApiKeyWarning();
  });
});
