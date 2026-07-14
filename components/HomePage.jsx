'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getTrending, getPopularMovies, getPopularTV,
  getMovieDetails, getTVDetails,
  getTitle, getYear, getMediaType, formatRating,
  imgUrl, getTrailerKey, getProviders, debounce,
  searchMulti, discoverMovies, discoverTV,
} from '@/lib/api';
import {
  addToWatchlist, removeFromWatchlist, isInWatchlist,
  getWatchlistItem, updateStatus, setUserRating, setNotes,
  cycleStatus, clearWatched, getCounts, getProgress,
  getByStatus, sortList, STATUS_LABEL, STATUS_CYCLE,
  exportList, importList, readList,
} from '@/lib/store';

// ── Toast helper ──────────────────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type='info', dur=3000) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), dur);
  }, []);
  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);
  return { toasts, show, dismiss };
}

// ── MediaCard ─────────────────────────────────────────────────────────────────
function MediaCard({ item, onOpen, onQuickAdd, inWatchlist }) {
  const type   = getMediaType(item);
  const title  = getTitle(item);
  const year   = getYear(item);
  const rating = formatRating(item.vote_average);
  const poster = imgUrl(item.poster_path, 'CARD');

  return (
    <article
      className="media-card"
      role="listitem"
      aria-label={`${title} (${year})`}
      tabIndex={0}
      data-id={item.id}
      data-type={type}
      onClick={() => onOpen(item)}
      onKeyDown={e => { if (e.key==='Enter'||e.key===' '){e.preventDefault();onOpen(item);} }}
    >
      <div className="card-poster-wrap">
        <span className={`card-type-badge card-type-badge--${type}`} aria-label={type==='movie'?'Movie':'TV Show'}>
          {type==='movie'?'🎬':'📺'}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="card-poster" src={poster} alt={title} loading="lazy" decoding="async"
          onError={e=>{e.target.src='/placeholder.svg';}} />
        <div className="card-overlay" aria-hidden="true">
          <p className="card-overlay-overview">{item.overview}</p>
        </div>
        <button
          className={`card-quick-add${inWatchlist?' in-list':''}`}
          aria-label={inWatchlist?'Remove from watchlist':'Add to watchlist'}
          aria-pressed={inWatchlist}
          onClick={e=>{e.stopPropagation();onQuickAdd(item);}}
        >{inWatchlist?'✓':'+'}</button>
      </div>
      <div className="card-footer">
        <p className="card-title">{title}</p>
        <div className="card-meta">
          <span className="card-year">{year}</span>
          <span className="card-rating" aria-label={`Rating ${rating} out of 10`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {rating}
          </span>
        </div>
      </div>
    </article>
  );
}

// ── ContentRail ───────────────────────────────────────────────────────────────
function ContentRail({ id, heading, items, watchlistIds, onOpen, onQuickAdd }) {
  const railRef = useRef(null);
  const scroll  = dir => railRef.current?.scrollBy({ left: dir*(railRef.current.clientWidth*0.75), behavior:'smooth' });

  return (
    <section className="content-rail" aria-labelledby={`${id}-heading`}>
      <div className="rail-header">
        <h2 className="section-heading" id={`${id}-heading`}>{heading}</h2>
        <div className="rail-nav">
          <button className="rail-nav-btn" onClick={()=>scroll(-1)} aria-label="Scroll left">‹</button>
          <button className="rail-nav-btn" onClick={()=>scroll(1)}  aria-label="Scroll right">›</button>
        </div>
      </div>
      <div className="card-rail stagger-children" ref={railRef} role="list" aria-label={heading}>
        {items.map(item => (
          <MediaCard
            key={`${item.id}-${item.media_type}`}
            item={item}
            onOpen={onOpen}
            onQuickAdd={onQuickAdd}
            inWatchlist={watchlistIds.has(`${item.id}:${getMediaType(item)}`)}
          />
        ))}
      </div>
    </section>
  );
}

// ── Hero Carousel ─────────────────────────────────────────────────────────────
function Hero({ items, watchlistIds, onOpen, onQuickAdd }) {
  const [idx, setIdx] = useState(0);
  const item  = items[idx] ?? {};
  const type  = getMediaType(item);
  const title = getTitle(item);
  const year  = getYear(item);

  useEffect(() => {
    if (!items.length) return;
    const t = setInterval(() => setIdx(i => (i+1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;
  const inList = watchlistIds.has(`${item.id}:${type}`);

  return (
    <section className="hero" aria-label="Featured content">
      <div className="hero-backdrop" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero-backdrop-img" src={imgUrl(item.backdrop_path,'BACK_LG')} alt="" loading="eager" decoding="async" />
        <div className="hero-backdrop-overlay" />
      </div>
      <div className="hero-content">
        <div className="hero-meta">
          <span className="hero-badge">Trending</span>
          <span className="hero-type">{type==='movie'?'🎬 Movie':'📺 TV Show'}</span>
        </div>
        <h1 className="hero-title">{title}</h1>
        <p className="hero-overview">{item.overview}</p>
        <div className="hero-rating">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#f39c12" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>{formatRating(item.vote_average)}</span>
          <span>· {year}</span>
        </div>
        <div className="hero-actions">
          <button className="btn btn--primary" onClick={()=>onOpen(item)}>See Details</button>
          <button className="btn btn--secondary" onClick={()=>onQuickAdd(item)}>
            {inList ? '✓ In Watchlist' : '+ Add to Watchlist'}
          </button>
        </div>
      </div>
      <div className="hero-dots" role="tablist" aria-label="Featured items">
        {items.map((_,i) => (
          <button key={i} className={`hero-dot${i===idx?' active':''}`} role="tab"
            aria-label={`Featured item ${i+1}`} onClick={()=>setIdx(i)} />
        ))}
      </div>
    </section>
  );
}

// ── Search Bar ────────────────────────────────────────────────────────────────
function SearchBar({ onSeeAll, onItemOpen, onQuickAdd, watchlistIds }) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const abortRef = useRef(null);
  const wrapRef  = useRef(null);

  const doSearch = useCallback(debounce(async q => {
    if (!q.trim()) { setResults([]); setOpen(false); setLoading(false); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const data = await searchMulti(q, { signal: abortRef.current.signal });
      setResults((data.results??[]).filter(r=>r.media_type==='movie'||r.media_type==='tv').slice(0,8));
      setOpen(true);
    } catch(e) { if (e.name!=='AbortError') console.error(e); }
    finally { setLoading(false); }
  }, 350), []);

  useEffect(() => { doSearch(query); }, [query, doSearch]);

  // Close on outside click
  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const movies = results.filter(r=>r.media_type==='movie');
  const tv     = results.filter(r=>r.media_type==='tv');

  return (
    <div className="search-wrapper" role="search" ref={wrapRef}>
      <div className="search-bar">
        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="search" className="search-input"
          placeholder="Search movies & TV shows…"
          value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Escape'){setQuery('');setOpen(false);} }}
          aria-label="Search movies and TV shows" autoComplete="off"
        />
        {loading && <div className="search-spinner active" />}
      </div>

      {open && results.length > 0 && (
        <div className="search-dropdown" role="listbox">
          {movies.length>0 && <div className="dropdown-section-header">Movies</div>}
          {movies.slice(0,4).map(r => (
            <DropdownItem key={r.id} item={r} inList={watchlistIds.has(`${r.id}:movie`)}
              onSelect={()=>{onItemOpen(r);setOpen(false);setQuery('');}}
              onAdd={()=>onQuickAdd(r)} />
          ))}
          {tv.length>0 && <div className="dropdown-section-header">TV Shows</div>}
          {tv.slice(0,4).map(r => (
            <DropdownItem key={r.id} item={r} inList={watchlistIds.has(`${r.id}:tv`)}
              onSelect={()=>{onItemOpen(r);setOpen(false);setQuery('');}}
              onAdd={()=>onQuickAdd(r)} />
          ))}
          {results.length > 5 && (
            <div className="dropdown-see-all">
              <button onClick={()=>{onSeeAll(query,results);setOpen(false);}}>
                See all results for &ldquo;{query}&rdquo;
              </button>
            </div>
          )}
        </div>
      )}

      {open && query && results.length===0 && !loading && (
        <div className="search-dropdown">
          <p className="dropdown-empty">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

function DropdownItem({ item, inList, onSelect, onAdd }) {
  const type  = getMediaType(item);
  const title = getTitle(item);
  const year  = getYear(item);
  return (
    <div className="dropdown-item" role="option" onClick={onSelect}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="dropdown-thumb" src={imgUrl(item.poster_path,'THUMB')} alt={title} loading="lazy"
        onError={e=>{e.target.src='/placeholder.svg';}} />
      <div className="dropdown-info">
        <div className="dropdown-title">{title}</div>
        <div className="dropdown-meta">{type==='movie'?'🎬':'📺'} {year}</div>
      </div>
      <button className={`dropdown-add-btn${inList?' in-list':''}`}
        onClick={e=>{e.stopPropagation();onAdd();}}
        aria-label={inList?'In watchlist':'Add to watchlist'}>
        {inList?'✓':'+'}
      </button>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ item, onClose, watchlistKey, onWatchlistChange }) {
  const [details, setDetails] = useState(null);
  const [wlItem,  setWlItem]  = useState(null);
  const country = typeof navigator !== 'undefined' ? (navigator.language?.slice(-2).toUpperCase()||'US') : 'US';

  useEffect(() => {
    if (!item) return;
    setDetails(null);
    const type = item.type || getMediaType(item);
    const id   = item.id;
    (type==='movie'?getMovieDetails(id):getTVDetails(id))
      .then(d => { setDetails({...d, type}); setWlItem(getWatchlistItem(id, type)); })
      .catch(console.error);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    setWlItem(getWatchlistItem(item.id, item.type || getMediaType(item)));
  }, [watchlistKey, item]);

  if (!item) return null;

  const d     = details ?? item;
  const type  = d.type || getMediaType(d);
  const title = getTitle(d);
  const year  = getYear(d);

  const trailerKey = details ? getTrailerKey(details.videos) : null;
  const providers  = details ? getProviders(details['watch/providers'], country) : [];
  const cast       = details?.credits?.cast?.slice(0,12) ?? [];

  const handleStatusChange = (status) => {
    if (!status) { removeFromWatchlist(d.id, type); }
    else if (isInWatchlist(d.id, type)) { updateStatus(d.id, type, status); }
    else {
      addToWatchlist({ id:d.id, type, title:getTitle(d), posterPath:d.poster_path, year:getYear(d), rating:d.vote_average });
      updateStatus(d.id, type, status);
    }
    onWatchlistChange();
  };

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="modal-title"
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose} aria-label="Close details">✕</button>
        <div className="modal-backdrop-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="modal-backdrop" src={imgUrl(d.backdrop_path,'BACK_LG')} alt="" loading="lazy" decoding="async" />
          <div className="modal-backdrop-fade" />
        </div>
        <div className="modal-body">
          <div className="modal-poster-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="modal-poster" src={imgUrl(d.poster_path,'POSTER')} alt={title} loading="lazy" decoding="async"
              onError={e=>{e.target.src='/placeholder.svg';}} />
          </div>
          <div className="modal-info">
            <div className="modal-header-info">
              <span className={`modal-type-badge modal-type-badge--${type}`}>{type==='movie'?'🎬 Movie':'📺 TV Show'}</span>
              <h2 className="modal-title" id="modal-title">{title}</h2>
              <div className="modal-meta-row">
                <span>⭐ {formatRating(d.vote_average)}</span>
                <span className="modal-meta-dot"/>
                <span>{year}</span>
                {d.runtime && <><span className="modal-meta-dot"/><span>{d.runtime} min</span></>}
                {d.number_of_seasons && <><span className="modal-meta-dot"/><span>{d.number_of_seasons} season{d.number_of_seasons>1?'s':''}</span></>}
              </div>
              <div className="modal-genres">
                {(d.genres??[]).map(g=><span key={g.id} className="modal-genre-tag">{g.name}</span>)}
              </div>
            </div>

            <p className="modal-overview">{d.overview}</p>

            {providers.length>0 && (
              <div className="modal-streaming">
                <h3 className="modal-section-title">Stream On</h3>
                <div className="streaming-logos">
                  {providers.map(p=>(
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.provider_id} className="streaming-logo"
                      src={imgUrl(p.logo_path,'LOGO')} alt={p.provider_name} title={p.provider_name} loading="lazy" />
                  ))}
                </div>
              </div>
            )}

            {cast.length>0 && (
              <div className="modal-cast">
                <h3 className="modal-section-title">Cast</h3>
                <div className="cast-scroll">
                  {cast.map(p=>(
                    <div key={p.id} className="cast-member">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="cast-avatar" src={imgUrl(p.profile_path,'AVATAR')} alt={p.name} loading="lazy"
                        onError={e=>{e.target.src='/placeholder.svg';}} />
                      <p className="cast-name">{p.name}</p>
                      <p className="cast-role">{p.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {trailerKey && (
              <div className="modal-trailer">
                <h3 className="modal-section-title">Trailer</h3>
                <a className="trailer-thumb" href={`https://www.youtube.com/watch?v=${trailerKey}`}
                  target="_blank" rel="noopener noreferrer" aria-label="Watch trailer on YouTube">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="trailer-thumb-img" src={`https://img.youtube.com/vi/${trailerKey}/mqdefault.jpg`} alt="Watch trailer" loading="lazy" />
                  <span className="trailer-play-btn" aria-hidden="true">▶</span>
                </a>
              </div>
            )}

            <div className="modal-wl-controls">
              <h3 className="modal-section-title">Watchlist</h3>
              <div className="modal-status-row">
                <select className="modal-status-select" value={wlItem?.status??''}
                  onChange={e=>handleStatusChange(e.target.value)} aria-label="Set watching status">
                  <option value="">— Not in watchlist —</option>
                  <option value="want_to_watch">Want to Watch</option>
                  <option value="watching">Watching</option>
                  <option value="watched">Watched</option>
                </select>
              </div>
              <StarRating current={wlItem?.userRating??null}
                onChange={r=>{ if(isInWatchlist(d.id,type)){setUserRating(d.id,type,r);setWlItem(getWatchlistItem(d.id,type));} }} />
              <textarea className="modal-notes" rows={3} placeholder="Add personal notes…"
                defaultValue={wlItem?.notes??''}
                onChange={e=>{ if(isInWatchlist(d.id,type)) setNotes(d.id,type,e.target.value); }}
                aria-label="Personal notes" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StarRating({ current, onChange }) {
  const [hover, setHover] = useState(null);
  return (
    <div className="modal-rating-row">
      <span className="rating-label">My Rating:</span>
      <div className="star-rating" role="group" aria-label="Personal rating out of 10">
        {Array.from({length:10},(_,i)=>i+1).map(i=>(
          <button key={i} type="button" className={`star${i<=(hover??current??0)?' active':''}`}
            aria-label={`Rate ${i} out of 10`} aria-pressed={i===current}
            onClick={()=>onChange(i===current?null:i)}
            onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}>★</button>
        ))}
      </div>
    </div>
  );
}

// ── Watchlist Drawer ──────────────────────────────────────────────────────────
function WatchlistDrawer({ open, onClose, watchlistKey, onItemOpen }) {
  const [tab,  setTab]  = useState('all');
  const [sort, setSort] = useState('addedAt');
  const counts   = getCounts();
  const progress = getProgress();
  const items    = sortList(getByStatus(tab), sort);

  const handleCycle = (id, type) => { cycleStatus(id,type); };
  const handleRemove= (id, type) => { removeFromWatchlist(id,type); };

  return (
    <aside className={`watchlist-drawer${open?' open':''}`} aria-label="My watchlist" aria-hidden={!open}>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <div className="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-header">
          <h2 className="drawer-title" id="drawer-title">My Watchlist</h2>
          <button className="drawer-close" onClick={onClose} aria-label="Close watchlist">✕</button>
        </div>
        <div className="watchlist-progress">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{width:`${progress.pct}%`}}
              role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} />
          </div>
          <p className="progress-label">{progress.watched} of {progress.total} watched · {progress.pct}%</p>
        </div>
        <div className="watchlist-tabs" role="tablist">
          {[['all','All'],['want_to_watch','Want'],['watching','Watching'],['watched','Watched']].map(([s,l])=>(
            <button key={s} className={`wl-tab${tab===s?' active':''}`} role="tab" aria-selected={tab===s}
              onClick={()=>setTab(s)}>
              {l} <span className="tab-count">{counts[s]??counts.all}</span>
            </button>
          ))}
        </div>
        <div className="watchlist-controls">
          <label className="sort-label" htmlFor="sort-select">Sort:</label>
          <select id="sort-select" className="sort-select" value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="addedAt">Date Added</option>
            <option value="title">Title A–Z</option>
            <option value="rating">TMDB Rating</option>
            <option value="userRating">My Rating</option>
          </select>
          <button className="btn btn--ghost btn--sm" onClick={()=>clearWatched()}>Clear Watched</button>
        </div>
        <div className="watchlist-items" role="list">
          {items.length===0 ? (
            <div className="watchlist-empty">
              <p className="empty-icon">🎬</p>
              <p className="empty-text">Your watchlist is empty.</p>
              <p className="empty-sub">Search for a movie or show to get started.</p>
            </div>
          ) : items.map(w=>(
            <WatchlistRow key={`${w.id}:${w.type}`} item={w}
              onClick={()=>onItemOpen(w)} onCycle={()=>handleCycle(w.id,w.type)}
              onRemove={()=>handleRemove(w.id,w.type)} />
          ))}
        </div>
      </div>
    </aside>
  );
}

function WatchlistRow({ item, onClick, onCycle, onRemove }) {
  const dotClass = item.status==='want_to_watch'?'want':item.status==='watching'?'watching':'watched';
  return (
    <div className="wl-item" role="listitem" onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wl-thumb" src={imgUrl(item.posterPath,'THUMB')} alt={item.title} loading="lazy"
        onError={e=>{e.target.src='/placeholder.svg';}} />
      <div className="wl-info">
        <p className="wl-title">{item.title}</p>
        <div className="wl-meta">
          <span className={`wl-status-dot wl-status-dot--${dotClass}`} aria-hidden="true" />
          <span>{STATUS_LABEL[item.status]}</span>
          {item.year && <span>· {item.year}</span>}
          {item.userRating && <span className="wl-user-rating">★ {item.userRating}/10</span>}
        </div>
      </div>
      <div className="wl-actions">
        <button className="wl-action-btn" title="Cycle status"
          aria-label={`Cycle status for ${item.title}`}
          onClick={e=>{e.stopPropagation();onCycle();}}>⟳</button>
        <button className="wl-action-btn wl-action-btn--delete" title="Remove"
          aria-label={`Remove ${item.title}`}
          onClick={e=>{e.stopPropagation();onRemove();}}>✕</button>
      </div>
    </div>
  );
}

// ── Toast Container ───────────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }) {
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t=>(
        <div key={t.id} className={`toast toast--${t.type}`} role="alert">
          <span className="toast-icon" aria-hidden="true">{icons[t.type]}</span>
          <span className="toast-msg">{t.msg}</span>
          <button className="toast-dismiss" onClick={()=>onDismiss(t.id)} aria-label="Dismiss">✕</button>
        </div>
      ))}
    </div>
  );
}

// ── Share Banner ──────────────────────────────────────────────────────────────
function ImportBanner({ onImport, onDismiss }) {
  const [payload, setPayload] = useState(null);
  const [count,   setCount]   = useState(0);

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const encoded = params.get('list');
    if (!encoded) return;
    try {
      const json   = decodeURIComponent(escape(atob(encoded.replace(/-/g,'+').replace(/_/g,'/'))));
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length) { setPayload(encoded); setCount(parsed.length); }
    } catch { /* ignore */ }
  }, []);

  if (!payload) return null;
  return (
    <div className="import-banner" role="alert">
      <p id="import-banner-text">A shared list with {count} title{count>1?'s':''} was found. Import it?</p>
      <div className="import-actions">
        <button className="btn btn--primary btn--sm" onClick={()=>{ onImport(payload); setPayload(null); }}>Import List</button>
        <button className="btn btn--ghost btn--sm"   onClick={()=>{ setPayload(null); onDismiss(); }}>Dismiss</button>
      </div>
    </div>
  );
}

// ── Genre Pills ───────────────────────────────────────────────────────────────
function GenrePills({ genres, onSelect }) {
  const [active, setActive] = useState(null);
  return (
    <div className="genre-filter-row" aria-label="Filter by genre">
      <div className="genre-pills" role="list">
        {[{id:null,name:'All'},...genres].map(g=>(
          <button key={g.id??'all'} className={`genre-pill${active===g.id?' active':''}`}
            role="listitem" onClick={()=>{ setActive(g.id); onSelect(g.id); }}>
            {g.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main HomePage ─────────────────────────────────────────────────────────────
export default function HomePage({ trendingItems, movieItems, tvItems, genres }) {
  const [modalItem,      setModalItem]      = useState(null);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [searchResults,  setSearchResults]  = useState(null);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [watchlistKey,   setWatchlistKey]   = useState(0); // bump to force re-render
  const [discoverItems,  setDiscoverItems]  = useState(null);
  const { toasts, show: showToast, dismiss }         = useToasts();

  // Build a Set of "id:type" for quick in-watchlist lookup
  const [watchlistIds, setWatchlistIds] = useState(() => {
    if (typeof window==='undefined') return new Set();
    return new Set(readList().map(i=>`${i.id}:${i.type}`));
  });

  // Sync watchlistIds when store changes
  useEffect(() => {
    const sync = () => {
      setWatchlistIds(new Set(readList().map(i=>`${i.id}:${i.type}`)));
      setWatchlistKey(k=>k+1);
    };
    window.addEventListener('watchlist:change', sync);
    return () => window.removeEventListener('watchlist:change', sync);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    const h = e => { if (e.key==='Escape') { setModalItem(null); setDrawerOpen(false); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const handleQuickAdd = useCallback((item) => {
    const type   = item.type || getMediaType(item);
    const inList = isInWatchlist(item.id, type);
    if (inList) {
      removeFromWatchlist(item.id, type);
      showToast(`Removed "${getTitle(item)}"`, 'info');
    } else {
      addToWatchlist({ id:item.id, type, title:getTitle(item), posterPath:item.poster_path, year:getYear(item), rating:item.vote_average });
      showToast(`Added "${getTitle(item)}" 🎬`, 'success');
    }
  }, [showToast]);

  const handleGenreSelect = async (genreId) => {
    if (!genreId) { setDiscoverItems(null); return; }
    try {
      const [m,t] = await Promise.all([discoverMovies({genreId}), discoverTV({genreId})]);
      const combined = [];
      const ml=m.results??[], tl=t.results??[];
      for(let i=0;i<Math.max(ml.length,tl.length);i++){
        if(ml[i]) combined.push({...ml[i],media_type:'movie'});
        if(tl[i]) combined.push({...tl[i],media_type:'tv'});
      }
      setDiscoverItems(combined.slice(0,20));
    } catch(e){ console.error(e); }
  };

  const handleShare = async () => {
    const encoded = exportList();
    const url = new URL(window.location.href);
    url.searchParams.set('list', encoded);
    try {
      await navigator.clipboard.writeText(url.toString());
      showToast('Share link copied to clipboard! 🔗', 'success');
    } catch {
      window.prompt('Copy this link:', url.toString());
    }
    history.replaceState(null,'',url.toString());
  };

  const handleImport = (encoded) => {
    try {
      const count = importList(encoded);
      showToast(`Imported ${count} new title${count!==1?'s':''}! 🎬`, 'success', 4000);
      const url = new URL(window.location.href);
      url.searchParams.delete('list');
      history.replaceState(null,'',url.toString());
    } catch { showToast('Failed to import list.','error'); }
  };

  const activeItems = discoverItems ?? trendingItems;

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a href="/" className="logo" aria-label="CineList home">
            <span className="logo-icon">🎬</span>
            <span className="logo-text">CineList</span>
          </a>
          <SearchBar
            onSeeAll={(q,r)=>{ setSearchQuery(q); setSearchResults(r); }}
            onItemOpen={setModalItem}
            onQuickAdd={handleQuickAdd}
            watchlistIds={watchlistIds}
          />
          <nav className="header-nav" aria-label="Main navigation">
            <button className="nav-btn" onClick={()=>setDrawerOpen(true)}
              aria-label="Open watchlist" aria-expanded={drawerOpen}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              {watchlistIds.size > 0 && (
                <span className="watchlist-count-badge visible" aria-label={`${watchlistIds.size} items`}>
                  {watchlistIds.size}
                </span>
              )}
            </button>
            <button className="nav-btn nav-btn--icon-only" onClick={handleShare}
              aria-label="Share watchlist" title="Share your watchlist">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
          </nav>
        </div>
      </header>

      <Hero items={activeItems.slice(0,8)} watchlistIds={watchlistIds}
        onOpen={setModalItem} onQuickAdd={handleQuickAdd} />

      <main className="main-content">
        <GenrePills genres={genres} onSelect={handleGenreSelect} />

        {searchResults ? (
          <section className="search-results-section" aria-labelledby="search-results-heading">
            <div className="rail-header">
              <h2 className="section-heading" id="search-results-heading">
                Results for &ldquo;{searchQuery}&rdquo;
              </h2>
              <button className="btn btn--ghost btn--sm" onClick={()=>setSearchResults(null)}>✕ Clear</button>
            </div>
            <div className="card-grid stagger-children" role="list">
              {searchResults.map(item=>(
                <MediaCard key={`${item.id}-${item.media_type}`} item={item}
                  onOpen={setModalItem} onQuickAdd={handleQuickAdd}
                  inWatchlist={watchlistIds.has(`${item.id}:${getMediaType(item)}`)} />
              ))}
            </div>
          </section>
        ) : (
          <>
            <ContentRail id="trending" heading="🔥 Trending This Week"
              items={activeItems} watchlistIds={watchlistIds}
              onOpen={setModalItem} onQuickAdd={handleQuickAdd} />
            <ContentRail id="movies" heading="🎬 Popular Movies"
              items={movieItems} watchlistIds={watchlistIds}
              onOpen={setModalItem} onQuickAdd={handleQuickAdd} />
            <ContentRail id="tv" heading="📺 Popular TV Shows"
              items={tvItems} watchlistIds={watchlistIds}
              onOpen={setModalItem} onQuickAdd={handleQuickAdd} />
          </>
        )}
      </main>

      {drawerOpen && (
        <WatchlistDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)}
          watchlistKey={watchlistKey}
          onItemOpen={item=>{ setModalItem(item); }} />
      )}

      {modalItem && (
        <DetailModal item={modalItem} onClose={()=>setModalItem(null)}
          watchlistKey={watchlistKey} onWatchlistChange={()=>setWatchlistKey(k=>k+1)} />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <ImportBanner onImport={handleImport} onDismiss={()=>{
        const url=new URL(window.location.href);url.searchParams.delete('list');
        history.replaceState(null,'',url.toString());
      }} />
    </>
  );
}
