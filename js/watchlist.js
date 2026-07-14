/**
 * watchlist.js — Watchlist drawer UI controller
 * Manages rendering, tabs, sorting, and progress bar.
 */

import {
  getWatchlist, getByStatus, getCounts, getProgress,
  cycleStatus, removeFromWatchlist, sortList, clearWatched,
  STATUS_LABEL,
} from './store.js';
import { buildWatchlistItem, showToast } from './ui.js';

let _currentTab   = 'all';
let _currentSort  = 'addedAt';
let _onItemClick  = null;  // callback to open detail modal

// ── Drawer open/close ────────────────────────────────────────────────────────

export function openDrawer() {
  const drawer  = document.getElementById('watchlist-drawer');
  const overlay = document.getElementById('drawer-overlay');
  const toggle  = document.getElementById('btn-watchlist-toggle');
  if (!drawer) return;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  toggle?.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  overlay?.addEventListener('click', closeDrawer, { once: true });
}

export function closeDrawer() {
  const drawer = document.getElementById('watchlist-drawer');
  const toggle = document.getElementById('btn-watchlist-toggle');
  if (!drawer) return;
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  toggle?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

// ── Render watchlist items ───────────────────────────────────────────────────

function renderItems() {
  const container = document.getElementById('watchlist-items');
  const empty     = document.getElementById('watchlist-empty');
  if (!container) return;

  let items = getByStatus(_currentTab);
  items = sortList(items, _currentSort);

  // Clear previous (keep empty state el)
  [...container.children].forEach(c => {
    if (c !== empty) c.remove();
  });

  if (!items.length) {
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  items.forEach(wlItem => {
    const el = buildWatchlistItem(wlItem, {
      onClick: item => _onItemClick?.(item),
      onCycleStatus: (id, type, el) => {
        const newStatus = cycleStatus(id, type);
        showToast(`${STATUS_LABEL[newStatus]}`, 'info', 2000);
        el.remove(); // will re-render on watchlist:change
      },
      onRemove: (id, type, el) => {
        removeFromWatchlist(id, type);
        el.style.animation = 'toastOut 0.2s ease both';
        el.addEventListener('animationend', () => el.remove());
        showToast('Removed from watchlist', 'info', 2000);
      },
    });
    container.appendChild(el);
  });
}

// ── Update tab counts & badge ────────────────────────────────────────────────

export function updateCounts() {
  const counts = getCounts();

  const badge = document.getElementById('watchlist-count-badge');
  if (badge) {
    badge.textContent = counts.all;
    badge.classList.toggle('visible', counts.all > 0);
  }

  const tabCountAll      = document.getElementById('tab-count-all');
  const tabCountWant     = document.getElementById('tab-count-want');
  const tabCountWatching = document.getElementById('tab-count-watching');
  const tabCountWatched  = document.getElementById('tab-count-watched');

  if (tabCountAll)      tabCountAll.textContent      = counts.all;
  if (tabCountWant)     tabCountWant.textContent     = counts.want_to_watch;
  if (tabCountWatching) tabCountWatching.textContent = counts.watching;
  if (tabCountWatched)  tabCountWatched.textContent  = counts.watched;
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function updateProgress() {
  const { total, watched, pct } = getProgress();
  const fill  = document.getElementById('progress-bar-fill');
  const label = document.getElementById('progress-label');
  if (fill)  {
    fill.style.width = `${pct}%`;
    fill.setAttribute('aria-valuenow', pct);
  }
  if (label) label.textContent = `${watched} of ${total} watched · ${pct}%`;
}

// ── Full refresh ─────────────────────────────────────────────────────────────

export function refreshWatchlist() {
  updateCounts();
  updateProgress();
  renderItems();

  // Animate badge on change
  const badge = document.getElementById('watchlist-count-badge');
  badge?.classList.remove('bounce');
  void badge?.offsetWidth; // reflow
  badge?.classList.add('bounce');
}

// ── Init ─────────────────────────────────────────────────────────────────────

/**
 * Wire up the watchlist drawer: tabs, sort, clear-watched, open/close.
 * @param {Function} onItemClick - callback when a watchlist item is clicked (open modal)
 */
export function initWatchlist(onItemClick) {
  _onItemClick = onItemClick;

  // Open / close buttons
  document.getElementById('btn-watchlist-toggle')?.addEventListener('click', openDrawer);
  document.getElementById('btn-close-watchlist')?.addEventListener('click', closeDrawer);

  // Escape key closes
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Tabs
  document.querySelectorAll('.wl-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.wl-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      _currentTab = tab.dataset.status;
      renderItems();
    });
  });

  // Sort
  const sortSelect = document.getElementById('sort-select');
  sortSelect?.addEventListener('change', () => {
    _currentSort = sortSelect.value;
    renderItems();
  });

  // Clear watched
  document.getElementById('btn-clear-watched')?.addEventListener('click', () => {
    const counts = getCounts();
    if (!counts.watched) {
      showToast('No watched items to clear.', 'info');
      return;
    }
    clearWatched();
    showToast(`Cleared ${counts.watched} watched item${counts.watched > 1 ? 's' : ''}`, 'success');
  });

  // React to store changes
  window.addEventListener('watchlist:change', () => refreshWatchlist());

  // Initial render
  refreshWatchlist();
}
