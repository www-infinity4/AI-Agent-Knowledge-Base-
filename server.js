require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limiters ─────────────────────────────────────────────────────────────
// General API: 120 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' },
});

// AI endpoints: 20 requests per minute per IP (more expensive operations)
const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many AI requests. Please slow down.' },
});

// ── Data persistence helpers ──────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const KB_FILE = path.join(DATA_DIR, 'knowledge.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(KB_FILE)) {
    fs.writeFileSync(KB_FILE, JSON.stringify({ entries: [], chatHistory: [] }, null, 2));
  }
}

function readData() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(KB_FILE, 'utf8'));
  } catch {
    return { entries: [], chatHistory: [] };
  }
}

function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(KB_FILE, JSON.stringify(data, null, 2));
}

// ── Local knowledge synthesis — no external AI service ─────────────────────────\n\nfunction buildSystemPrompt(entries) {
  const kbContext = entries.length > 0
    ? entries.map((e, i) =>
        `[${i + 1}] Title: ${e.title}\nCategory: ${e.category || 'General'}\nTags: ${(e.tags || []).join(', ') || 'none'}\nContent:\n${e.content}`
      ).join('\n\n---\n\n')
    : 'The knowledge base is currently empty.';

  return `You are the Infinity Knowledge Base AI Agent — a highly intelligent, helpful assistant with access to a curated knowledge base.

Your role is to:
1. Answer questions accurately using the knowledge base entries provided below
2. Synthesize information across multiple entries when relevant
3. Clearly cite which knowledge base entry (by title) you're drawing from
4. If a question isn't covered by the knowledge base, say so honestly and provide your best general answer
5. Suggest relevant knowledge base entries the user might want to explore
6. Help users understand and apply the knowledge in practical ways

KNOWLEDGE BASE CONTENTS:
========================
${kbContext}
========================

Always be helpful, precise, and proactive. Format responses with markdown for clarity.`;
}

// ── Knowledge Base API ────────────────────────────────────────────────────────

// GET /api/knowledge — list all entries
app.get('/api/knowledge', apiLimiter, (req, res) => {
  const data = readData();
  const { search, category, tag } = req.query;
  let entries = data.entries || [];

  if (search) {
    const q = search.toLowerCase();
    entries = entries.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q) ||
      (e.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  if (category && category !== 'All') {
    entries = entries.filter(e => (e.category || 'General') === category);
  }
  if (tag) {
    entries = entries.filter(e => (e.tags || []).includes(tag));
  }

  res.json({ success: true, entries, total: entries.length });
});

// GET /api/knowledge/stats — stats for dashboard
app.get('/api/knowledge/stats', apiLimiter, (req, res) => {
  const data = readData();
  const entries = data.entries || [];
  const categories = {};
  const allTags = {};

  entries.forEach(e => {
    const cat = e.category || 'General';
    categories[cat] = (categories[cat] || 0) + 1;
    (e.tags || []).forEach(t => { allTags[t] = (allTags[t] || 0) + 1; });
  });

  res.json({
    success: true,
    total: entries.length,
    categories,
    topTags: Object.entries(allTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count })),
    recentEntries: [...entries]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5),
  });
});

// POST /api/knowledge — create an entry
app.post('/api/knowledge', apiLimiter, (req, res) => {
  const { title, content, category, tags } = req.body;
  if (!title || !content) {
    return res.status(400).json({ success: false, error: 'Title and content are required' });
  }

  const data = readData();
  const entry = {
    id: uuidv4(),
    title: title.trim(),
    content: content.trim(),
    category: (category || 'General').trim(),
    tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) :
          typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    views: 0,
  };

  data.entries.push(entry);
  writeData(data);
  res.status(201).json({ success: true, entry });
});

// PUT /api/knowledge/:id — update an entry
app.put('/api/knowledge/:id', apiLimiter, (req, res) => {
  const data = readData();
  const idx = data.entries.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Entry not found' });

  const { title, content, category, tags } = req.body;
  data.entries[idx] = {
    ...data.entries[idx],
    title: (title || data.entries[idx].title).trim(),
    content: (content || data.entries[idx].content).trim(),
    category: (category || data.entries[idx].category || 'General').trim(),
    tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) :
          typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) :
          data.entries[idx].tags,
    updatedAt: new Date().toISOString(),
  };

  writeData(data);
  res.json({ success: true, entry: data.entries[idx] });
});

// DELETE /api/knowledge/:id — delete an entry
app.delete('/api/knowledge/:id', apiLimiter, (req, res) => {
  const data = readData();
  const idx = data.entries.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Entry not found' });

  const [removed] = data.entries.splice(idx, 1);
  writeData(data);
  res.json({ success: true, entry: removed });
});

// POST /api/knowledge/:id/view — increment view counter
app.post('/api/knowledge/:id/view', apiLimiter, (req, res) => {
  const data = readData();
  const entry = data.entries.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ success: false, error: 'Entry not found' });
  entry.views = (entry.views || 0) + 1;
  writeData(data);
  res.json({ success: true, views: entry.views });
});

// ── Local knowledge synthesis API ─────────────────────────────────────────────
const words = value => String(value || '').toLowerCase().match(/[a-z0-9]+/g) || [];
const STOP = new Set('the a an and or but to of in on for with from by is are was were be been being this that these those it its as at about into your my our can could should would'.split(' '));
function relevantEntries(entries, message, limit = 4) {
  const q = new Set(words(message).filter(w => w.length > 2 && !STOP.has(w)));
  return (entries || []).map(entry => {
    const hay = words([entry.title, entry.category, ...(entry.tags || []), entry.content].join(' '));
    const score = hay.reduce((n, word) => n + (q.has(word) ? 1 : 0), 0);
    return { entry, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, limit).map(x => x.entry);
}
function localAnswer(entries, message) {
  const matches = relevantEntries(entries, message);
  if (!matches.length) return {
    response: 'I could not find that topic in the current knowledge base. Add a relevant entry or search the existing collection with different terms.',
    groundingChunks: []
  };
  const sections = matches.map(entry => {
    const body = String(entry.content || '').replace(/\s+/g, ' ').trim();
    return '**' + entry.title + '**\n' + body.slice(0, 900) + (body.length > 900 ? '…' : '');
  });
  return {
    response: sections.join('\n\n') + '\n\nThese results were assembled locally from the saved knowledge base.',
    groundingChunks: matches.map(entry => ({ title: entry.title, uri: 'local-kb:' + entry.id }))
  };
}
function localEntry(topic) {
  const clean = String(topic || '').trim();
  return {
    title: clean,
    category: 'General',
    tags: words(clean).filter(w => w.length > 3).slice(0, 5),
    content: clean + ' is ready for local knowledge-base development. Add verified notes, examples, sources, and practical details here; the local assistant will use those saved entries without requiring a paid model or API key.'
  };
}
function localSummary(content) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, 3).join(' ').trim().slice(0, 900);
}

app.post('/api/chat', aiLimiter, (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ success:false, error:'Message is required' });
  const data = readData();
  res.json({ success:true, ...localAnswer(data.entries || [], message), model:'local-knowledge-synthesis' });
});

app.post('/api/chat/generate', aiLimiter, (req, res) => {
  const { topic } = req.body;
  if (!topic || !topic.trim()) return res.status(400).json({ success:false, error:'Topic is required' });
  res.json({ success:true, entry:localEntry(topic) });
});

app.post('/api/chat/summarize', aiLimiter, (req, res) => {
  const data = readData();
  const entry = data.entries.find(e => e.id === req.body.entryId);
  if (!entry) return res.status(404).json({ success:false, error:'Entry not found' });
  res.json({ success:true, summary:localSummary(entry.content) });
});

// GET /api/status — health check
app.get('/api/status', apiLimiter, (req, res) => {
  const data = readData();
  res.json({
    success: true,
    status: 'online',
    geminiConfigured: !!(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here'),
    knowledgeBaseEntries: (data.entries || []).length,
    version: '1.0.0',
  });
});

// ── Serve SPA ─────────────────────────────────────────────────────────────────
app.get('/', apiLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', apiLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Infinity Knowledge Base running at http://localhost:${PORT}`);
  console.log(`   Gemini AI: ${genAI ? '✅ Connected' : '⚠️  Not configured (set GEMINI_API_KEY in .env)'}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
