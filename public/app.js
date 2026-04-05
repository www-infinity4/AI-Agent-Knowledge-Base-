/* ── Infinity Knowledge Base — App ───────────────────────────────────────── */

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  entries: [],
  chatHistory: [],
  currentPage: 'dashboard',
  kbViewMode: 'grid',
  chatCount: 0,
  editingId: null,
  stats: null,
};

// ── API helpers ───────────────────────────────────────────────────────────────
const api = {
  async get(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  },
  async put(path, body) {
    const res = await fetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  },
  async delete(path) {
    const res = await fetch(path, { method: 'DELETE' });
    return res.json();
  },
};

// ── Toast notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>',
  };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Navigation ────────────────────────────────────────────────────────────────
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  state.currentPage = page;

  // Refresh data when switching pages
  if (page === 'dashboard') loadDashboard();
  if (page === 'knowledge') loadKnowledgeBase();
  if (page === 'chat') updateChatEntryCount();
  if (page === 'add' && !state.editingId) resetForm();

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [statsRes, entriesRes] = await Promise.all([
      api.get('/api/knowledge/stats'),
      api.get('/api/knowledge'),
    ]);

    state.stats = statsRes;
    state.entries = entriesRes.entries || [];

    // Update stat cards
    document.getElementById('totalEntries').textContent = statsRes.total || 0;
    document.getElementById('totalCategories').textContent = Object.keys(statsRes.categories || {}).length;
    document.getElementById('totalTags').textContent = (statsRes.topTags || []).length;
    document.getElementById('totalChats').textContent = state.chatCount;

    // Recent entries
    renderRecentEntries(statsRes.recentEntries || []);

    // Categories
    renderCategoriesWidget(statsRes.categories || {}, statsRes.total || 0);

    // Top tags
    renderTopTags(statsRes.topTags || []);

  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function renderRecentEntries(entries) {
  const container = document.getElementById('recentEntriesList');
  if (!entries.length) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
      <p>No knowledge entries yet</p>
      <button class="btn btn-sm btn-primary" onclick="navigateTo('add')">Add First Entry</button>
    </div>`;
    return;
  }

  container.innerHTML = entries.map(e => `
    <div class="recent-entry" onclick="openEntryModal('${e.id}')">
      <div class="recent-entry-icon">${(e.category || 'G').substring(0, 2)}</div>
      <div class="recent-entry-info">
        <div class="recent-entry-title">${escapeHtml(e.title)}</div>
        <div class="recent-entry-meta">${e.category || 'General'} · ${formatDate(e.createdAt)}</div>
      </div>
    </div>
  `).join('');
}

function renderCategoriesWidget(categories, total) {
  const container = document.getElementById('categoriesList');
  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      <p>No categories yet</p>
    </div>`;
    return;
  }

  container.innerHTML = `<div class="category-bar-row">${entries.map(([cat, count]) => `
    <div class="category-bar-item">
      <div class="category-bar-header">
        <span class="category-bar-label">${escapeHtml(cat)}</span>
        <span class="category-bar-count">${count} entries</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${total ? (count / total * 100).toFixed(1) : 0}%"></div>
      </div>
    </div>
  `).join('')}</div>`;
}

function renderTopTags(tags) {
  const container = document.getElementById('topTagsList');
  if (!tags.length) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      <p>No tags yet</p>
    </div>`;
    return;
  }

  container.innerHTML = `<div class="tags-cloud">${tags.map(({ tag, count }) => `
    <span class="tag-item" onclick="filterByTag('${escapeHtml(tag)}')">
      #${escapeHtml(tag)} <span class="tag-count">${count}</span>
    </span>
  `).join('')}</div>`;
}

// ── Knowledge Base ────────────────────────────────────────────────────────────
function sortEntries(entries, sort) {
  const arr = [...entries];
  switch (sort) {
    case 'oldest': return arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case 'az':     return arr.sort((a, b) => a.title.localeCompare(b.title));
    case 'za':     return arr.sort((a, b) => b.title.localeCompare(a.title));
    case 'views':  return arr.sort((a, b) => (b.views || 0) - (a.views || 0));
    default:       return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest
  }
}

function highlightText(text, term) {
  if (!term) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${escapedTerm})`, 'gi'), '<mark class="search-highlight">$1</mark>');
}

async function loadKnowledgeBase(search = '', category = 'All') {
  const container = document.getElementById('kbEntries');
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div>';

  // Show/hide clear button
  const clearBtn = document.getElementById('kbSearchClear');
  if (clearBtn) clearBtn.style.display = search ? 'flex' : 'none';

  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category && category !== 'All') params.set('category', category);
    const res = await api.get(`/api/knowledge?${params}`);
    state.entries = res.entries || [];

    // Sort according to the current sort control value
    const sortVal = document.getElementById('kbSort')?.value || 'newest';
    const sorted = sortEntries(state.entries, sortVal);

    renderKnowledgeBase(sorted, search);
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Failed to load knowledge base</p></div>';
  }
}

function renderKnowledgeBase(entries, search = '') {
  const container = document.getElementById('kbEntries');
  const resultCountEl = document.getElementById('kbResultCount');

  // Show result count when filtering
  if (resultCountEl) {
    if (search || document.getElementById('kbCategory')?.value !== 'All') {
      resultCountEl.textContent = `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} found`;
      resultCountEl.style.display = 'block';
    } else {
      resultCountEl.style.display = 'none';
    }
  }

  if (state.kbViewMode === 'list') {
    container.classList.add('list-view');
  } else {
    container.classList.remove('list-view');
  }

  if (!entries.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
      <p>No entries found</p>
      <button class="btn btn-sm btn-primary" onclick="navigateTo('add')">Add Knowledge Entry</button>
    </div>`;
    return;
  }

  const excerpt = (content) => {
    const plain = content.substring(0, 200);
    return search ? highlightText(plain, search) : escapeHtml(plain);
  };

  container.innerHTML = entries.map(e => `
    <div class="entry-card" onclick="openEntryModal('${e.id}')">
      <div class="entry-card-header">
        <div class="entry-card-title">${highlightText(e.title, search)}</div>
        <span class="entry-card-category">${escapeHtml(e.category || 'General')}</span>
      </div>
      <div class="entry-card-excerpt">${excerpt(e.content)}</div>
      ${e.tags && e.tags.length ? `<div class="entry-card-tags">${e.tags.slice(0, 4).map(t => `<span class="entry-tag">#${highlightText(t, search)}</span>`).join('')}</div>` : ''}
      <div class="entry-card-footer">
        <span>${formatDate(e.createdAt)}</span>
        <div class="entry-card-actions" onclick="event.stopPropagation()">
          <button class="edit-btn" onclick="editEntry('${e.id}')" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="delete-btn" onclick="deleteEntry('${e.id}', event)" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Entry Modal ───────────────────────────────────────────────────────────────
async function openEntryModal(id) {
  const entry = state.entries.find(e => e.id === id);
  if (!entry) return;

  // Increment view count (fire and forget)
  api.post(`/api/knowledge/${id}/view`, {}).catch(() => {});

  document.getElementById('modalCategory').textContent = entry.category || 'General';
  document.getElementById('modalTitle').textContent = entry.title;
  document.getElementById('modalContent').innerHTML = markdownToHtml(entry.content);
  document.getElementById('modalDate').textContent = `Created ${formatDate(entry.createdAt)}`;
  document.getElementById('modalViews').textContent = `${(entry.views || 0) + 1} views`;

  const tagsEl = document.getElementById('modalTags');
  tagsEl.innerHTML = (entry.tags || []).map(t => `<span class="entry-tag">#${escapeHtml(t)}</span>`).join(' ');

  // Reset summary
  const summaryEl = document.getElementById('modalSummary');
  summaryEl.style.display = 'none';
  document.getElementById('modalSummaryText').textContent = '';

  // Wire up buttons
  document.getElementById('modalEditBtn').onclick = () => { closeModal(); editEntry(id); };
  document.getElementById('modalDeleteBtn').onclick = () => { closeModal(); deleteEntry(id); };
  document.getElementById('modalChatBtn').onclick = () => {
    closeModal();
    navigateTo('chat');
    setTimeout(() => sendChat(`Tell me more about "${entry.title}" from my knowledge base`), 100);
  };

  document.getElementById('modalSummarizeBtn').onclick = async () => {
    const btn = document.getElementById('modalSummarizeBtn');
    btn.disabled = true;
    btn.textContent = 'Summarizing...';
    try {
      const res = await api.post('/api/chat/summarize', { entryId: id });
      if (res.success) {
        document.getElementById('modalSummaryText').textContent = res.summary;
        summaryEl.style.display = 'block';
      } else {
        showToast(res.error || 'Could not summarize', 'error');
      }
    } catch {
      showToast('Failed to summarize', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z"/></svg> Summarize with AI`;
    }
  };

  document.getElementById('entryModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('entryModal').style.display = 'none';
  document.body.style.overflow = '';
}

// ── Edit / Delete ─────────────────────────────────────────────────────────────
function editEntry(id) {
  const entry = state.entries.find(e => e.id === id);
  if (!entry) return;

  state.editingId = id;
  document.getElementById('editEntryId').value = id;
  document.getElementById('entryTitle').value = entry.title;
  document.getElementById('entryCategory').value = entry.category || 'General';
  document.getElementById('entryTags').value = (entry.tags || []).join(', ');
  document.getElementById('entryContent').value = entry.content;
  document.getElementById('addPageTitle').textContent = 'Edit Knowledge Entry';
  document.getElementById('saveEntryBtn').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
    Update Entry`;

  updatePreview();
  navigateTo('add');
}

async function deleteEntry(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('Delete this knowledge entry? This cannot be undone.')) return;

  try {
    const res = await api.delete(`/api/knowledge/${id}`);
    if (res.success) {
      showToast('Entry deleted', 'success');
      state.entries = state.entries.filter(e => e.id !== id);
      if (state.currentPage === 'knowledge') renderKnowledgeBase(state.entries);
      if (state.currentPage === 'dashboard') loadDashboard();
    } else {
      showToast(res.error || 'Failed to delete', 'error');
    }
  } catch {
    showToast('Failed to delete entry', 'error');
  }
}

// ── Add/Edit Form ─────────────────────────────────────────────────────────────
function resetForm() {
  state.editingId = null;
  document.getElementById('editEntryId').value = '';
  document.getElementById('entryTitle').value = '';
  document.getElementById('entryCategory').value = 'General';
  document.getElementById('entryTags').value = '';
  document.getElementById('entryContent').value = '';
  document.getElementById('addPageTitle').textContent = 'Add Knowledge Entry';
  document.getElementById('saveEntryBtn').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
    Save Entry`;
  document.getElementById('entryPreview').innerHTML = `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    <p>Preview will appear as you type</p>
  </div>`;
  document.getElementById('previewBadge').textContent = 'Draft';
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('entryTitle').value.trim();
  const content = document.getElementById('entryContent').value.trim();
  const category = document.getElementById('entryCategory').value;
  const tags = document.getElementById('entryTags').value;
  const id = document.getElementById('editEntryId').value;

  if (!title || !content) {
    showToast('Title and content are required', 'error');
    return;
  }

  const btn = document.getElementById('saveEntryBtn');
  btn.disabled = true;
  btn.textContent = id ? 'Updating...' : 'Saving...';

  try {
    let res;
    if (id) {
      res = await api.put(`/api/knowledge/${id}`, { title, content, category, tags });
    } else {
      res = await api.post('/api/knowledge', { title, content, category, tags });
    }

    if (res.success) {
      showToast(id ? 'Entry updated!' : 'Entry saved!', 'success');
      resetForm();
      navigateTo('knowledge');
    } else {
      showToast(res.error || 'Failed to save', 'error');
    }
  } catch {
    showToast('Failed to save entry', 'error');
  } finally {
    btn.disabled = false;
  }
}

function updatePreview() {
  const title = document.getElementById('entryTitle').value;
  const content = document.getElementById('entryContent').value;
  const category = document.getElementById('entryCategory').value;
  const previewEl = document.getElementById('entryPreview');
  const badgeEl = document.getElementById('previewBadge');

  badgeEl.textContent = category || 'Draft';

  if (!title && !content) {
    previewEl.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      <p>Preview will appear as you type</p>
    </div>`;
    return;
  }

  previewEl.innerHTML = `
    ${title ? `<h2 style="margin-bottom:12px;font-family:'Space Grotesk',sans-serif;font-size:1.1rem">${escapeHtml(title)}</h2>` : ''}
    <div class="markdown-content">${markdownToHtml(content)}</div>
  `;
}

// ── AI Generate ───────────────────────────────────────────────────────────────
async function generateWithAI() {
  const topic = document.getElementById('generateTopic').value.trim();
  if (!topic) {
    showToast('Enter a topic to generate', 'error');
    return;
  }

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;margin:0 auto"></div> Generating...';

  try {
    const res = await api.post('/api/chat/generate', { topic });
    if (res.success && res.entry) {
      document.getElementById('entryTitle').value = res.entry.title || '';
      document.getElementById('entryCategory').value = res.entry.category || 'General';
      document.getElementById('entryTags').value = (res.entry.tags || []).join(', ');
      document.getElementById('entryContent').value = res.entry.content || '';
      updatePreview();
      showToast('AI generated entry! Review and save.', 'success');
    } else if (res.demo) {
      showToast('Configure GEMINI_API_KEY to use AI generation', 'info');
    } else {
      showToast(res.error || 'Generation failed', 'error');
    }
  } catch {
    showToast('Failed to generate entry', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z"/></svg> Generate with AI`;
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function updateChatEntryCount() {
  api.get('/api/knowledge/stats').then(s => {
    document.getElementById('entryCountHint').textContent = s.total || 0;
  }).catch(() => {});
}

async function sendChat(message) {
  message = message || document.getElementById('chatInput').value.trim();
  if (!message) return;

  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const messagesEl = document.getElementById('chatMessages');
  const typingEl = document.getElementById('chatTypingIndicator');
  const useGrounding = document.getElementById('groundingToggle').checked;

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;

  // Remove welcome screen if present
  const welcome = messagesEl.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  // Add user message
  appendMessage('user', message);

  // Show typing indicator
  typingEl.style.display = 'flex';
  messagesEl.scrollTop = messagesEl.scrollHeight;

  state.chatHistory.push({ role: 'user', content: message });

  try {
    const res = await api.post('/api/chat', {
      message,
      history: state.chatHistory.slice(-20),
      useGrounding,
    });

    typingEl.style.display = 'none';

    if (res.success) {
      const responseText = res.response;
      state.chatHistory.push({ role: 'assistant', content: responseText });
      state.chatCount++;
      document.getElementById('totalChats').textContent = state.chatCount;
      appendMessage('assistant', responseText, res.groundingChunks || []);
    } else if (res.demo) {
      appendMessage('assistant', `⚠️ **Gemini API not configured**\n\nTo use the AI chat, please:\n1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)\n2. Create a \`.env\` file with: \`GEMINI_API_KEY=your_key_here\`\n3. Restart the server\n\nThe knowledge base features work without an API key!`);
    } else {
      appendMessage('assistant', `❌ Error: ${res.error}`);
    }
  } catch {
    typingEl.style.display = 'none';
    appendMessage('assistant', '❌ Failed to connect to AI. Please check if the server is running.');
  } finally {
    sendBtn.disabled = false;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function appendMessage(role, content, groundingChunks = []) {
  const messagesEl = document.getElementById('chatMessages');
  const avatarText = role === 'user' ? 'You' : '∞';
  const msg = document.createElement('div');
  msg.className = `chat-message ${role}`;

  const sourcesHtml = groundingChunks.length ? `
    <div class="chat-sources">
      <div class="chat-sources-title">🔍 Web Sources:</div>
      ${groundingChunks.map(c => `<a href="${c.uri}" target="_blank" rel="noopener" class="chat-source-link">${escapeHtml(c.title || c.uri)}</a>`).join('')}
    </div>
  ` : '';

  msg.innerHTML = `
    <div class="chat-avatar">${avatarText}</div>
    <div class="chat-bubble">
      <div class="markdown-content">${markdownToHtml(content)}</div>
      ${sourcesHtml}
    </div>
  `;

  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearChat() {
  state.chatHistory = [];
  const messagesEl = document.getElementById('chatMessages');
  messagesEl.innerHTML = `<div class="chat-welcome">
    <div class="welcome-icon">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="20" fill="url(#wgrad2)"/>
        <path d="M20 10l-2 6H12l5 4-2 6 5-4 5 4-2-6 5-4h-6l-2-6z" fill="white"/>
        <defs>
          <linearGradient id="wgrad2" x1="0" y1="0" x2="40" y2="40">
            <stop offset="0%" stop-color="#6366f1"/>
            <stop offset="100%" stop-color="#8b5cf6"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <h2>Infinity AI Agent</h2>
    <p>I'm your personal AI assistant with access to your entire knowledge base. Ask me anything!</p>
    <div class="welcome-chips">
      <button class="chip" onclick="sendChat('What do you know about my knowledge base?')">What's in my knowledge base?</button>
      <button class="chip" onclick="sendChat('Give me a summary of all topics')">Summarize all topics</button>
      <button class="chip" onclick="sendChat('What are the key concepts I should remember?')">Key concepts to remember</button>
    </div>
  </div>`;
}

// ── Quick Ask (Dashboard) ─────────────────────────────────────────────────────
async function quickAsk(message) {
  message = message || document.getElementById('quickChatInput').value.trim();
  if (!message) return;

  const btn = document.getElementById('quickChatBtn');
  const responseEl = document.getElementById('quickChatResponse');
  btn.disabled = true;
  btn.textContent = 'Thinking...';
  responseEl.style.display = 'none';

  try {
    const res = await api.post('/api/chat', { message, history: [] });
    if (res.success) {
      responseEl.style.display = 'block';
      responseEl.innerHTML = `<div class="markdown-content">${markdownToHtml(res.response)}</div>`;
    } else if (res.demo) {
      responseEl.style.display = 'block';
      responseEl.innerHTML = '<p>⚠️ Configure GEMINI_API_KEY to use AI features</p>';
    } else {
      showToast(res.error || 'AI error', 'error');
    }
  } catch {
    showToast('Failed to reach AI', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ask AI';
  }
}

function filterByTag(tag) {
  navigateTo('knowledge');
  setTimeout(() => {
    const searchEl = document.getElementById('kbSearch');
    searchEl.value = tag;
    const clearBtn = document.getElementById('kbSearchClear');
    if (clearBtn) clearBtn.style.display = 'flex';
    loadKnowledgeBase(tag);
  }, 100);
}

// ── Markdown renderer (lightweight) ──────────────────────────────────────────
function markdownToHtml(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Code blocks (must come before inline code)
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');

  // Unordered lists — mark items with a sentinel, group below
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li data-ul>$1</li>');

  // Ordered lists
  html = html.replace(/^\s*\d+\. (.+)$/gm, '<li data-ol>$1</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Paragraphs (double newlines → paragraph break)
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Group consecutive <li data-ul> items into <ul> blocks
  html = html.replace(/((?:<li data-ul>[^]*?<\/li>(?:<br>)?)+)/g, (match) =>
    `<ul>${match.replace(/ data-ul/g, '')}</ul>`
  );

  // Group consecutive <li data-ol> items into <ol> blocks
  html = html.replace(/((?:<li data-ol>[^]*?<\/li>(?:<br>)?)+)/g, (match) =>
    `<ol>${match.replace(/ data-ol/g, '')}</ol>`
  );

  // Clean up stray <br> tags directly inside list wrappers
  html = html.replace(/<ul><br>/g, '<ul>').replace(/<br><\/ul>/g, '</ul>');
  html = html.replace(/<ol><br>/g, '<ol>').replace(/<br><\/ol>/g, '</ol>');

  // Wrap in paragraph if not already a block element
  if (!html.startsWith('<h') && !html.startsWith('<pre') && !html.startsWith('<ul') && !html.startsWith('<ol')) {
    html = `<p>${html}</p>`;
  }

  return html;
}

// ── Markdown editor helpers ───────────────────────────────────────────────────
function insertMarkdown(before, after) {
  const ta = document.getElementById('entryContent');
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = ta.value.substring(start, end);
  const replacement = before + (selected || 'text') + after;
  ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
  ta.focus();
  ta.setSelectionRange(start + before.length, start + before.length + (selected || 'text').length);
  updatePreview();
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

// ── AI Status check ───────────────────────────────────────────────────────────
async function checkStatus() {
  try {
    const status = await api.get('/api/status');
    const statusEl = document.getElementById('aiStatus');
    if (status.geminiConfigured) {
      statusEl.className = 'ai-status online';
      statusEl.querySelector('span').textContent = 'AI Online';
    } else {
      statusEl.className = 'ai-status unconfigured';
      statusEl.querySelector('span').textContent = 'AI Not Configured';
    }
  } catch {
    const statusEl = document.getElementById('aiStatus');
    statusEl.className = 'ai-status offline';
    statusEl.querySelector('span').textContent = 'Offline';
  }
}

// ── Event Listeners ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Initial load
  loadDashboard();
  checkStatus();

  // Sidebar navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Sidebar toggle (desktop collapse)
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Mobile menu
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });

  // Global search
  let searchTimeout;
  document.getElementById('globalSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (state.currentPage !== 'knowledge') navigateTo('knowledge');
      loadKnowledgeBase(e.target.value);
    }, 400);
  });

  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', () => {
    if (state.currentPage === 'dashboard') loadDashboard();
    if (state.currentPage === 'knowledge') loadKnowledgeBase();
    checkStatus();
    showToast('Refreshed', 'success', 1500);
  });

  // Knowledge base search & filter
  let kbSearchTimeout;
  document.getElementById('kbSearch').addEventListener('input', (e) => {
    clearTimeout(kbSearchTimeout);
    const clearBtn = document.getElementById('kbSearchClear');
    if (clearBtn) clearBtn.style.display = e.target.value ? 'flex' : 'none';
    kbSearchTimeout = setTimeout(() => {
      const cat = document.getElementById('kbCategory').value;
      loadKnowledgeBase(e.target.value, cat);
    }, 350);
  });

  document.getElementById('kbSearchClear').addEventListener('click', () => {
    document.getElementById('kbSearch').value = '';
    document.getElementById('kbSearchClear').style.display = 'none';
    const cat = document.getElementById('kbCategory').value;
    loadKnowledgeBase('', cat);
    document.getElementById('kbSearch').focus();
  });

  document.getElementById('kbCategory').addEventListener('change', (e) => {
    const search = document.getElementById('kbSearch').value;
    loadKnowledgeBase(search, e.target.value);
  });

  document.getElementById('kbSort').addEventListener('change', (e) => {
    const search = document.getElementById('kbSearch').value;
    const sorted = sortEntries(state.entries, e.target.value);
    renderKnowledgeBase(sorted, search);
  });

  // View toggle
  document.getElementById('gridViewBtn').addEventListener('click', () => {
    state.kbViewMode = 'grid';
    document.getElementById('gridViewBtn').classList.add('active');
    document.getElementById('listViewBtn').classList.remove('active');
    const search = document.getElementById('kbSearch').value;
    renderKnowledgeBase(state.entries, search);
  });

  document.getElementById('listViewBtn').addEventListener('click', () => {
    state.kbViewMode = 'list';
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('gridViewBtn').classList.remove('active');
    const search = document.getElementById('kbSearch').value;
    renderKnowledgeBase(state.entries, search);
  });

  // Chat
  document.getElementById('chatSendBtn').addEventListener('click', () => sendChat());
  document.getElementById('clearChatBtn').addEventListener('click', clearChat);

  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  // Auto-resize textarea
  document.getElementById('chatInput').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 140) + 'px';
  });

  // Quick chat on dashboard
  document.getElementById('quickChatBtn').addEventListener('click', () => quickAsk());
  document.getElementById('quickChatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') quickAsk();
  });

  // Add/Edit form
  document.getElementById('entryForm').addEventListener('submit', handleFormSubmit);
  document.getElementById('generateBtn').addEventListener('click', generateWithAI);

  // Live preview
  ['entryTitle', 'entryContent', 'entryCategory'].forEach(id => {
    document.getElementById(id).addEventListener('input', updatePreview);
  });

  // Modal close
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('entryModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('entryModal')) closeModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('globalSearch').focus();
    }
  });
});
