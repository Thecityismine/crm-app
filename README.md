# CRM — Built for the Future

A commercial real estate CRM built with React + Firebase + Claude AI.

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Database**: Firebase Firestore
- **Auth**: Firebase Auth (Email + Google SSO)
- **Storage**: Firebase Storage
- **State**: Zustand
- **AI**: Anthropic Claude API (via Firebase Cloud Functions)
- **Routing**: React Router v6

## Getting Started

### 1. Clone and install
```bash
npm install
```

### 2. Set up Firebase
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable Firestore, Auth (Email + Google), and Storage
4. Copy your config into `.env.local`

### 3. Configure environment
```bash
cp .env.example .env.local
# Fill in your Firebase config values
```

### 4. Run locally
```bash
npm run dev
```

### 5. Deploy
```bash
npm run build
firebase deploy
```

## Project Structure
```
src/
├── config/          # Firebase init, constants, routes
├── lib/
│   ├── firebase/    # Firestore CRUD for each collection
│   ├── ai/          # Claude AI helpers (deal coach, pre-brief, etc.)
│   └── integrations/ # Notion import, GanttFlow sync
├── store/           # Zustand global state
├── hooks/           # Custom React hooks
├── components/      # UI components organized by feature
├── pages/           # Route-level page components
└── utils/           # Formatters, validators, helpers
```

## Build Order
1. ✅ Auth (Login page + Firebase Auth)
2. 🔲 Contacts — list, detail, create/edit
3. 🔲 Companies — list, detail
4. 🔲 Pipeline — Kanban board with stages
5. 🔲 Deals — deal records + deal room
6. 🔲 Tasks — task list + reminders
7. 🔲 Properties + Leases
8. 🔲 Activity timeline
9. 🔲 Email integration (Gmail API)
10. 🔲 AI features (Claude API via Cloud Functions)
11. 🔲 Notion import
12. 🔲 Workflow automation
