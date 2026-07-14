# CineList 🎬

> A premium, feature-rich **Movie & TV Watchlist** app powered by Next.js and the [TMDB API](https://www.themoviedb.org/documentation/api). Discover trending content, track what you watch, rate titles, find streaming providers, and share your list — with absolute API token security.

[![TMDB](https://img.shields.io/badge/Powered%20by-TMDB-01b4e4?style=for-the-badge&logo=themoviedb&logoColor=white)](https://www.themoviedb.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)

---

## 📸 Screenshots

### Hero & Discovery
![CineList Hero Section](docs/images/hero.png)
*Trending hero carousel with Ken-Burns backdrop animation, horizontal scrollable content rails, and genre pills*

### Movie / TV Detail Modal
![Detail Modal](docs/images/modal.png)
*Details overlay featuring trailer integrations, region-specific streaming providers, cast carousel, and user ratings*

### Watchlist Drawer
![Watchlist Drawer](docs/images/watchlist.png)
*Interactive side drawer with progress tracking, status tabs (Want/Watching/Watched), and advanced sorting controls*

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔑 **API Token Security** | Token is kept purely server-side in `.env.local`. Client queries are proxied via Next.js route handlers. |
| ⚡ **Hybrid Architecture** | Server-side data pre-fetching (Initial load) + client-side interactive React states. |
| 🔍 **Smart Search** | 350ms debounced client search with `AbortController` to cancel stale query requests automatically. |
| 🖼️ **Image Optimization** | Multi-sized TMDB image loading (resolutions adjusted dynamically from `w185` to `w1280`). |
| 📺 **Streaming Providers** | Visual lookup of local streaming services (Netflix, Prime, Disney+, etc.) based on user locale. |
| 📋 **Watchlist** | Complete CRUD operations with localized status cycling (Want → Watching → Watched). |
| ⭐ **Star Rating** | Interactive 10-star grading system for personal reviews. |
| 📝 **Personal Notes** | Contextual rich text comments saved inline on watchlist items. |
| 📊 **Progress Tracker** | Real-time percentage indicator showing watch completeness. |
| 🔗 **Shareable Lists** | Share whole watchlists with a single URL using URL-safe Base64 serialization. |
| 🎨 **Premium UI** | Custom CSS design systems featuring modern glassmorphism, responsive grid layouts, and micro-interactions. |

---

## 📁 Project Structure

```
CineList/
├── app/
│   ├── api/tmdb/[...path]/  # Server-side TMDB API route proxy
│   ├── globals.css         # Combined CSS design tokens & animations
│   ├── layout.js           # Next.js Root Layout (Google Fonts: Outfit & Inter)
│   └── page.js             # Server Page (pre-fetches trending & popular contents)
├── components/
│   └── HomePage.jsx        # Client HomePage orchestrator
├── lib/
│   ├── api.js              # Client-side API fetch client & helpers
│   ├── store.js            # LocalStorage store (state, progress, export/import)
│   └── tmdb.js             # Server-side TMDB API fetcher (token config)
├── public/
│   └── placeholder.svg     # Fallback movie poster
├── docs/images/            # README screenshots
├── .env.local              # Local environment config (gitignored)
└── .env.example            # Environment configuration template
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/alamulord/CineList.git
cd CineList
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure TMDB Access Token

1. Sign up/log in at [themoviedb.org](https://www.themoviedb.org).
2. Go to **Settings → API**.
3. Generate an API Key and copy your **API Read Access Token** (the long string starting with `eyJ...`).
4. Create a `.env.local` file in the root directory:
   ```env
   TMDB_BEARER_TOKEN=your_bearer_token_here
   ```

### 4. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view your CineList app.

---

## 🛠️ Tech Stack

- **Next.js 15 (App Router)** & **React 19**
- **Vanilla CSS** — Modern dark theme glassmorphic layout
- **TMDB API v3** — Metadata, trailers, cast lists, and watch providers
- **localStorage** — Seamless client-side list persistence

---

> This product uses the TMDB API but is not endorsed or certified by TMDB.
> ![TMDB Logo](https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb20f5ac01c367d1c4b8e7c79e85ec285.svg)
