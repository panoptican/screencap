# Self-Hosted Backend Setup

Screencap uses a backend server for social features like friends, shared projects, and collaborative rooms. By default, it connects to the official hosted backend, but you can deploy your own instance for privacy or team use.

## Architecture Overview

The backend is a Next.js application that provides:

- **User registration** with Ed25519 cryptographic key pairs
- **Friends system** with friend requests and relationships
- **Rooms** for collaborative project sharing
- **End-to-end encrypted** event sharing
- **Chat messaging** between friends and room members
- **Rate limiting** and request signature verification

All sensitive data (screenshots, event content) is encrypted client-side before upload. The server only stores encrypted blobs and cannot read your content.

## Requirements

- Node.js 18+ or Bun
- PostgreSQL database (Vercel Postgres, Supabase, Neon, or self-hosted)

## Quick Start with Vercel

The easiest way to deploy your own backend:

### 1. Fork the Repository

Fork [`screencap-website`](https://github.com/yourorg/screencap-website) to your GitHub account.

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and create a new project
2. Import your forked repository
3. Add a Postgres database:
   - In your project dashboard, go to **Storage** → **Create Database** → **Postgres**
   - Vercel will automatically set the `POSTGRES_*` environment variables

### 3. Initialize the Database

After deployment, initialize the database schema:

```bash
curl -X POST https://your-deployment.vercel.app/api/init
```

You should receive:
```json
{"success": true, "message": "Database initialized"}
```

### 4. Configure Screencap

In the Screencap app:

1. Open **Settings** → **System**
2. Enable **Use custom backend**
3. Enter your deployment URL (e.g., `https://your-deployment.vercel.app`)
4. Click **Test** to verify the connection
5. Click **Save**

## Manual Deployment

For other platforms (Railway, Render, AWS, self-hosted):

### 1. Clone and Install

```bash
git clone https://github.com/yourorg/screencap-website.git
cd screencap-website
npm install  # or bun install
```

### 2. Configure Environment

Create `.env.local`:

```env
POSTGRES_URL="postgres://user:password@host:5432/database?sslmode=require"
POSTGRES_PRISMA_URL="postgres://user:password@host:5432/database?sslmode=require"
POSTGRES_URL_NON_POOLING="postgres://user:password@host:5432/database?sslmode=require"
```

### 3. Build and Run

```bash
npm run build
npm start
```

Or for development:

```bash
npm run dev
```

### 4. Initialize Database

```bash
curl -X POST http://localhost:3000/api/init
```

## Database Schema

The backend creates these tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts with usernames |
| `user_devices` | Device keys for authentication |
| `friend_requests` | Pending friend requests |
| `friendships` | Established friendships |
| `user_blocks` | Blocked users |
| `rooms` | Collaborative rooms/projects |
| `room_members` | Room membership and roles |
| `room_invites` | Pending room invitations |
| `room_member_keys` | E2EE key distribution |
| `room_events` | Encrypted shared events |
| `chat_threads` | Chat conversations |
| `chat_messages` | Individual messages |
| `published_projects` | Public project pages |
| `rate_limits` | API rate limiting |

## API Endpoints

### Authentication

All authenticated endpoints require these headers:
- `x-user-id`: User ID
- `x-device-id`: Device ID
- `x-ts`: Unix timestamp (ms)
- `x-sig`: Ed25519 signature of `METHOD\nPATH\nTS\nBODY_SHA256`

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/init` | Initialize database |
| `POST` | `/api/users/register` | Register new user |

### Authenticated Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/me` | Get current user info |
| `POST` | `/api/users/rename` | Change username |
| `GET/POST` | `/api/friends` | List friends / Send request |
| `POST` | `/api/friends/requests/:id/accept` | Accept friend request |
| `GET/POST` | `/api/rooms` | List rooms / Create room |
| `GET` | `/api/rooms/:id/members` | List room members |
| `POST` | `/api/rooms/:id/invites` | Invite user to room |
| `GET/POST` | `/api/rooms/:id/events` | List / Create room events |
| `GET` | `/api/chats` | List chat threads |
| `POST` | `/api/chats/:threadId/messages` | Send message |

## Security Considerations

### Request Signing

Every authenticated request is signed with the user's Ed25519 private key:

```
canonical = METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + SHA256(BODY)
signature = Ed25519.sign(canonical, privateKey)
```

The server verifies signatures using the public key registered during account creation.

### End-to-End Encryption

Room events and images are encrypted client-side using:
- **AES-256-GCM** for event payloads
- **X25519** for key exchange between room members
- Room keys are distributed via encrypted envelopes

The server never sees plaintext event content or images.

### Rate Limiting

Default limits (configurable):
- User registration: 5 requests/hour per IP
- API calls: 100 requests/minute per user

## Monitoring

### Health Check

```bash
curl https://your-backend.vercel.app/api/init
```

### Logs

On Vercel: **Project** → **Logs** → **Runtime Logs**

For self-hosted: Check your application logs for errors.

## Troubleshooting

### "Connection timed out"

- Verify the URL is correct and accessible
- Check if the server is running
- Ensure HTTPS is configured for production

### "Server returned 500"

- Check server logs for database connection errors
- Verify PostgreSQL is running and accessible
- Run `/api/init` to ensure tables exist

### "Database not initialized"

Run the initialization endpoint:
```bash
curl -X POST https://your-backend/api/init
```

### "Invalid signature"

- Ensure client and server clocks are synchronized (within 5 minutes)
- Verify the user's device keys are correctly stored
- Ensure your backend is up-to-date (older backends verified signatures using only the URL pathname and will reject requests where the client signs pathname + query string, e.g. `fetchRoomEvents?since=...`)

## Migrating Between Backends

**Warning**: User accounts and social data cannot be migrated between backends. Switching backends requires creating a new account.

To migrate:
1. Disable sharing in Screencap settings
2. Change the backend URL
3. Create a new username on the new backend
4. Re-add friends and recreate rooms

Local data (screenshots, timeline) is unaffected.

## Updates

When updating your backend:

1. Pull the latest changes from the repository
2. Run `npm install` to update dependencies
3. Deploy the new version
4. The database schema is designed to be backwards-compatible

For breaking changes, check the release notes and migration guides.
