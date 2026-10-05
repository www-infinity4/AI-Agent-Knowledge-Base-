# Infinity Knowledge Base — AI Agent

A full-stack knowledge management system using the existing Rogers AI gateway plus a local fallback, Node.js/Express, and a modern dark-themed UI. It does not ask users for an AI provider key, signup, credit card, or paid API.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)

## ✨ Features

- **📚 Knowledge Base Management** — Add, edit, delete, and search knowledge entries with categories and tags
- **🤖 Rogers Knowledge Agent** — Ask questions against your saved knowledge base through the existing Rogers AI gateway
- **✨ Rogers Entry Drafting** — Generate structured entries through the same Rogers AI path used by the Phi system
- **🔍 AI Summarization** — Instantly summarize any knowledge entry with one click
- **📊 Dashboard** — Visual overview with stats, recent entries, category breakdown, and quick AI chat
- **🏷️ Tags & Categories** — Organize knowledge with flexible tagging and categorization
- **👁️ Entry Viewer** — Rich markdown rendering with view tracking
- **📱 Responsive Design** — Works on desktop, tablet, and mobile

## 🚀 Quick Start

### Prerequisites

- Node.js 18+

### Installation

```bash
# Clone the repository
git clone https://github.com/www-infinity4/AI-Agent-Knowledge-Base-.git
cd AI-Agent-Knowledge-Base-

# Install dependencies
npm install

# Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Only ordinary server settings are used; no AI provider key is required.

```env
PORT=3000
NODE_ENV=development
```

## 🏗️ Architecture

```
├── server.js              # Express backend + Rogers AI gateway + local fallback
├── public/
│   ├── index.html         # Single-page application HTML
│   ├── styles.css         # Dark theme CSS with animations
│   └── app.js             # Frontend JavaScript
├── data/
│   └── knowledge.json     # Knowledge base storage (auto-created)
├── .env.example           # Environment variable template
└── package.json
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/knowledge` | List all entries (supports `search`, `category`, `tag` filters) |
| `GET` | `/api/knowledge/stats` | Dashboard statistics |
| `POST` | `/api/knowledge` | Create a new entry |
| `PUT` | `/api/knowledge/:id` | Update an entry |
| `DELETE` | `/api/knowledge/:id` | Delete an entry |
| `POST` | `/api/chat` | Search and synthesize the local knowledge base |
| `POST` | `/api/chat/generate` | Generate a knowledge entry with AI |
| `POST` | `/api/chat/summarize` | Summarize an entry with AI |
| `GET` | `/api/status` | Server health check |

## 🤖 Rogers AI

Chat, drafting, and summarization route through the existing Rogers AI gateway. If Rogers is temporarily unavailable, read-only chat/summarization can fall back to local saved knowledge. The app never asks the user for an external model key or payment.

## 📸 Screenshots

The app features a sleek dark interface with:
- **Dashboard** — Stats cards, recent entries, AI quick-ask panel
- **Knowledge Base** — Grid/list view with search, filter, and inline actions
- **AI Chat** — Full chat interface with typing indicators and source citations
- **Add/Edit** — Markdown editor with live preview and AI generation

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **AI:** Rogers AI gateway with local fallback
- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework, zero build step)
- **Storage:** JSON file-based persistence
- **Fonts:** Inter + Space Grotesk

## 📄 License

MIT © Infinity AI
<script src="https://www-infinity4.github.io/Mint-For-Infinity/infinity-wallet-menu.js" defer></script>
