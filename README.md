# Infinity Knowledge Base — AI Agent

A full-stack AI-powered knowledge management system built with **Google Gemini 2.0 Flash**, Node.js/Express, and a modern dark-themed UI.

![Infinity Knowledge Base](https://img.shields.io/badge/Powered%20by-Gemini%202.0%20Flash-blue?style=flat-square&logo=google)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)

## ✨ Features

- **📚 Knowledge Base Management** — Add, edit, delete, and search knowledge entries with categories and tags
- **🤖 AI Chat Agent** — Chat with your personal Gemini-powered AI that has full access to your knowledge base
- **✨ AI Entry Generation** — Generate comprehensive knowledge entries from any topic using Gemini
- **🔍 AI Summarization** — Instantly summarize any knowledge entry with one click
- **🌐 Web Search Grounding** — Enable real-time web search in AI responses for up-to-date information
- **📊 Dashboard** — Visual overview with stats, recent entries, category breakdown, and quick AI chat
- **🏷️ Tags & Categories** — Organize knowledge with flexible tagging and categorization
- **👁️ Entry Viewer** — Rich markdown rendering with view tracking
- **📱 Responsive Design** — Works on desktop, tablet, and mobile

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- A Google Gemini API key ([Get one free](https://aistudio.google.com/app/apikey))

### Installation

```bash
# Clone the repository
git clone https://github.com/www-infinity4/AI-Agent-Knowledge-Base-.git
cd AI-Agent-Knowledge-Base-

# Install dependencies
npm install

# Configure your API key
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

> **Note:** The knowledge base CRUD features work without an API key. Only AI chat, generation, and summarization require `GEMINI_API_KEY`.

## 🏗️ Architecture

```
├── server.js              # Express backend + Gemini API integration
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
| `POST` | `/api/chat` | Send a message to Gemini AI |
| `POST` | `/api/chat/generate` | Generate a knowledge entry with AI |
| `POST` | `/api/chat/summarize` | Summarize an entry with AI |
| `GET` | `/api/status` | Server health check |

## 🤖 Gemini Tools Used

- **`gemini-2.0-flash`** — Fast, capable model for chat and generation
- **Google Search Grounding** — Real-time web search in AI responses
- **Function Calling** — Structured JSON generation for entry creation
- **Multi-turn Chat** — Persistent conversation history with knowledge base context

## 📸 Screenshots

The app features a sleek dark interface with:
- **Dashboard** — Stats cards, recent entries, AI quick-ask panel
- **Knowledge Base** — Grid/list view with search, filter, and inline actions
- **AI Chat** — Full chat interface with typing indicators and source citations
- **Add/Edit** — Markdown editor with live preview and AI generation

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **AI:** Google Gemini API (`@google/generative-ai`)
- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework, zero build step)
- **Storage:** JSON file-based persistence
- **Fonts:** Inter + Space Grotesk

## 📄 License

MIT © Infinity AI
