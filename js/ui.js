/**
 * ui.js — DOM rendering helpers
 * Creates and returns DOM elements for cards, watchlist items, modals, toasts.
 */

import { imgUrl, getTitle, getYear, formatRating } from './api.js';
import { isInWatchlist, STATUS_LABEL } from './store.js';

// ── Lazy image observer ──────────────────────────────────────────────────────
const imgObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const img = entry.target;
    if (img.dataset.src) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
    imgObserver.unobserve(img);
  });
}, { rootMargin: '200px' });

/**
 * Create an <img> that lazy-loads via IntersectionObserver.
 */
export function lazyImg(src, alt, className = '') {
  const img = document.createElement('img');
  img.alt = alt;
  if (className) img.className = className;
  img.decoding = 'async';

  if (src && src !== 'assets/placeholder.svg') {
    img.dataset.src = src;
    img.src = 'assets/placeholder.svg';
    imgObserver.observe(img);
  } else {
    img.src = src || 'assets/placeholder.svg';
  }

  img.addEventListener('error', () => { img.src = 'assets/placeholder.svg'; });
  return img;
}

// ── Media Card ───────────────────────────────────────────────────────────────

/**
 * Build a media card element.
 * @param {object} item - TMDB result object
 * @param {object} opts
 * @param {Function} opts.onCardClick   - (item) => void
 * @param {Function} opts.onQuickAdd    - (item, btn) => void
 */
export function buildCard(item, { onCardClick, onQuickAdd } = {}) {
  const type    = item.media_type === 'tv' || item.first_air_date !== undefined ? 'tv' : 'movie';
  const title   = getTitle(item);
  const year    = getYear(item);
  const rating  = formatRating(item.vote_average);
  const poster  = imgUrl(item.poster_path, 'card');
  const inList  = isInWatchlist(item.id, type);

  const card = document.createElement('article');
  card.className = 'media-card';
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', `${title} (${year})`);
  card.tabIndex = 0;

  // Type badge
  const typeBadge = document.createElement('span');
  typeBadge.className = `card-type-badge card-type-badge--${type}`;
  typeBadge.textContent = type === 'movie' ? '🎬' : '📺';
  typeBadge.setAttribute('aria-label', type === 'movie' ? 'Movie' : 'TV Show');

  // Poster
  const posterWrap = document.createElement('div');
  posterWrap.className = 'card-poster-wrap';

  const img = lazyImg(poster, title, 'card-poster');
  posterWrap.appendChild(typeBadge);
  posterWrap.appendChild(img);

  // Overlay with overview
  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  const overviewEl = document.createElement('p');
  overviewEl.className = 'card-overlay-overview';
  overviewEl.textContent = item.overview || '';
  overlay.appendChild(overviewEl);
  posterWrap.appendChild(overlay);

  // Quick add button
  const quickAdd = document.createElement('button');
  quickAdd.className = `card-quick-add${inList ? ' in-list' : ''}`;
  quickAdd.innerHTML = inList ? '✓' : '+';
  quickAdd.setAttribute('aria-label', inList ? 'Remove from watchlist' : 'Add to watchlist');
  quickAdd.setAttribute('aria-pressed', String(inList));
  quickAdd.addEventListener('click', e => {
    e.stopPropagation();
    onQuickAdd?.(item, quickAdd);
  });
  posterWrap.appendChild(quickAdd);

  // Status badge (if in list)
  const existing = isInWatchlist(item.id, type);
  if (existing) {
    const wlItem = window.__store?.getWatchlistItem?.(item.id, type);
    if (wlItem) {
      const statusBadge = document.createElement('span');
      statusBadge.className = `card-status-badge card-status-badge--${wlItem.status.replace('_to_', '_')}`;
      statusBadge.textContent = STATUS_LABEL[wlItem.status];
      posterWrap.appendChild(statusBadge);
    }
  }

  // Footer
  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const titleEl = document.createElement('p');
  titleEl.className = 'card-title';
  titleEl.textContent = title;

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.innerHTML = `
    <span class="card-year">${year}</span>
    <span class="card-rating" aria-label="Rating ${rating} out of 10">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      ${rating}
    </span>
  `;

  footer.appendChild(titleEl);
  footer.appendChild(meta);

  card.appendChild(posterWrap);
  card.appendChild(footer);

  // Open detail modal
  const open = () => onCardClick?.(item);
  card.addEventListener('click', open);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });

  return card;
}

/** Build N skeleton placeholder cards. */
export function buildSkeletons(n = 8) {
  return Array.from({ length: n }, () => {
    const card = document.createElement('article');
    card.className = 'media-card skeleton';
    card.setAttribute('aria-hidden', 'true');
    const wrap = document.createElement('div');
    wrap.className = 'card-poster-wrap';
    card.appendChild(wrap);
    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.innerHTML = '<p class="card-title">&nbsp;</p><div class="card-meta">&nbsp;</div>';
    card.appendChild(footer);
    return card;
  });
}

// ── Watchlist Row Item ────────────────────────────────────────────────────────

/**
 * Build a compact watchlist row item.
 * @param {object} wlItem - item from store
 * @param {object} opts
 * @param {Function} opts.onClick       - open detail modal
 * @param {Function} opts.onCycleStatus - cycle status
 * @param {Function} opts.onRemove      - remove item
 */
export function buildWatchlistItem(wlItem, { onClick, onCycleStatus, onRemove } = {}) {
  const { id, type, title, posterPath, year, rating, status, userRating } = wlItem;
  const poster = imgUrl(posterPath, 'thumb');

  const el = document.createElement('div');
  el.className = 'wl-item';
  el.setAttribute('role', 'listitem');
  el.dataset.id = id;
  el.dataset.type = type;

  const thumb = lazyImg(poster, title, 'wl-thumb');
  el.appendChild(thumb);

  const info = document.createElement('div');
  info.className = 'wl-info';

  const titleEl = document.createElement('p');
  titleEl.className = 'wl-title';
  titleEl.textContent = title;

  const meta = document.createElement('div');
  meta.className = 'wl-meta';

  const dot = document.createElement('span');
  const dotClass = status === 'want_to_watch' ? 'want' : status === 'watching' ? 'watching' : 'watched';
  dot.className = `wl-status-dot wl-status-dot--${dotClass}`;
  dot.setAttribute('aria-hidden', 'true');

  const statusLabel = document.createElement('span');
  statusLabel.textContent = STATUS_LABEL[status];

  const yearEl = document.createElement('span');
  yearEl.textContent = year ? `· ${year}` : '';

  meta.append(dot, statusLabel, yearEl);

  if (userRating) {
    const ratingEl = document.createElement('span');
    ratingEl.className = 'wl-user-rating';
    ratingEl.innerHTML = `★ ${userRating}/10`;
    meta.appendChild(ratingEl);
  }

  info.appendChild(titleEl);
  info.appendChild(meta);
  el.appendChild(info);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'wl-actions';

  const cycleBtn = document.createElement('button');
  cycleBtn.className = 'wl-action-btn';
  cycleBtn.title = 'Cycle status';
  cycleBtn.setAttribute('aria-label', `Cycle watching status (currently: ${STATUS_LABEL[status]})`);
  cycleBtn.innerHTML = '⟳';
  cycleBtn.addEventListener('click', e => { e.stopPropagation(); onCycleStatus?.(id, type, el); });

  const delBtn = document.createElement('button');
  delBtn.className = 'wl-action-btn wl-action-btn--delete';
  delBtn.title = 'Remove from watchlist';
  delBtn.setAttribute('aria-label', `Remove ${title} from watchlist`);
  delBtn.innerHTML = '✕';
  delBtn.addEventListener('click', e => { e.stopPropagation(); onRemove?.(id, type, el); });

  actions.appendChild(cycleBtn);
  actions.appendChild(delBtn);
  el.appendChild(actions);

  // Open modal on click (not on button)
  el.addEventListener('click', () => onClick?.(wlItem));

  return el;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let _toastTimeout = {};

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration - ms
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icons[type]}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-dismiss" aria-label="Dismiss notification">✕</button>
  `;

  const dismiss = () => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast-dismiss').addEventListener('click', dismiss);
  container.appendChild(toast);

  const id = Symbol();
  _toastTimeout[id] = setTimeout(dismiss, duration);
}

// ── Star Rating UI ────────────────────────────────────────────────────────────

/**
 * Populate the interactive star rating inside the modal.
 * @param {HTMLElement} container
 * @param {number|null} currentRating
 * @param {Function} onChange - (rating) => void
 */
export function buildStarRating(container, currentRating, onChange) {
  container.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `star${i <= (currentRating ?? 0) ? ' active' : ''}`;
    btn.textContent = '★';
    btn.setAttribute('aria-label', `Rate ${i} out of 10`);
    btn.setAttribute('aria-pressed', String(i === currentRating));

    btn.addEventListener('click', () => {
      const newRating = i === currentRating ? null : i; // clicking same → clear
      onChange?.(newRating);
      buildStarRating(container, newRating, onChange);
    });

    btn.addEventListener('mouseenter', () => {
      container.querySelectorAll('.star').forEach((s, idx) => {
        s.classList.toggle('active', idx < i);
      });
    });

    container.appendChild(btn);
  }

  container.addEventListener('mouseleave', () => {
    container.querySelectorAll('.star').forEach((s, idx) => {
      s.classList.toggle('active', idx < (currentRating ?? 0));
    });
  });
}

// ── Genre Pills ───────────────────────────────────────────────────────────────

/**
 * Build genre filter pills.
 * @param {Array<{id,name}>} genres
 * @param {Function} onSelect - (genreId|null) => void
 */
export function buildGenrePills(genres, onSelect) {
  const container = document.getElementById('genre-pills');
  if (!container) return;

  container.innerHTML = '';

  // "All" pill
  const allPill = document.createElement('button');
  allPill.className = 'genre-pill active';
  allPill.textContent = 'All';
  allPill.setAttribute('role', 'listitem');
  allPill.addEventListener('click', () => {
    container.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
    allPill.classList.add('active');
    onSelect(null);
  });
  container.appendChild(allPill);

  genres.slice(0, 15).forEach(g => {
    const pill = document.createElement('button');
    pill.className = 'genre-pill';
    pill.textContent = g.name;
    pill.setAttribute('role', 'listitem');
    pill.addEventListener('click', () => {
      container.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      onSelect(g.id);
    });
    container.appendChild(pill);
  });
}

// ── Utility: update the quick-add button state on all visible cards ──────────

export function refreshCardButtons() {
  document.querySelectorAll('.media-card').forEach(card => {
    const btn = card.querySelector('.card-quick-add');
    if (!btn) return;
    const id   = Number(card.dataset?.id);
    const type = card.dataset?.type;
    if (!id || !type) return;
    const inList = isInWatchlist(id, type);
    btn.innerHTML = inList ? '✓' : '+';
    btn.className = `card-quick-add${inList ? ' in-list' : ''}`;
  });
}
