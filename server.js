require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

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

// ── Gemini AI setup ───────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

function buildSystemPrompt(entries) {
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

// ── AI Chat API ───────────────────────────────────────────────────────────────

// POST /api/chat — send a message to Gemini AI
app.post('/api/chat', aiLimiter, async (req, res) => {
  const { message, history = [], useGrounding = false } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  if (!genAI) {
    return res.status(503).json({
      success: false,
      error: 'Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.',
      demo: true,
    });
  }

  try {
    const data = readData();
    const entries = data.entries || [];
    const systemInstruction = buildSystemPrompt(entries);

    // Configure model — optionally enable Google Search grounding
    const modelConfig = {
      model: 'gemini-2.0-flash',
      systemInstruction,
      safetySettings: SAFETY_SETTINGS,
    };

    if (useGrounding) {
      modelConfig.tools = [{ googleSearch: {} }];
    }

    const model = genAI.getGenerativeModel(modelConfig);

    // Map prior history into Gemini format
    const geminiHistory = (history || []).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(message.trim());
    const response = result.response;
    const text = response.text();

    // Extract grounding metadata if available
    let groundingChunks = [];
    try {
      const meta = response.candidates?.[0]?.groundingMetadata;
      if (meta?.groundingChunks) {
        groundingChunks = meta.groundingChunks
          .filter(c => c.web)
          .map(c => ({ title: c.web.title, uri: c.web.uri }));
      }
    } catch (_) {
      // grounding metadata not available
    }

    res.json({
      success: true,
      response: text,
      groundingChunks,
      model: 'gemini-2.0-flash',
    });
  } catch (err) {
    console.error('Gemini API error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to get AI response',
    });
  }
});

// POST /api/chat/generate — generate a knowledge entry using AI
app.post('/api/chat/generate', aiLimiter, async (req, res) => {
  const { topic } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ success: false, error: 'Topic is required' });
  }

  if (!genAI) {
    return res.status(503).json({
      success: false,
      error: 'Gemini API key not configured.',
      demo: true,
    });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      safetySettings: SAFETY_SETTINGS,
    });

    const prompt = `Generate a comprehensive knowledge base entry about: "${topic.trim()}"

Return a JSON object with exactly these fields:
{
  "title": "A clear, concise title for the topic",
  "category": "One of: Technology, Science, Business, Health, Education, Arts, General",
  "tags": ["tag1", "tag2", "tag3"],
  "content": "A comprehensive, well-structured explanation with multiple paragraphs, covering key concepts, examples, and practical applications. Use markdown formatting."
}

Important: Return ONLY the JSON object, no markdown code blocks or extra text.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON — strip markdown fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const entry = JSON.parse(cleaned);

    res.json({ success: true, entry });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate entry',
    });
  }
});

// POST /api/chat/summarize — summarize a knowledge entry
app.post('/api/chat/summarize', aiLimiter, async (req, res) => {
  const { entryId } = req.body;

  if (!genAI) {
    return res.status(503).json({ success: false, error: 'Gemini API key not configured.', demo: true });
  }

  const data = readData();
  const entry = data.entries.find(e => e.id === entryId);
  if (!entry) return res.status(404).json({ success: false, error: 'Entry not found' });

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      safetySettings: SAFETY_SETTINGS,
    });

    const prompt = `Summarize the following knowledge base entry in 2-3 concise sentences that capture the key points:

Title: ${entry.title}
Content: ${entry.content}

Provide only the summary, no extra text.`;

    const result = await model.generateContent(prompt);
    res.json({ success: true, summary: result.response.text().trim() });
  } catch (err) {
    console.error('Summarize error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to summarize' });
  }
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
