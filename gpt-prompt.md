# Build TextDrop — Peer-to-Peer Text & File Transfer Web App

Build a production-ready web app called **TextDrop**.

## 1. Product Concept

TextDrop is a minimal, temporary, browser-based device-to-device transfer tool.

Example:

1. User opens TextDrop on a laptop.
2. Clicks **Create Room**.
3. App generates a short random room code, e.g. `Ajrx2`.
4. App displays:

   * room code
   * shareable URL
   * QR code
5. User scans the QR code using their phone.
6. Phone opens the same room.
7. Laptop and phone establish a **WebRTC peer-to-peer connection**.
8. User can send:

   * text
   * images
   * arbitrary files
9. Data should travel directly between peers whenever possible.
10. The application should NOT require user accounts.

The primary goal is:

> **Transfer something from one device to another with almost zero setup and zero persistent storage.**

---

# 2. Important Architecture Requirement

Do NOT build this using a traditional backend that relays all messages/files.

Do NOT use:

* Firebase for message storage
* Supabase for message storage
* PostgreSQL
* MongoDB
* Redis
* S3
* Cloud storage
* Socket.IO as the data-transfer mechanism

Use:

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

### Device communication

* WebRTC
* `RTCPeerConnection`
* `RTCDataChannel`

### Signaling

Use a **minimal signaling server only for WebRTC connection negotiation**.

The signaling server must NOT store or relay normal TextDrop messages/files.

Its job is essentially:

```text
Peer A
  │
  │ SDP / ICE information
  ▼
Signaling Server
  │
  ▼
Peer B
```

After WebRTC is connected:

```text
Peer A
   ═══════════════════════
       WebRTC DataChannel
   ═══════════════════════
Peer B
```

Actual text/files should use the DataChannel.

---

# 3. Hosting Goal

The application should be designed around **free/minimal hosting**.

Frontend should be deployable to Netlify.

The signaling server should be extremely lightweight and stateless.

Do not introduce unnecessary infrastructure.

Ideal deployment:

```text
GitHub
   │
   ├── Netlify
   │     └── React frontend
   │
   └── Lightweight signaling server
         └── WebSocket/WebSocket-compatible signaling
```

The signaling server should only maintain temporary room/peer state in memory.

No database.

No persistent storage.

If the signaling server restarts, rooms can disappear. That is acceptable.

Document free/low-cost deployment options in the README, but don't add unnecessary third-party dependencies just for deployment.

---

# 4. Room System

When the user clicks:

**Create Room**

generate a cryptographically random room ID.

Example:

```text
Ajrx2
```

Do not use predictable sequential IDs.

Prefer something with enough entropy to prevent trivial room guessing.

The URL should look like:

```text
https://textdrop.app/#Ajrx2
```

or an equivalent URL structure.

When the app loads:

* no room → show Create Room / Join Room UI
* room exists in URL → automatically attempt to join it

Room should have a maximum lifetime.

Because there is no persistent database, room expiration can be handled in memory by the signaling server.

Suggested default:

```text
Room lifetime: 2 hours
```

Also remove rooms when no peers remain.

---

# 5. QR Code

When a room is created, generate a QR code containing the room URL.

Example:

```text
https://textdrop.app/#Ajrx2
```

The QR code should be easy to scan from a phone.

Include:

```text
Room: AJRX2

[ QR CODE ]

Scan with your phone
```

Also provide:

**Copy Link**

button.

---

# 6. Connection States

The UI should clearly communicate connection state.

Possible states:

```text
Creating room
Waiting for another device
Connecting
Connected
Disconnected
Connection failed
```

Example:

```text
● Waiting for device...
```

Then:

```text
● Phone connected
```

Do not use confusing technical terminology in the main UI.

---

# 7. Text Transfer

The primary feature is text transfer.

UI:

```text
┌──────────────────────────────────────┐
│ Paste or type something...           │
│                                      │
│                                      │
└──────────────────────────────────────┘

              [ Send ]
```

When sent:

```text
Laptop
   │
   │ WebRTC DataChannel
   ▼
Phone
```

Text should appear immediately on the receiving device.

Each received item should provide:

**Copy**

button.

Do not automatically send every keystroke.

Send only when the user explicitly presses Send, unless implementing a clearly separated optional "live clipboard" feature.

---

# 8. Clipboard

Add:

**Paste from clipboard**

where browser permissions allow it.

Also provide:

**Copy**

for received text.

Gracefully handle browsers that deny clipboard access.

Never assume clipboard permissions are available.

---

# 9. File Transfer

Support arbitrary files.

Examples:

```text
PDF
DOCX
XLSX
ZIP
PNG
JPG
WEBP
MP3
MP4
TXT
JSON
APK
EXE
etc.
```

Do not restrict file extensions.

Use:

```text
File
├── name
├── size
├── type
└── binary data
```

Send files using WebRTC DataChannel.

## IMPORTANT: Chunk large files

Do NOT send an entire large file in one DataChannel message.

Implement chunked transfer.

Conceptually:

```text
file
 ↓
chunk
chunk
chunk
chunk
...
 ↓
WebRTC DataChannel
 ↓
receiver
 ↓
reassemble
 ↓
Blob
 ↓
download
```

Use a reasonable chunk size.

Implement backpressure using `RTCDataChannel.bufferedAmount` / `bufferedAmountLowThreshold`.

Do not overwhelm the browser's DataChannel buffer.

---

# 10. File Transfer Protocol

Design a simple application-level protocol.

For example:

```typescript
type Message =
  | {
      type: "text";
      id: string;
      content: string;
      timestamp: number;
    }
  | {
      type: "file-start";
      id: string;
      name: string;
      mimeType: string;
      size: number;
    }
  | {
      type: "file-chunk";
      id: string;
      sequence: number;
      data: ArrayBuffer;
    }
  | {
      type: "file-end";
      id: string;
    };
```

You may improve this protocol if necessary.

Do NOT blindly use JSON for large binary chunks.

Binary file chunks should remain binary.

---

# 11. Transfer Progress

For files, show:

```text
Sending photo.jpg

██████████████░░░░░░ 72%

8.2 MB / 11.4 MB
```

On receiver:

```text
Receiving photo.jpg

██████████░░░░░░░░░░ 48%

5.5 MB / 11.4 MB
```

After completion:

```text
✓ photo.jpg received

[ Download ]
```

---

# 12. Drag & Drop

Support:

```text
Drag files here
```

as well as:

```text
[ Choose File ]
```

Make the drop area obvious but visually minimal.

---

# 13. Multiple Files

Allow multiple files to be selected.

Example:

```text
3 files selected

photo.jpg
document.pdf
project.zip

[ Send All ]
```

Transfers can be sequential to avoid saturating the DataChannel.

Do not unnecessarily complicate the protocol with parallel transfers initially.

---

# 14. Images

For received images:

```text
┌─────────────────────┐
│                     │
│      image.jpg      │
│                     │
└─────────────────────┘

[ Copy ] [ Download ]
```

Display a preview when practical.

Do not upload images to a server.

The image should remain local to the browser.

---

# 15. Privacy

The application should be designed so that:

* no login is required
* no user account exists
* no message database exists
* no file storage exists
* signaling server does not persist message/file contents
* normal data transfer occurs over WebRTC DataChannel

Clearly communicate this without making exaggerated security claims.

For example:

> "Files and text are transferred directly between connected devices when a peer-to-peer connection is available."

Do NOT claim:

> "Your data can never touch a server."

because WebRTC may use TURN relays depending on network conditions.

---

# 16. STUN / TURN

Configure WebRTC ICE servers.

Use public/free STUN infrastructure where appropriate for development.

Structure configuration through environment variables.

Example:

```env
VITE_STUN_SERVER=...
```

Do not hardcode credentials.

If TURN support is implemented, keep credentials configurable.

Explain in README:

* STUN helps peers discover connectivity
* direct peer-to-peer connections are preferred
* TURN may relay traffic when direct connectivity fails
* TURN bandwidth can become a hosting/cost consideration

Do not pretend WebRTC guarantees direct connectivity in every network.

---

# 17. Signaling Server

Create a tiny signaling server.

Responsibilities:

### Create room

```text
create-room
```

### Join room

```text
join-room
```

### Exchange:

```text
offer
answer
ice-candidate
```

### Leave room

```text
leave-room
```

The server should maintain only temporary in-memory information.

Example conceptual structure:

```typescript
Map<RoomId, Set<PeerId>>
```

Do not store actual TextDrop messages/files.

Do not add a database.

Use WebSocket-based signaling.

---

# 18. Room Security

Room IDs must have sufficient entropy.

Do not make a room ID such as:

```text
1234
```

Use something substantially harder to guess.

The room ID is effectively a bearer secret.

Additionally:

* limit room size
* initially support 2 peers
* reject additional peers or clearly handle them
* expire inactive rooms
* clean disconnected peers
* validate signaling messages
* limit message sizes on the signaling server
* never trust client-provided room metadata

For MVP, **2 devices per room is preferred**.

---

# 19. No Authentication

Do not implement:

* email login
* Google login
* passwords
* account creation

The room URL/code is the access mechanism.

---

# 20. UX

The app should feel like a polished utility rather than a social application.

Visual direction:

* clean
* modern
* minimal
* fast
* desktop + mobile responsive
* no unnecessary gradients
* no excessive animations
* no emoji-heavy UI
* clear typography
* obvious primary actions

Main screen should be understandable within seconds.

Possible landing screen:

```text
TextDrop

Send text and files
between your devices.

[ Create Room ]

or

[ Join Room ]
```

After creating:

```text
TextDrop

Room: AJRX2

[ QR CODE ]

Scan to connect

Waiting for your other device...
```

After connection:

```text
TextDrop

● Connected

┌───────────────────────────────┐
│ Paste text here...            │
│                               │
└───────────────────────────────┘

[ Send ]

─────────────────────────────────

Drop files here

or

[ Choose Files ]
```

---

# 21. Responsive Design

Desktop:

```text
┌──────────────────────────────────────────┐
│ TextDrop                         ● Phone │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Paste text...                        │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ [ Send ]                                 │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Drop files here                      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ History                                  │
│ ...                                      │
└──────────────────────────────────────────┘
```

Mobile should be equally usable.

Do not require horizontal scrolling.

---

# 22. Message History

For MVP, keep transfer history **in browser memory only**.

Do not persist it to a database.

Optionally use localStorage only if there is a clear UX benefit, but default to memory-only.

When the page is refreshed, history may disappear.

This is acceptable.

---

# 23. Error Handling

Handle:

* peer disconnect
* browser doesn't support WebRTC
* DataChannel closes unexpectedly
* ICE failure
* signaling server unavailable
* room expired
* room doesn't exist
* room already has two peers
* file transfer interrupted
* browser storage limitations
* clipboard permission denied
* file too large
* invalid room ID

Give users human-readable messages.

Avoid showing raw WebRTC errors to normal users.

---

# 24. Browser Support

Target modern:

* Chrome
* Edge
* Firefox
* Safari
* Android Chrome
* iOS Safari

Use feature detection.

Show a useful message if WebRTC DataChannel isn't supported.

---

# 25. TypeScript Requirements

Use strict TypeScript.

Do NOT use:

```typescript
any
```

Do not disable ESLint rules merely to make the implementation pass.

Create proper types for:

* room
* peer
* signaling messages
* data messages
* file transfer
* connection state
* transfer state

Keep functions small and reusable.

---

# 26. Suggested Project Structure

Use a clean structure similar to:

```text
src/
├── components/
│   ├── RoomScreen.tsx
│   ├── CreateRoom.tsx
│   ├── JoinRoom.tsx
│   ├── QRCode.tsx
│   ├── ConnectionStatus.tsx
│   ├── TextComposer.tsx
│   ├── FileDropzone.tsx
│   ├── TransferList.tsx
│   └── TransferItem.tsx
│
├── hooks/
│   ├── useWebRTC.ts
│   ├── useRoom.ts
│   └── useClipboard.ts
│
├── lib/
│   ├── webrtc/
│   │   ├── peerConnection.ts
│   │   ├── dataChannel.ts
│   │   ├── fileTransfer.ts
│   │   └── protocol.ts
│   │
│   ├── signaling/
│   │   └── signalingClient.ts
│   │
│   └── room/
│       └── roomId.ts
│
├── types/
│   ├── signaling.ts
│   ├── transfer.ts
│   └── room.ts
│
└── App.tsx

server/
├── src/
│   ├── index.ts
│   ├── rooms.ts
│   └── signaling.ts
└── package.json
```

Adjust the structure if you have a better architecture, but keep frontend and signaling concerns separated.

---

# 27. QR Code Library

Use a lightweight, well-maintained QR code library rather than implementing QR generation manually.

Keep dependencies minimal.

---

# 28. Testing

Implement tests for the important non-UI logic.

At minimum test:

* room ID generation
* room URL parsing
* signaling message validation
* file chunking
* file chunk reassembly
* transfer progress calculation
* invalid messages
* interrupted transfer handling

If practical, add an integration test demonstrating:

```text
Peer A
   ↓
send text
   ↓
Peer B
   ↓
receive text
```

---

# 29. README

Create a useful README explaining:

## What is TextDrop?

A temporary peer-to-peer text and file transfer tool.

## Architecture

Explain:

```text
React
  ↓
Signaling server
  ↓
WebRTC DataChannel
  ↓
Peer
```

Make it very clear that the signaling server is **not the normal data relay**.

Explain STUN/TURN.

Explain limitations.

Explain local development.

Example:

```bash
npm install
npm run dev
```

and how to start the signaling server.

Explain environment variables.

Explain Netlify deployment.

Explain how to deploy the signaling server to a free/low-cost platform.

Do not assume the user wants a database.

---

# 30. MVP Priority

Do not over-engineer.

Build in this order:

### Phase 1

```text
Create room
↓
QR code
↓
Join room
↓
Signaling
↓
WebRTC connection
↓
Text transfer
```

### Phase 2

```text
Clipboard
↓
File transfer
↓
Chunking
↓
Progress
```

### Phase 3

```text
Image preview
↓
Multiple files
↓
Better UX
↓
Error handling
↓
Responsive polish
```

Do not start with advanced features before proving the WebRTC connection works.

---

# 31. Critical Requirement

Before implementing the complete UI, make sure the underlying architecture works.

Create a minimal end-to-end proof:

```text
Browser A
   ↓
create room
   ↓
Browser B
   ↓
join room
   ↓
signaling
   ↓
WebRTC connected
   ↓
Browser A sends "hello"
   ↓
Browser B receives "hello"
```

Then expand it into the full application.

---

# 32. Final Product Goal

The finished experience should feel like:

> "I want to move this text/file from my laptop to my phone."

Open:

```text
TextDrop
```

Create:

```text
AJRX2
```

Scan QR.

Connected.

Paste file/text.

Send.

Done.

No account.

No database.

No upload UI.

No complicated setup.

Keep the implementation lightweight, reliable, secure-by-default, and easy to deploy for essentially zero infrastructure cost at small personal-project scale.
