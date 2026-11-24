# 🐝 MeetHive – Real-Time Video Calling Platform

Live demo: 👉 [https://meethivefrontend.onrender.com](https://meethivefrontend.onrender.com)

MeetHive is a browser-based video meeting app built with **React**, **WebRTC**, **Socket.IO**, **Express** and **MongoDB**. Guests can join with just a link; signed-in users get a dashboard and meeting history.

## ✨ Features

- HD group video calls (peer-to-peer mesh, up to 12 people per room by default)
- **Works across networks**: Wi-Fi, mobile data, corporate NATs, via STUN + TURN relays
- Pre-join lobby with camera preview, mic level meter and device selection (mic / camera / speaker)
- Screen sharing, raise hand, emoji reactions, in-call chat with unread badges
- Adaptive grid layout, active-speaker highlight, pin participant, spotlight for presenters
- Automatic ICE restart on network change and Socket.IO reconnect handling
- Keyboard shortcuts: `Ctrl+D` mic, `Ctrl+E` camera
- Accounts, meeting history (search, rejoin, copy link, delete)
- Responsive UI for desktop and mobile

## 🛠️ Tech stack

| Layer     | Tech                                                         |
|-----------|--------------------------------------------------------------|
| Frontend  | React 19, React Router 7, MUI icons, socket.io-client        |
| Backend   | Node.js, Express 5, Socket.IO 4, Mongoose                    |
| Media     | WebRTC (STUN/TURN), `replaceTrack` for seamless track swaps  |
| Security  | bcrypt-hashed passwords, hashed expiring session tokens, Helmet, rate limiting, CORS allow-list |

## 🌐 Why TURN is required for calls across networks

WebRTC tries to connect browsers directly. On the same Wi-Fi that's easy. Across different networks, especially mobile carriers and offices that use symmetric NAT, a direct path often can't be found, so media has to go through a **TURN relay**. Without one, calls connect on the same Wi-Fi and fail elsewhere.

The backend serves ICE servers from `GET /api/v1/ice-servers`, so TURN credentials never live in the frontend bundle. Configure **one** option in `backend/.env`:

| Option | Env vars | Notes |
|---|---|---|
| **Metered.ca** (easiest) | `METERED_DOMAIN`, `METERED_API_KEY` | Has a free tier. Create an app at dashboard.metered.ca |
| Any provider, static creds | `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Twilio, Xirsys, ExpressTURN, etc. |
| Self-hosted coturn | `TURN_URLS`, `TURN_SECRET` | Uses time-limited HMAC credentials (`use-auth-secret`) |

Include a `turns:...:443?transport=tcp` URL so calls also work behind strict firewalls.

## 📦 Local setup

```bash
# Backend
cd backend
cp .env.example .env      # fill in MONGO_URI (and TURN settings)
npm install
npm run dev               # http://localhost:8000

# Frontend (new terminal)
cd fontend
cp .env.example .env      # optional
npm install
npm start                 # http://localhost:3000
```

> Browsers only allow camera/mic on **HTTPS** or `localhost`. To test from another device, use the deployed HTTPS site or a tunnel (e.g. `ngrok http 3000`), not `http://192.168.x.x`.

## 🚀 Deploying

### Frontend on Vercel
1. Vercel → **Add New Project** → import this repo.
2. Set **Root Directory** to `fontend` (the framework is detected as Create React App; `fontend/vercel.json` adds the SPA rewrites).
3. Add the environment variable `REACT_APP_SERVER_URL` = your backend URL, e.g. `https://meethivebackend.onrender.com`.
4. Deploy, then add the Vercel URL (e.g. `https://meethive.vercel.app`) to the backend's `CORS_ORIGINS`.

> The backend can't run on Vercel: it needs a long-lived Socket.IO (WebSocket) server, and Vercel functions are serverless. Host it on Render, Railway or Fly.io.

### Backend (and optionally frontend) on Render

`render.yaml` defines both services. In Render: **New → Blueprint**, select the repo, then set `MONGO_URI` and your TURN variables in the dashboard. In production `CORS_ORIGINS` must list your frontend URL.

Health check: `GET /health`.

## 🔌 API

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/users/register` | – |
| POST | `/api/v1/users/login` | – |
| POST | `/api/v1/users/logout` | Bearer |
| GET  | `/api/v1/users/me` | Bearer |
| GET  | `/api/v1/users/get_all_activity` | Bearer |
| POST | `/api/v1/users/add_to_activity` | Bearer |
| DELETE | `/api/v1/users/activity/:id` | Bearer |
| GET  | `/api/v1/ice-servers` | – |

## 📈 Scaling notes

MeetHive uses a mesh topology: every participant sends their video to every other participant. That works well up to roughly 6–10 people. For larger meetings (the old README's "100+"), you'd need an SFU such as LiveKit, mediasoup or Janus. Room state lives in memory, so run a single backend instance, or add the Socket.IO Redis adapter before scaling out.
