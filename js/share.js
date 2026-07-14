/**
 * share.js — Shareable watchlist via URL-encoded Base64
 *
 * Strategy:
 *  - On "Share": encode watchlist JSON → Base64 → append as ?list=<data>
 *  - On load:    detect ?list= param → show import banner with working buttons
 */

import { exportList, importList } from './store.js';
import { showToast } from './ui.js';

const PARAM_KEY = 'list';

// ── Encode / Decode helpers ──────────────────────────────────────────────────

function encode(json) {
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(base64)));
}

// ── URL helpers ──────────────────────────────────────────────────────────────

function getSharedPayload() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(PARAM_KEY);
  if (!encoded) return null;
  try {
    return decode(encoded);
  } catch {
    return null;
  }
}

function cleanUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM_KEY);
  history.replaceState(null, '', url.toString());
}

// ── Share (export) ───────────────────────────────────────────────────────────

export async function shareWatchlist() {
  const json   = exportList();
  const parsed = JSON.parse(json);

  if (!parsed.length) {
    showToast('Your watchlist is empty — nothing to share.', 'info');
    return;
  }

  const encoded = encode(json);
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM_KEY, encoded);
  url.hash = '';

  try {
    await navigator.clipboard.writeText(url.toString());
    showToast(`Share link copied! (${parsed.length} item${parsed.length > 1 ? 's' : ''})`, 'success');
  } catch {
    window.prompt('Copy this shareable link:', url.toString());
  }

  history.replaceState(null, '', url.toString());
}

// ── Init: wire all share & import functionality ───────────────────────────────

export function initShare() {
  // ── Share button ──
  document.getElementById('btn-share-list')
    ?.addEventListener('click', shareWatchlist);

  // ── Detect ?list= in URL ──
  const payload = getSharedPayload();

  const banner     = document.getElementById('import-banner');
  const bannerText = document.getElementById('import-banner-text');
  const confirmBtn = document.getElementById('btn-import-confirm');
  const dismissBtn = document.getElementById('btn-import-dismiss');

  if (payload) {
    // Parse to get count for the message
    let parsed = [];
    try {
      parsed = JSON.parse(payload);
      if (!Array.isArray(parsed)) parsed = [];
    } catch { /* ignore */ }

    // Show banner with item count
    if (bannerText) {
      bannerText.textContent = parsed.length
        ? `A shared list with ${parsed.length} title${parsed.length > 1 ? 's' : ''} was found. Import it?`
        : 'A shared watchlist was detected in the URL.';
    }
    if (banner) banner.hidden = false;
  }

  // ── Import List button ──
  confirmBtn?.addEventListener('click', () => {
    if (!payload) {
      if (banner) banner.hidden = true;
      return;
    }
    try {
      const count = importList(payload);
      showToast(
        `Imported ${count} new title${count !== 1 ? 's' : ''}! 🎬`,
        'success',
        4000,
      );
    } catch {
      showToast('Failed to import list — data may be corrupt.', 'error');
    }
    if (banner) banner.hidden = true;
    cleanUrl();
  });

  // ── Dismiss button ──
  dismissBtn?.addEventListener('click', () => {
    if (banner) banner.hidden = true;
    cleanUrl();
  });
}
