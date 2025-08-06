# 🐝 MeetHive – Real-Time Video Calling Platform

Live Demo: 👉 [https://meethivefrontend.onrender.com](https://meethivefrontend.onrender.com)

MeetHive is a real-time video conferencing platform built with **WebRTC**, allowing seamless video/audio communication between users. Designed for productivity, MeetHive supports 100+ users per session with secure login, dynamic meeting rooms, and chat support.

---

## 🎥 Overview

MeetHive empowers users with a smooth, scalable, and secure virtual meeting experience — ideal for teams, classrooms, and communities.

---

## 🚀 Features

- 🔐 **User Authentication** via session-based login
- 🧑‍🤝‍🧑 **Group Video Calls** with support for 100+ participants
- 🎤 **Real-Time Communication** using **WebRTC**
- 💬 **In-Call Messaging Chat**
- 📜 **Meeting History** stored securely with **MongoDB**
- ⚡ **Dynamic Room Generation** for instant meetings
- 🧭 **Simple & Responsive UI** with **EJS** templating

---

## 🛠️ Tech Stack

| Technology     | Role                                  |
|----------------|----------------------------------------|
| **JavaScript** | Frontend scripting & WebRTC logic      |
| **Node.js**    | Backend runtime                        |
| **Express.js** | Web server and routing                 |
| **MongoDB**    | User data & meeting logs               |
| **EJS**        | Templating engine for views            |
| **Socket.io**  | Real-time signaling                    |
| **WebRTC**     | Peer-to-peer video & audio connection  |
| **CSS**        | Styling and layout                     |

---

## 🧩 Architecture Overview

1. **User Authentication** – Managed via sessions on Express server.
2. **Room Creation** – Users can generate or join dynamic rooms.
3. **Video/Audio Streaming** – Enabled through peer-to-peer WebRTC.
4. **Real-Time Messaging** – Socket.io supports in-call chat.
5. **Data Storage** – MongoDB stores user credentials and meeting history.

---

## 📷 UI Preview

![MeetHive UI Screenshot](https://raw.githubusercontent.com/yadavluv2004/fontend/public/WhatsApp Image 2025-07-28 at 22.48.14_a6c44e02.jpg)

---

## 📦 Installation (Local Setup)

```bash
# 1. Clone the repository
git clone https://github.com/your-username/meethive.git
cd meethive

# 2. Install dependencies
npm install

# 3. Setup environment variables
# Create a .env file and add:
# SESSION_SECRET=yourSecretKey
# MONGO_URI=yourMongoDBConnectionString

# 4. Start the development server
npm start

# 5. Open in browser
http://localhost:3000
