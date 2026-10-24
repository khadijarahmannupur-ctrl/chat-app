# Real-Time Chat Application

A minimal, elegant real-time chat web application built with Next.js, Express, Socket.io, and Better Auth. Featuring private 1-on-1 direct messaging and anonymous group chats with a calm, natural aesthetic.

---

## Tech Stack

- **Frontend**:
  - [Next.js (App Router)](https://nextjs.org/)
  - [Tailwind CSS](https://tailwindcss.com/)
  - [Better Auth](https://www.better-auth.com/) (with MongoDB adapter & client-side avatar resize)
  - [Socket.io Client](https://socket.io/)
  - [React Icons](https://react-icons.github.io/react-icons/)
- **Backend**:
  - [Express](https://expressjs.com/)
  - [Socket.io](https://socket.io/)
  - [MongoDB Native Driver (`mongodb`)](https://www.mongodb.com/)
  - [Multer](https://github.com/expressjs/multer)
  - Single-file architecture: `backend/index.js`

---

## Features

- **Authentication**:
  - Better Auth with email/password and Google social sign-in.
  - Database-backed sessions (no JWT).
  - Signup form with client-side image resizing via HTML5 Canvas (stored as a small data URL in the user's `image` field).
  - Cookie-forwarded session validation for Express endpoints and Socket.io handshakes.
- **Messaging**:
  - **1-on-1 Direct Chats**: Standard sender names and avatars.
  - **Anonymous Group Chats**: Complete sender anonymity (see rule below).
  - Real-time message delivery and typing/read handling via Socket.io with personal rooms (`user:<userId>`).
  - Unread count badge on conversations in the sidebar, reset automatically when a chat is opened.
  - Enter sends messages, Shift+Enter creates new lines.
- **Search & Discovery**:
  - Search bar with a **People / Groups** mode selector.
  - **People**: Search users by name or email and start a direct chat.
  - **Groups**: Filter joined groups by name.
- **Group Management**:
  - Create groups with custom names and member multi-selection.
  - The group creator is designated as the group admin.
  - Admin can add new members or remove existing members (creator cannot be removed).
- **Attachments**:
  - Up to 5 MB file uploads served statically via `/uploads`.
  - Images displayed inline with preview options.
  - Documents and other file types displayed as downloadable cards with file size indicators.
  - Uploaded files are saved with random UUIDs with no user identifiers.
- **Design & UI**:
  - Tailored color palette:
    - Cream (`#F8EADC`): Warm background tone.
    - Deep Green (`#09251C`): Dark surfaces and contrast elements.
    - Amber Brown (`#A55704`): Primary accents and own messages.
  - Chat background: Nature/tree motif (`/public/tree-bg.jpg` with an SVG tree pattern fallback).
  - Fully responsive layout: Mobile toggles between chat list and conversation view with a back button; desktop shows a dual-pane layout.

---

## How the "Hidden Sender in Group Chats" Rule Works

1. **Database Storage**:
   When a user sends a message in a group, the message is persisted in MongoDB with `senderId` for database integrity and moderation purposes.
2. **Message History & API Exclusion**:
   When clients request message history (`GET /api/conversations/:id/messages`), the server checks if the conversation is a group. If it is, `senderId`, sender name, and sender image are **never** returned in the response payload. Instead, the server attaches an `isMine: boolean` flag computed as `msg.senderId === req.user.id`.
3. **Socket.io Real-Time Emission**:
   When a group message is broadcasted in real time, the server iterates over every group member and emits the event individually to each member's personal room (`user:<memberId>`).
   - The sender receives `{ ...msg, isMine: true }`.
   - All other group members receive `{ ...msg, isMine: false }`.
   - In neither case is any sender identifier, name, or avatar ever included.
4. **Visual Presentation**:
   - Group messages where `isMine === true` are styled with the amber brown accent (`#A55704`).
   - Group messages where `isMine === false` are styled with the neutral deep green card (`#09251C`), with no usernames or avatars displayed.
   - The sidebar preview for group chats shows only the text or attachment indicator without any sender name.
5. **File Anonymity**:
   Uploaded attachments are saved with random UUID filenames (`crypto.randomUUID() + ext`), ensuring no user IDs or identities are exposed in file URLs or filesystem paths.

---

## Environment Variables

### Frontend (`frontend/.env`)
```env
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MONGODB_URI=
DB_NAME=
CLIENT_SIDE_PUBLIC_URL=
SERVER_SIDE_PUBLIC_URL=
NEXT_PUBLIC_SERVER_URL=
```

### Backend (`backend/.env`)
```env
PORT=
FRONTEND_URL=
MONGODB_URI=
DB_NAME=
```

> **Note**: Secrets like `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, and `MONGODB_URI` must **never** be prefixed with `NEXT_PUBLIC_`.

---

## Steps to Run

### 1. Prerequisites
- Node.js (v18+)
- MongoDB Atlas cluster or local MongoDB instance

### 2. Backend Setup
1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the backend server:
   ```bash
   npm run dev
   # or
   npm start
   ```
   The backend server will run on `http://localhost:5000`.

### 3. Frontend Setup
1. Open a second terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your web browser.
