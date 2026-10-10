# Sini Sana

Peer-to-peer text and file transfer between two devices. Create a room on your
computer, scan the QR code with your phone, and messages, images and files move
directly between the two devices — never through a server.

## Features

- **No account, no storage** — open the app and go; nothing is saved anywhere.
- **Join by QR or code** — scan the room's QR with the built-in camera scanner,
  or type the 6-character room code.
- **Send text, images and files** — paste from the clipboard or drag files in,
  up to 4 GB each.
- **Direct device-to-device** — transfers run over an encrypted WebRTC data
  channel and never pass through the server.
- **Light & dark themes** — dark by default, switch anytime from the header.
- **End a session** — the room creator can close the room for everyone.

## What's new

Latest updates:

- Rebranded to **Sini Sana** with a new logo, an orange-and-blue palette, and the
  Baloo 2 + Nunito type pairing.
- **In-app QR scanner** — a full-screen camera view for joining a room, no app
  install needed.
- **"How to use" guide** page, reachable from the home screen footer.
- **Light/dark theme** toggle in the header (dark by default).
- **End session** control for the room creator, with a "Room closed" screen for
  the other device.
- Reworked, more playful and responsive UI across phones and desktops.

## How it works

```
Device A (creator)                 Signaling server                Device B (joiner)
─────────────────                 ────────────────                 ─────────────────
create-room ───────────────────▶  assigns room                    ────────────────
  (code K7MXP2)                   relays SDP + ICE                join-room K7MXP2
        ◀───────────────────────  room-created /
                                   room-joined ◀───────────────
        ◀───── WebRTC offer/answer + ICE candidates (relayed) ────────▶
        ──────▶ text and files flow over the encrypted data channel ◀─┘
```

- The **signaling server** (`server/`) only negotiates the WebRTC connection:
  it relays the SDP offer/answer and ICE candidates needed for two browsers to
  find each other. It never sees the text or files you transfer.
- Everything else happens over an encrypted `RTCDataChannel` between the two
  devices. The code is a bearer secret: whoever knows it can join the room.
- Rooms hold exactly two devices, live at most 2 hours, and vanish when empty.

## Getting started

Requires Node.js 20 or newer and npm 10.

```sh
npm install
npm run dev
```

This starts the Vite app (http://localhost:5173) and the signaling server
(http://localhost:3001) together.

```sh
npm test        # run the test suite
npm run typecheck
npm run build   # production build for client + server
```

## Project layout

```
shared/                  Protocol shared by client and server
  roomCode.ts            Room-code alphabet + normalization rules
  types/signaling.ts     Client ↔ server message types
server/                  The signaling server (Node + ws)
  src/index.ts           HTTP + WebSocket server (healthz, relay, expiry)
  src/rooms.ts           In-memory room registry (2 peers, TTL, sweep)
  src/signaling.ts       Message validation and limits
workers/                 The signaling server (Cloudflare Worker + Durable Object)
  src/index.ts           Worker fetch handler + RoomDirectory durable object
  wrangler.toml          Worker config, DO binding, ALLOWED_ORIGINS
src/                     The React app (Vite + TypeScript + Tailwind)
  lib/room/              Room id generation and URL parsing
  lib/signaling/         WebSocket client
  lib/webrtc/            Data channel protocol, chunking, backpressure,
                         receive/assemble engine, ICE config
  lib/theme.ts           Theme persistence (dark by default)
  hooks/                 useRoom, useWebRTC, useClipboard, useAppConfig, useTheme
  components/            Home/room/how-to screens, QR scanner, composer,
                         dropzone, transfers, theme toggle
```

## Environment variables

| Variable                | Default                      | Purpose                                      |
| ----------------------- | ---------------------------- | -------------------------------------------- |
| `VITE_SIGNALING_URL`    | `ws://<host>:3001`           | WebSocket URL of the signaling server        |
| `VITE_STUN_SERVER`      | Google STUN (`:19302`)       | Comma-separated STUN servers                 |
| `VITE_TURN_URL`         | (none)                       | Optional TURN relay(s), comma-separated        |
| `VITE_TURN_USERNAME`    | (none)                       | TURN username (TURN only used with credential) |
| `VITE_TURN_CREDENTIAL`  | (none)                       | TURN credential                              |
| `PORT`                  | `3001`                       | Server listen port                            |
| `ALLOWED_ORIGINS`       | (all)                        | Comma-separated hosts allowed to connect      |

Copy `.env.example` to `.env.local` and adjust as needed. TURN credentials are
sent to the browser, so keep the TURN server private or rotate credentials.

## Deployment

**Frontend** — `netlify.toml` builds the client and publishes `dist/`. Connect
the repo to Netlify (or any static host):

```sh
netlify build   # same as npm run build:client
```

**Signaling server** — the signaling server also ships as a Cloudflare Worker
with a Durable Object (`workers/`), which runs on Cloudflare's free plan with no
credit card. Point the app at it with
`VITE_SIGNALING_URL=wss://<worker>.<subdomain>.workers.dev` (note `wss://`, and
no `:3001`) and redeploy the frontend after changing it.

```sh
npx wrangler login          # one-time, opens the browser
npm run deploy:signaling    # wrangler deploy --config workers/wrangler.toml
```

Set `ALLOWED_ORIGINS` in `workers/wrangler.toml` (or as a dashboard variable) to
your site's host, e.g. `sinisana.netlify.app`. Leaving it empty allows any
origin, which is fine for testing but not recommended for production.

**Connectivity (TURN)** — same-Wi‑Fi transfers work with STUN alone, but across
different networks (symmetric/carrier-grade NAT, firewalled UDP) a TURN relay is
required. The Worker hands out short-lived TURN credentials so long-term secrets
never reach the browser. Two providers are supported; Cloudflare is tried first,
then Metered. The app fetches `GET /ice-servers` from the signaling host and
merges the relays into its ICE servers.

*Metered / Open Relay (free, no credit card):*

1. Create a free account at
   <https://dashboard.metered.ca/signup?tool=turnserver>. Note your **app name**
   (dashboard sidebar) and **secret key** (Dashboard → Developers).
2. Store them as Worker secrets and redeploy:
   ```sh
   npx wrangler secret put METERED_APP_NAME   # e.g. "sinisana"
   npx wrangler secret put METERED_SECRET_KEY
   npx wrangler deploy --config workers/wrangler.toml
   ```

*Cloudflare Realtime TURN (requires a payment method on file):*

1. In the Cloudflare dashboard, create a **TURN key** (Realtime → TURN Server).
2. Store its ID and API token as Worker secrets and redeploy:
   ```sh
   npx wrangler secret put TURN_KEY_ID
   npx wrangler secret put TURN_API_TOKEN
   npx wrangler deploy --config workers/wrangler.toml
   ```

With no provider configured the Worker serves Cloudflare's free STUN server
only. You can also skip the Worker and set `VITE_TURN_URL` / `VITE_TURN_USERNAME`
/ `VITE_TURN_CREDENTIAL` in the frontend env (comma-separated URLs supported).

The same server also runs on any Node host (Render, Railway, Fly, a VPS):

```sh
cd server && npm install && npm run build && npm start
```

with `ALLOWED_ORIGINS` set to your app's hosts.

## Privacy

Text and files are transferred directly between connected devices when a
peer-to-peer connection is available.

## Notes and limits

- Files up to 4 GB are transferred in 16 KiB chunks with buffer backpressure.
- Some networks (corporate NATs, some mobile networks) block direct peer-to-peer
  traffic. A TURN server restores connectivity but relays the traffic, so add
  one only if you need it.
- Rooms are ephemeral: there are no accounts, no history, and nothing is stored
  on the signaling server.