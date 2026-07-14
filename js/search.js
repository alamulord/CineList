/**
 * search.js — Debounced search with live dropdown and full results page
 */

import { searchMulti, imgUrl, getTitle, getYear, getMediaType, debounce } from './api.js';
import { isInWatchlist } from './store.js';
import { buildCard, buildSkeletons } from './ui.js';

let abortController = null;

// ── Dropdown rendering ───────────────────────────────────────────────────────

function buildDropdownItem(item, { onSelect, onQuickAdd }) {
  const type   = getMediaType(item);
  const title  = getTitle(item);
  const year   = getYear(item);
  const poster = imgUrl(item.poster_path, 'thumb');
  const inList = isInWatchlist(item.id, type);

  const btn = document.createElement('div');
  btn.className = 'dropdown-item';
  btn.setAttribute('role', 'option');
  btn.setAttribute('aria-selected', 'false');
  btn.dataset.id   = item.id;
  btn.dataset.type = type;

  const thumb = document.createElement('img');
  thumb.className = 'dropdown-thumb';
  thumb.src = poster;
  thumb.alt = title;
  thumb.loading = 'lazy';
  thumb.onerror = () => { thumb.src = 'assets/placeholder.svg'; };

  const info = document.createElement('div');
  info.className = 'dropdown-info';
  info.innerHTML = `
    <div class="dropdown-title">${title}</div>
    <div class="dropdown-meta">${type === 'movie' ? '🎬' : '📺'} ${year}</div>
  `;

  const addBtn = document.createElement('button');
  addBtn.className = `dropdown-add-btn${inList ? ' in-list' : ''}`;
  addBtn.innerHTML = inList ? '✓' : '+';
  addBtn.setAttribute('aria-label', inList ? 'In watchlist' : 'Add to watchlist');
  addBtn.addEventListener('click', e => {
    e.stopPropagation();
    onQuickAdd?.(item, addBtn);
  });

  btn.appendChild(thumb);
  btn.appendChild(info);
  btn.appendChild(addBtn);

  btn.addEventListener('click', () => onSelect?.(item));

  return btn;
}

function renderDropdown(dropdown, results, query, { onSelect, onQuickAdd, onSeeAll }) {
  dropdown.innerHTML = '';

  const items = results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');

  if (!items.length) {
    dropdown.innerHTML = `<p class="dropdown-empty">No results for "<strong>${query}</strong>"</p>`;
    return;
  }

  const movies = items.filter(i => i.media_type === 'movie').slice(0, 4);
  const tv     = items.filter(i => i.media_type === 'tv').slice(0, 4);

  if (movies.length) {
    const hdr = document.createElement('div');
    hdr.className = 'dropdown-section-header';
    hdr.textContent = 'Movies';
    dropdown.appendChild(hdr);
    movies.forEach(m => dropdown.appendChild(buildDropdownItem(m, { onSelect, onQuickAdd })));
  }

  if (tv.length) {
    const hdr = document.createElement('div');
    hdr.className = 'dropdown-section-header';
    hdr.textContent = 'TV Shows';
    dropdown.appendChild(hdr);
    tv.forEach(t => dropdown.appendChild(buildDropdownItem(t, { onSelect, onQuickAdd })));
  }

  // "See all" footer
  if (items.length > 5) {
    const footer = document.createElement('div');
    footer.className = 'dropdown-see-all';
    const link = document.createElement('button');
    link.textContent = `See all results for "${query}"`;
    link.addEventListener('click', () => onSeeAll?.());
    footer.appendChild(link);
    dropdown.appendChild(footer);
  }
}

// ── Keyboard navigation inside dropdown ─────────────────────────────────────

function setupKeyboardNav(input, dropdown) {
  input.addEventListener('keydown', e => {
    const items = dropdown.querySelectorAll('.dropdown-item');
    if (!items.length) return;

    const focused = dropdown.querySelector('[aria-selected="true"]');
    let idx = focused ? [...items].indexOf(focused) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (focused) focused.setAttribute('aria-selected', 'false');
      idx = (idx + 1) % items.length;
      items[idx].setAttribute('aria-selected', 'true');
      items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (focused) focused.setAttribute('aria-selected', 'false');
      idx = (idx - 1 + items.length) % items.length;
      items[idx].setAttribute('aria-selected', 'true');
      items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (focused) {
        e.preventDefault();
        focused.click();
      }
    } else if (e.key === 'Escape') {
      closeDropdown(input, dropdown);
    }
  });
}

function openDropdown(dropdown) {
  dropdown.removeAttribute('hidden');
}

function closeDropdown(input, dropdown) {
  dropdown.setAttribute('hidden', '');
  dropdown.innerHTML = '';
}

// ── Full search results page ─────────────────────────────────────────────────

export function renderSearchResults(container, items, { onCardClick, onQuickAdd }) {
  container.innerHTML = '';
  container.classList.add('stagger-children');

  if (!items.length) {
    container.innerHTML = `<p style="color:var(--color-text-muted); padding: var(--space-md);">No results found.</p>`;
    return;
  }

  items.forEach(item => {
    if (item.media_type !== 'movie' && item.media_type !== 'tv') return;
    const card = buildCard(item, { onCardClick, onQuickAdd });
    container.appendChild(card);
  });
}

// ── Main: initSearch ─────────────────────────────────────────────────────────

/**
 * Wire up the search input.
 * @param {object} opts
 * @param {Function} opts.onSelect   - item selected from dropdown
 * @param {Function} opts.onQuickAdd - quick-add clicked (item, btn)
 * @param {Function} opts.onSeeAll   - full results requested (query, results)
 */
export function initSearch({ onSelect, onQuickAdd, onSeeAll }) {
  const input    = document.getElementById('search-input');
  const dropdown = document.getElementById('search-dropdown');
  const spinner  = document.getElementById('search-spinner');

  if (!input || !dropdown) return;

  setupKeyboardNav(input, dropdown);

  // Debounced search: 350ms
  const doSearch = debounce(async (query) => {
    const q = query.trim();
    if (!q) {
      spinner.classList.remove('active');
      closeDropdown(input, dropdown);
      return;
    }

    // Cancel previous in-flight request
    abortController?.abort();
    abortController = new AbortController();

    spinner.classList.add('active');

    try {
      const data = await searchMulti(q, { signal: abortController.signal });
      spinner.classList.remove('active');

      openDropdown(dropdown);
      renderDropdown(dropdown, data.results ?? [], q, {
        onSelect,
        onQuickAdd,
        onSeeAll: () => onSeeAll?.(q, data.results ?? []),
      });
    } catch (err) {
      if (err.name === 'AbortError') return; // Expected: cancelled
      spinner.classList.remove('active');
      console.error('Search failed:', err);
    }
  }, 350);

  input.addEventListener('input', e => doSearch(e.target.value));

  // Close dropdown on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) {
      closeDropdown(input, dropdown);
    }
  });

  // Clear on Escape at document level
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && input === document.activeElement) {
      input.value = '';
      closeDropdown(input, dropdown);
    }
  });

  return {
    clear() {
      input.value = '';
      closeDropdown(input, dropdown);
    },
    getValue() {
      return input.value;
    },
  };
}
