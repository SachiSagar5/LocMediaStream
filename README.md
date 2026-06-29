# LocMediaStream

A local media streaming app with an Apple TV-style glass UI. Browse, play, and share your photos and videos across devices on your home network — no accounts, no cloud uploads.

![screenshot](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)
![node](https://img.shields.io/badge/node-%3E%3D18-green)

---

## Features

- **Local media server** — Scans directories for photos (`.jpg`, `.png`, `.gif`, `.webp`, `.bmp`) and videos (`.mp4`, `.webm`, `.mkv`, `.mov`, `.avi`, `.wmv`, `.m4v`, `.mpeg`, `.mpg`)
- **Apple TV-style UI** — Dark/light glass morphism design, horizontal-scrolling rows, hero section with auto-playing video, photo grid view
- **No authentication** — Auto-login as guest, share links work without login
- **Photo viewer** — Arrow key navigation, scroll-to-zoom, rotate, touch swipe/pinch gestures on mobile
- **Video player** — Playback progress saving & resume, range-request streaming, thumbnail previews via ffmpeg
- **Share via QR** — Each media item gets a shareable link; navbar QR code gives the server's main URL (local IP or tunnel)
- **External access** — Built-in localtunnel support to share your library over the internet
- **Self-signed HTTPS** — Automatically generated certs for secure local access
- **Mobile responsive** — Adapts to phones and tablets
- **Persistent SQLite database** — Settings, favorites, playback progress, and shares survive restarts

---

## Quick Start

### Prerequisites

- **Node.js** v18+
- **npm**
- **ffmpeg** (optional, for video thumbnails)

```bash
brew install ffmpeg      # macOS
sudo apt install ffmpeg   # Ubuntu/Debian
```

### Install & Run

```bash
# Clone
git clone https://github.com/SachiSagar5/LocMediaStream.git
cd LocMediaStream

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..

# Build the frontend
cd client && node node_modules/vite/bin/vite.js build && cd ..

# Start the server
node server/src/server.js
```

### Access

```
Local:   http://localhost:5001
Network: http://192.168.x.x:5001
Secure:  https://localhost:5443
```

Open the URL in any browser on the same Wi-Fi network. Other devices see the **Network** address.

---

## Usage

### Adding Media

1. Click the **gear icon** in the top-right navbar to open Settings
2. Add media directories — type a path and click **Add**, or click **Browse** to pick a folder
3. Click **Save Directories**, then click **Scan Now**
4. Your photos and videos appear on the dashboard

### Navigating

| Tab | Shows |
|-----|-------|
| **All** | Everything (hero + horizontal rows) |
| **Videos** | Only videos |
| **Photos** | Photos in grid view (toggle to row view) |
| **Favorites** | Favorited items |

### Viewing Media

- **Photos** — Click a photo card. Use arrow keys (or swipe on mobile) for prev/next. Scroll to zoom. Toolbar for rotate, zoom in/out, reset.
- **Videos** — Click a video card. Video resumes from where you left off. Controls for play/pause, share, favorite, download.

### Sharing

- **Per-item share** — Click the share icon on any card, then copy the link.
- **Server QR** — Click the phone icon in the navbar to get a QR code for the server's main page. Scan with your phone camera to open the library.

### External Access (Internet)

1. Open **Settings** → **Network Access**
2. Click **Enable External Access**
3. A public URL is created (e.g. `https://locmedia-xxxxx.loca.lt`)
4. The navbar QR code now uses this URL — anyone with the link can access your library

> **Note**: The tunnel is powered by [localtunnel](https://localtunnel.me). It may have bandwidth limits.

### HTTPS

The server automatically generates a self-signed certificate on first run and serves HTTPS on port `5443`. Your browser will show a warning — accept it and continue.

---

## Configuration

| Env Variable | Default | Description |
|--------------|---------|-------------|
| `PORT` | `5001` | HTTP port |
| `HTTPS_PORT` | `5443` | HTTPS port |
| `MEDIA_DIRS` | — | Comma-separated paths to scan on startup |

---

## Project Structure

```
LocMediaStream/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── context/         # Auth context (guest login)
│   │   └── App.css          # All styles (glass theme, responsive)
│   └── dist/                # Built frontend (served by Express)
├── server/
│   ├── src/
│   │   ├── server.js        # Express entry point (HTTP + HTTPS)
│   │   ├── scanner.js       # Recursive directory media scanner
│   │   ├── thumbnails.js    # ffmpeg video thumbnail extraction
│   │   ├── tunnel.js        # localtunnel integration
│   │   ├── setup-certs.js   # Self-signed SSL cert generator
│   │   ├── db/database.js   # SQLite schema & queries
│   │   ├── routes/media.js  # Media streaming, progress, shares
│   │   └── routes/auth.js   # Auth (disabled, guest-only)
│   └── data/                # SQLite DB + thumbnail cache
└── .gitignore
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, React Router, react-icons, qrcode.react |
| Backend | Express, better-sqlite3, localtunnel |
| Media | ffmpeg (thumbnails), range-request streaming |
| Design | CSS custom properties, glass morphism, responsive |
| Auth | None (auto-guest) |

---

## License

MIT
