# Screencap Codebase Analysis

> Generated: 2026-01-22

## 1. Project Overview

**Screencap** is a macOS desktop application that tracks screen activity through periodic screenshots and provides AI-powered analysis. It answers questions like "What did I actually do today?", "How long did I really work?", and "Am I spending too much time on distractions?"

| Attribute      | Value                                       |
|:---------------|:--------------------------------------------|
| **Type**       | Electron Desktop App + Social Network       |
| **Version**    | 1.17.1                                      |
| **Repository** | https://github.com/yahorbarkouski/screencap |
| **License**    | MIT                                         |
| **Platform**   | macOS (arm64, x64)                          |

### Tech Stack

- **Runtime**: Electron 33, Node.js
- **Frontend**: React 18, TypeScript 5.7
- **Build**: electron-vite 2, Vite 5
- **Database**: SQLite (better-sqlite3)
- **UI**: Radix UI, Tailwind CSS 3, Framer Motion
- **State**: Zustand 5
- **Image Processing**: Sharp 0.33
- **AI Integration**: OpenRouter API, Local LLMs, MCP SDK

---

## 2. Directory Structure

```
screencap/
├── electron/                    # Electron main process
│   ├── main/
│   │   ├── app/               # App initialization, windows, tray
│   │   ├── features/          # 27 feature modules
│   │   ├── infra/             # Database, logging, settings
│   │   └── ipc/               # IPC handlers
│   ├── mcp/                   # Model Context Protocol server
│   ├── preload/               # Preload scripts
│   ├── shared/                # Shared types/utilities
│   ├── ocr/                   # Swift OCR binary source
│   └── assets/                # Sounds, resources
├── src/                        # React renderer
│   ├── components/            # 17 component categories
│   ├── hooks/                 # 9 custom hooks
│   ├── stores/                # Zustand state
│   ├── lib/                   # Utilities
│   └── types/                 # TypeScript definitions
├── docs/                       # Documentation
├── build/                      # Build resources
├── scripts/                    # Build scripts
└── dist/                       # Distribution output
```

---

## 3. File Breakdown

### Code Statistics

| Category                | Count |
|:------------------------|:------|
| TypeScript Files        | 348   |
| React Components (.tsx) | 92    |
| Electron Backend (.ts)  | 223   |
| Database Repositories   | 20    |
| Feature Modules         | 27    |
| Custom Hooks            | 9     |

### Core Files

| File                             | Purpose                                   |
|:---------------------------------|:------------------------------------------|
| `electron/main/index.ts`         | Main process entry (routes to app or MCP) |
| `electron/main/app/bootstrap.ts` | App initialization orchestration          |
| `electron/main/app/window.ts`    | Main window management                    |
| `electron/main/app/tray.ts`      | System tray integration                   |
| `electron/main/app/database.ts`  | SQLite initialization                     |
| `src/main.tsx`                   | React entry point                         |
| `src/App.tsx`                    | Main React application                    |

### Configuration Files

| File                      | Purpose                         |
|:--------------------------|:--------------------------------|
| `package.json`            | Dependencies, scripts, metadata |
| `electron.vite.config.ts` | Build configuration             |
| `electron-builder.yml`    | Distribution packaging          |
| `tsconfig.json`           | TypeScript configuration        |
| `tailwind.config.js`      | Styling configuration           |

---

## 4. Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Timeline │  │  Story   │  │ Projects │  │ Settings │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       └──────────────┴──────────────┴──────────────┘            │
│                              │                                   │
│                      ┌───────▼───────┐                          │
│                      │ Zustand Store │                          │
│                      └───────┬───────┘                          │
└──────────────────────────────┼──────────────────────────────────┘
                               │ IPC
┌──────────────────────────────┼──────────────────────────────────┐
│                        MAIN PROCESS                              │
│                      ┌───────▼───────┐                          │
│                      │  IPC Handlers │ (50+ channels)           │
│                      └───────┬───────┘                          │
│       ┌──────────────────────┼──────────────────────┐           │
│       │                      │                      │           │
│  ┌────▼────┐           ┌─────▼─────┐          ┌────▼────┐      │
│  │ Capture │           │   LLM     │          │  Social │      │
│  │ Service │           │ Classify  │          │ Service │      │
│  └────┬────┘           └─────┬─────┘          └────┬────┘      │
│       │                      │                      │           │
│  ┌────▼────┐           ┌─────▼─────┐          ┌────▼────┐      │
│  │ Context │           │    OCR    │          │  Rooms  │      │
│  │ Service │           │  Service  │          │ (E2EE)  │      │
│  └────┬────┘           └───────────┘          └─────────┘      │
│       │                                                         │
│       └────────────────────┬────────────────────────────────    │
│                      ┌─────▼─────┐                              │
│                      │  SQLite   │ (20 repositories)            │
│                      │  Database │                              │
│                      └───────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                               │
                      ┌────────▼────────┐
                      │   MCP Server    │ (Claude integration)
                      └─────────────────┘
```

### Data Flow

1. **Scheduler** triggers periodic captures (configurable interval)
2. **CaptureService** saves screenshots (thumbnail + original WebP)
3. **ContextService** enriches with app/window/URL/media context
4. **ClassificationService** runs two-stage LLM classification
5. **EventService** merges into timeline (deduplication via fingerprints)
6. **Renderer** fetches events via IPC and displays

### IPC Communication

50+ channels organized by domain:

| Domain  | Examples                                            |
|:--------|:----------------------------------------------------|
| App     | `app:quit`, `app:get-info`, `app:preview-event`     |
| Capture | `capture:all-displays`, `capture:trigger`           |
| Storage | `storage:get-events`, `storage:delete-event`        |
| LLM     | `llm:classify`, `llm:generate-story`                |
| OCR     | `ocr:recognize`                                     |
| Social  | `social:get-identity`, `social:send-friend-request` |
| Rooms   | `rooms:ensure-project-room`, `rooms:list-invites`   |

---

## 5. Feature Modules

### Core Features

| Feature       | Location              | Purpose                          |
|:--------------|:----------------------|:---------------------------------|
| **Capture**   | `features/capture/`   | Multi-display screenshot capture |
| **Scheduler** | `features/scheduler/` | Periodic capture scheduling      |
| **Context**   | `features/context/`   | App/window/URL/media extraction  |
| **LLM**       | `features/llm/`       | AI classification service        |
| **OCR**       | `features/ocr/`       | Text recognition (macOS Vision)  |
| **Events**    | `features/events/`    | Event creation, merging          |
| **Queue**     | `features/queue/`     | Async job processing             |

### AI & Classification

| Feature          | Location                 | Purpose                   |
|:-----------------|:-------------------------|:--------------------------|
| **AI Providers** | `features/ai/providers/` | 5 classification backends |
| **AI Eval**      | `features/aiEval/`       | Classification evaluation |
| **Automation**   | `features/automation/`   | Per-app/website rules     |

### Social & Collaboration

| Feature         | Location               | Purpose                    |
|:----------------|:-----------------------|:---------------------------|
| **Social**      | `features/social/`     | Identity, friends, avatars |
| **Rooms**       | `features/rooms/`      | E2EE project collaboration |
| **Chat**        | `features/chat/`       | DM and project threads     |
| **Publishing**  | `features/publishing/` | Public share links         |
| **Social Feed** | `features/socialFeed/` | Activity sharing           |

### Data & Storage

| Feature             | Location                   | Purpose                 |
|:--------------------|:---------------------------|:------------------------|
| **Projects**        | `features/projects/`       | Project detection       |
| **Project Journal** | `features/projectJournal/` | Git integration         |
| **Retention**       | `features/retention/`      | Data cleanup policies   |
| **App Icons**       | `features/appIcons/`       | Icon caching            |
| **Favicons**        | `features/favicons/`       | Website favicon caching |

---

## 6. Database Schema

SQLite database with 20 repositories:

### Core Tables

| Table               | Purpose                    |
|:--------------------|:---------------------------|
| `events`            | Main activity snapshots    |
| `event_screenshots` | Multi-display captures     |
| `memories`          | User-defined tracked items |
| `stories`           | AI-generated narratives    |
| `eod_entries`       | End-of-day journal entries |

### Cache Tables

| Table          | Purpose                |
|:---------------|:-----------------------|
| `app_icons`    | Application icon cache |
| `favicons`     | Website favicon cache  |
| `room_*_cache` | Encrypted room data    |

### Social Tables

| Table            | Purpose              |
|:-----------------|:---------------------|
| `social_account` | User identity        |
| `project_repos`  | Git repository links |

---

## 7. AI Integration

### Classification Pipeline

Two-stage LLM classification:

1. **Stage 1**: Category, project progress, addiction candidates
2. **Stage 2**: Addiction confirmation with evidence

### AI Providers

| Provider                   | Type       | Purpose                            |
|:---------------------------|:-----------|:-----------------------------------|
| `LocalBaselineProvider`    | Rule-based | Baseline classification            |
| `LocalOpenAIProvider`      | Local LLM  | OpenAI-compatible local models     |
| `LocalRetrievalProvider`   | RAG        | Retrieval-augmented classification |
| `OpenRouterTextProvider`   | Cloud API  | Text-based classification          |
| `OpenRouterVisionProvider` | Cloud API  | Vision model classification        |

### MCP Server

Built-in Model Context Protocol server for Claude integration:

**Resources**:
- `screencap://activity/today` - Today's events
- `screencap://activity/recent` - Last 2 hours
- `screencap://stats/today` - Category breakdown
- `screencap://stats/week` - Weekly statistics
- `screencap://projects` - Project list
- `screencap://stories/latest` - Generated narratives

**Tools**: Event queries, project analytics, activity summaries

---

## 8. React Components

### Component Categories

| Category      | Purpose                                 |
|:--------------|:----------------------------------------|
| `layout/`     | Titlebar, Sidebar, AppBackdrop          |
| `timeline/`   | Event timeline, filtering, bulk actions |
| `memory/`     | Addictions, projects, memories          |
| `eod/`        | End-of-day guided flow                  |
| `story/`      | Daily journal, stats                    |
| `progress/`   | Project milestones                      |
| `settings/`   | Configuration tabs                      |
| `popup/`      | Tray widgets                            |
| `preview/`    | Event detail modal                      |
| `onboarding/` | Setup wizard                            |
| `ui/`         | 22 Radix-based primitives               |

### Custom Hooks

| Hook                  | Purpose                         |
|:----------------------|:--------------------------------|
| `useEvents`           | Fetch/filter events             |
| `useSettings`         | Settings state sync             |
| `useMemories`         | Addictions/projects/preferences |
| `usePermission`       | OS permission management        |
| `useOnboardingStatus` | Onboarding state                |

---

## 9. Setup Guide

### Prerequisites

- Node.js 20+
- macOS 12+ (Monterey or later)
- Xcode Command Line Tools (for OCR binary)

### Installation

```bash
# Clone repository
git clone https://github.com/yahorbarkouski/screencap.git
cd screencap

# Install dependencies
npm install

# Build OCR binary for development
mkdir -p build/ocr
xcrun swiftc -O -target arm64-apple-macosx12.0 \
  -framework Vision -framework ImageIO -framework CoreGraphics \
  electron/ocr/ScreencapOCR.swift -o build/ocr/screencap-ocr

# Start development
npm run dev
```

### Build Commands

| Command               | Purpose                        |
|:----------------------|:-------------------------------|
| `npm run dev`         | Development with hot reload    |
| `npm run dev:fast`    | Fast dev (skip native rebuild) |
| `npm run build`       | Build for production           |
| `npm run build:local` | Build without code signing     |
| `npm run build:mcp`   | Build MCP server               |
| `npm run test`        | Run tests                      |
| `npm run lint`        | Lint with Biome                |
| `npm run typecheck`   | TypeScript check               |

### Environment Variables

| Variable        | Purpose                                   |
|:----------------|:------------------------------------------|
| `LOG_LEVEL`     | Logging verbosity (debug/info/warn/error) |
| `SCREENCAP_MCP` | Enable MCP server mode                    |

---

## 10. Security Model

### Electron Security

- Hardened runtime on macOS
- Content Security Policy in production
- No remote module
- Context isolation enabled
- Sandboxed preload scripts

### Data Security

- Local SQLite database (user data stays local)
- E2E encryption for shared rooms (TweetNaCl.js)
- No screenshots sent to cloud (only metadata for classification)

### Permissions Required

| Permission       | Purpose                       |
|:-----------------|:------------------------------|
| Screen Recording | Screenshot capture            |
| Accessibility    | Window/app context extraction |
| Automation       | AppleScript for browser URLs  |

---

## 11. Testing

### Test Infrastructure

- **Framework**: Vitest
- **Location**: `electron/main/**/*.test.ts`

### Test Coverage

- Classification evaluation suite
- Automation rules validation
- OCR output parsing
- Encryption/decryption
- Database operations

---

## 12. Documentation

| Document                           | Purpose               |
|:-----------------------------------|:----------------------|
| `docs/security.md`                 | Security model        |
| `docs/security-sharing.md`         | E2E encryption design |
| `docs/mcp-server.md`               | MCP integration       |
| `docs/local-llm.md`                | Local LLM setup       |
| `docs/multiplayer-architecture.md` | Rooms design          |
| `docs/friends-rooms-e2ee.md`       | Social encryption     |

---

## 13. Recommendations

### Code Quality

- Strong TypeScript coverage with strict mode
- Zod validation on all IPC boundaries
- Feature-based architecture enables isolation

### Performance Considerations

- Virtual scrolling for large event lists
- FPS guard component for UI performance
- Fingerprint-based deduplication reduces storage

### Potential Improvements

1. **Cross-platform**: Currently macOS only; Windows/Linux would require alternative context providers
2. **Tests**: Increase unit test coverage for services
3. **Localization**: UI is English-only; date-fns ready for i18n
4. **Offline LLM**: Better support for fully offline classification

### Security Notes

- OCR and screenshots never leave device (only text sent to LLM APIs)
- Room encryption uses public-key cryptography
- No telemetry or analytics collection
