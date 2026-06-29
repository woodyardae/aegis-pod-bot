// Aegis Web Dashboard Client Logic

const THEME_PREVIEW_COLORS = {
  'aegis': { name: 'Aegis Classic (Default)', border: '#00D4AA', amount: '1,250' },
  'apple-classic-light': { name: 'Apple Classic Light', border: '#007AFF', amount: '1,250' },
  'apple-rose-light': { name: 'Apple Rose Light', border: '#FF2D55', amount: '1,250' },
  'apple-mint-light': { name: 'Apple Mint Light', border: '#5856D6', amount: '1,250' },
  'apple-sand-light': { name: 'Apple Sand Light', border: '#A2845E', amount: '1,250' },
  'apple-mono-light': { name: 'Apple Mono Light', border: '#8E8E93', amount: '1,250' },
  'apple-classic-dark': { name: 'Apple Classic Dark', border: '#0A84FF', amount: '1,250' },
  'apple-rose-dark': { name: 'Apple Rose Dark', border: '#FF375F', amount: '1,250' },
  'apple-mint-dark': { name: 'Apple Mint Dark', border: '#5E5CE6', amount: '1,250' },
  'apple-sand-dark': { name: 'Apple Sand Dark', border: '#C2A478', amount: '1,250' },
  'apple-mono-dark': { name: 'Apple Mono Dark', border: '#3A3A3C', amount: '1,250' },
  'vs-light': { name: 'VS Light', border: '#007ACC', amount: '1,250' },
  'github-light': { name: 'GitHub Light', border: '#0969DA', amount: '1,250' },
  'xcode-light': { name: 'Xcode Light', border: '#294C7A', amount: '1,250' },
  'intellij-light': { name: 'IntelliJ Light', border: '#000080', amount: '1,250' },
  'solarized-light': { name: 'Solarized Light', border: '#268BD2', amount: '1,250' },
  'vscode-dark': { name: 'VS Code Dark', border: '#007ACC', amount: '1,250' },
  'github-dark': { name: 'GitHub Dark', border: '#58A6FF', amount: '1,250' },
  'one-dark': { name: 'One Dark', border: '#61AFEF', amount: '1,250' },
  'solarized-dark': { name: 'Solarized Dark', border: '#268BD2', amount: '1,250' },
  'monokai': { name: 'Monokai', border: '#66D9EF', amount: '1,250' }
};

let currentGuildId = null;
let currentAlertType = 'NEW_EPISODE'; // 'NEW_EPISODE' or 'BOOSTAGRAM'
let channelsMap = [];
let activeSubscriptions = [];
let currentSelectedEpisode = null;
let currentFeedUrl = null;

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const avatarImg = document.getElementById('avatar-img');
const usernameLbl = document.getElementById('username-lbl');
const serversContainer = document.getElementById('servers-container');

// Views
const welcomeView = document.getElementById('welcome-view');
const inviteView = document.getElementById('invite-view');
const guildView = document.getElementById('guild-view');

// Active Guild Labels
const guildIconLbl = document.getElementById('guild-icon-lbl');
const guildNameLbl = document.getElementById('guild-name-lbl');
const subsContainer = document.getElementById('subs-container');

// Form elements
const subForm = document.getElementById('sub-form');
const formTitle = document.getElementById('form-title');
const formSubId = document.getElementById('form-sub-id');
const btnModeEpisode = document.getElementById('btn-mode-episode');
const btnModeBoost = document.getElementById('btn-mode-boost');
const feedUrlInput = document.getElementById('feed-url');
const channelSelect = document.getElementById('channel-select');
const showAliasInput = document.getElementById('show-alias');
const minBoostInput = document.getElementById('min-boost');
const themeSelect = document.getElementById('theme-select');
const boostRulesContainer = document.getElementById('boost-rules-container');
const btnCancel = document.getElementById('btn-cancel');
const btnSubmit = document.getElementById('btn-submit');
const btnInviteBot = document.getElementById('btn-invite-bot');

// Dynamic Preview Elements
const previewEmbed = document.getElementById('preview-embed');
const previewAmount = document.getElementById('preview-amount');

// New Tab & Feedback DOM Elements
const guildTabMenu = document.getElementById('guild-tab-menu');
const tabAlertsBtn = document.getElementById('tab-alerts-btn');
const tabEpisodesBtn = document.getElementById('tab-episodes-btn');
const tabAgoraBtn = document.getElementById('tab-agora-btn');
const alertsConfigView = document.getElementById('alerts-config-view');
const episodesFeedbackView = document.getElementById('episodes-feedback-view');
const agoraRoomView = document.getElementById('agora-room-view');

const agoraTrackTitle = document.getElementById('agora-track-title');
const agoraTrackFeed = document.getElementById('agora-track-feed');
const agoraCurrentTime = document.getElementById('agora-current-time');
const agoraProgressBar = document.getElementById('agora-progress-bar');
const agoraStatusBadge = document.getElementById('agora-status-badge');
const agoraUpcomingList = document.getElementById('agora-upcoming-list');
const agoraHostName = document.getElementById('agora-host-name');
const agoraListenersList = document.getElementById('agora-listeners-list');

const episodesFeedSelect = document.getElementById('episodes-feed-select');
const episodesListContainer = document.getElementById('episodes-list-container');
const selectedEpisodeHeaderCard = document.getElementById('selected-episode-header-card');
const selectedEpisodeImg = document.getElementById('selected-episode-img');
const selectedEpisodeTitle = document.getElementById('selected-episode-title');
const selectedEpisodeDate = document.getElementById('selected-episode-date');

const chaptersCard = document.getElementById('chapters-card');
const chaptersTimelineContainer = document.getElementById('chapters-timeline-container');
const commentsCard = document.getElementById('comments-card');
const commentsListContainer = document.getElementById('comments-list-container');

// Modal Elements
const chapterModal = document.getElementById('chapter-modal');
const modalChapterInfo = document.getElementById('modal-chapter-info');
const chapterMetadataForm = document.getElementById('chapter-metadata-form');
const modalChapterIndex = document.getElementById('modal-chapter-index');
const modalEpisodeGuid = document.getElementById('modal-episode-guid');
const modalFeedUrl = document.getElementById('modal-feed-url');
const modalLinkTitle = document.getElementById('modal-link-title');
const modalLinkUrl = document.getElementById('modal-link-url');
const modalNotes = document.getElementById('modal-notes');
const btnCloseChapterModal = document.getElementById('btn-close-chapter-modal');

// Initialize Theme Dropdown
function initThemeSelect() {
  themeSelect.innerHTML = '';
  Object.keys(THEME_PREVIEW_COLORS).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = THEME_PREVIEW_COLORS[key].name;
    themeSelect.appendChild(opt);
  });
}

// ─── Setup Event Listeners ───────────────────────────────────────────────────

btnModeEpisode.addEventListener('click', () => setAlertMode('NEW_EPISODE'));
btnModeBoost.addEventListener('click', () => setAlertMode('BOOSTAGRAM'));

themeSelect.addEventListener('change', updateVisualPreview);
minBoostInput.addEventListener('input', updateVisualPreview);

btnCancel.addEventListener('click', resetForm);

subForm.addEventListener('submit', handleFormSubmit);

tabAlertsBtn.addEventListener('click', () => switchGuildTab('alerts'));
tabEpisodesBtn.addEventListener('click', () => switchGuildTab('episodes'));
tabAgoraBtn.addEventListener('click', () => switchGuildTab('agora'));
btnCloseChapterModal.addEventListener('click', () => { chapterModal.style.display = 'none'; });
chapterMetadataForm.addEventListener('submit', handleChapterModalSubmit);
episodesFeedSelect.addEventListener('change', (e) => {
  currentFeedUrl = e.target.value;
  loadEpisodesList(currentFeedUrl);
});


// ─── Alert Mode Switcher ─────────────────────────────────────────────────────

function setAlertMode(mode) {
  currentAlertType = mode;
  if (mode === 'NEW_EPISODE') {
    btnModeEpisode.classList.add('active');
    btnModeBoost.classList.remove('active');
    boostRulesContainer.style.display = 'none';
    feedUrlInput.required = true;
  } else {
    btnModeEpisode.classList.remove('active');
    btnModeBoost.classList.add('active');
    boostRulesContainer.style.display = 'flex';
    feedUrlInput.required = true;
    updateVisualPreview();
  }
}

// Update simulated Discord alert color/values
function updateVisualPreview() {
  const selectedTheme = themeSelect.value;
  const themeData = THEME_PREVIEW_COLORS[selectedTheme] || THEME_PREVIEW_COLORS['aegis'];
  
  previewEmbed.style.borderLeftColor = themeData.border;
  
  const minSats = parseInt(minBoostInput.value, 10) || 0;
  let amountStr = '1,250';
  if (minSats > 0) {
    // If there is a minimum sats value set, preview that or a slightly larger value
    amountStr = (minSats + 250).toLocaleString();
  }
  previewAmount.textContent = amountStr;
}

// ─── Auth / Boot check ───────────────────────────────────────────────────────

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/user');
    const data = await res.json();
    
    if (data.loggedIn) {
      usernameLbl.textContent = data.user.username;
      if (data.user.avatarUrl) {
        avatarImg.style.backgroundImage = `url(${data.user.avatarUrl})`;
      } else {
        avatarImg.style.background = '#5865F2';
      }
      
      loginScreen.style.display = 'none';
      dashboardScreen.style.display = 'flex';
      initThemeSelect();
      await fetchGuilds();
    } else {
      loginScreen.style.display = 'flex';
      dashboardScreen.style.display = 'none';
    }
  } catch (err) {
    console.error('Check auth failed:', err);
    loginScreen.style.display = 'flex';
    dashboardScreen.style.display = 'none';
  } finally {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 300);
  }
}

// ─── API Communications ──────────────────────────────────────────────────────

async function fetchGuilds() {
  try {
    const res = await fetch('/api/guilds');
    const guilds = await res.json();
    
    serversContainer.innerHTML = '';
    
    guilds.forEach(g => {
      const el = document.createElement('div');
      el.className = 'server-item';
      if (g.id === currentGuildId) el.className += ' active';
      
      const iconUrl = g.iconUrl;
      const initial = g.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      
      el.innerHTML = `
        <div class="server-icon" style="${iconUrl ? `background-image: url(${iconUrl})` : ''}">
          ${iconUrl ? '' : initial}
        </div>
        <div class="server-info">
          <div class="server-name">${g.name}</div>
          <div class="server-status">${g.botPresent ? 'Connected' : 'Bot Missing'}</div>
        </div>
      `;
      
      el.addEventListener('click', () => selectServer(g));
      serversContainer.appendChild(el);
    });
  } catch (err) {
    console.error('Failed to load servers:', err);
  }
}

function selectServer(guild) {
  // Update sidebar active highlights
  document.querySelectorAll('.server-item').forEach(el => el.classList.remove('active'));
  
  currentGuildId = guild.id;
  resetForm();
  
  // Update title label icon/name
  const initial = guild.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  guildIconLbl.textContent = guild.iconUrl ? '' : initial;
  guildIconLbl.style.backgroundImage = guild.iconUrl ? `url(${guild.iconUrl})` : 'none';
  guildNameLbl.textContent = guild.name;
  
  if (!guild.botPresent) {
    welcomeView.style.display = 'none';
    guildView.style.display = 'none';
    guildTabMenu.style.display = 'none';
    inviteView.style.display = 'flex';
    btnInviteBot.href = guild.inviteUrl;
    
    // Refresh guilds after short period in case user clicks invite
    btnInviteBot.onclick = () => {
      setTimeout(fetchGuilds, 6000);
    };
  } else {
    welcomeView.style.display = 'none';
    inviteView.style.display = 'none';
    guildView.style.display = 'flex';
    guildTabMenu.style.display = 'flex';
    switchGuildTab('alerts');
    
    loadGuildChannels(guild.id);
    loadGuildSubscriptions(guild.id);
  }
  
  // Highlight selection in sidebar list
  fetchGuilds();
}

async function loadGuildChannels(guildId) {
  try {
    const res = await fetch(`/api/guilds/${guildId}/channels`);
    channelsMap = await res.json();
    
    channelSelect.innerHTML = '<option value="" disabled selected>Select channel...</option>';
    channelsMap.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `#${ch.name}`;
      channelSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to fetch channels:', err);
  }
}

async function loadGuildSubscriptions(guildId) {
  try {
    const res = await fetch(`/api/guilds/${guildId}/subscriptions`);
    const subs = await res.json();
    
    subsContainer.innerHTML = '';
    
    if (subs.length === 0) {
      subsContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); padding: 40px 20px;">
          No active podcast alerts configured for this server. Use the form to subscribe to a show.
        </div>
      `;
      return;
    }
    
    subs.forEach(s => {
      const el = document.createElement('div');
      el.className = 'sub-item';
      
      const channel = channelsMap.find(ch => ch.id === s.channel_id);
      const channelName = channel ? `#${channel.name}` : `ID: ${s.channel_id}`;
      
      let detailsMeta = `<span>Alert Type: <strong>${s.alert_type === 'NEW_EPISODE' ? 'Episodes' : 'Boosts'}</strong></span>`;
      if (s.alert_type === 'BOOSTAGRAM') {
        const themeLabel = THEME_PREVIEW_COLORS[s.theme]?.name || s.theme;
        detailsMeta += `
          <span>Threshold: <strong>${s.min_boost_sats.toLocaleString()} sats</strong></span>
          <span>Theme: <strong>${themeLabel}</strong></span>
        `;
      }
      
      el.innerHTML = `
        <div class="sub-header">
          <div class="sub-info">
            <div class="sub-alias">${s.alias || 'Unnamed Podcast'}</div>
            <div class="sub-feed">${s.feed_url}</div>
          </div>
          <span class="sub-channel">${channelName}</span>
        </div>
        <div class="sub-meta">
          ${detailsMeta}
        </div>
        <div class="sub-actions">
          <button class="btn-action btn-edit" data-id="${s.id}">Edit</button>
          <button class="btn-action danger btn-delete" data-id="${s.id}">Delete</button>
        </div>
      `;
      
      // Wire action buttons
      el.querySelector('.btn-edit').addEventListener('click', () => editSubscription(s));
      el.querySelector('.btn-delete').addEventListener('click', () => deleteSubscription(s.id));
      
      subsContainer.appendChild(el);
    });
  } catch (err) {
    console.error('Failed to load subscriptions:', err);
  }
}

// ─── Form Handlers ───────────────────────────────────────────────────────────

function editSubscription(sub) {
  formTitle.textContent = 'Edit Podcast Subscription';
  formSubId.value = sub.id;
  feedUrlInput.value = sub.feed_url;
  feedUrlInput.disabled = true; // Cannot edit the feed URL of an existing watch
  channelSelect.value = sub.channel_id;
  showAliasInput.value = sub.alias || '';
  
  setAlertMode(sub.alert_type);
  
  if (sub.alert_type === 'BOOSTAGRAM') {
    minBoostInput.value = sub.min_boost_sats;
    themeSelect.value = sub.theme;
    updateVisualPreview();
  }
  
  btnCancel.style.display = 'block';
  btnSubmit.textContent = 'Update Watch';
}

function resetForm() {
  formTitle.textContent = 'Add Podcast Subscription';
  formSubId.value = '';
  feedUrlInput.value = '';
  feedUrlInput.disabled = false;
  channelSelect.value = '';
  showAliasInput.value = '';
  minBoostInput.value = '0';
  themeSelect.value = 'aegis';
  
  setAlertMode('NEW_EPISODE');
  
  btnCancel.style.display = 'none';
  btnSubmit.textContent = 'Add Watch';
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  if (!currentGuildId) return;
  
  const subId = formSubId.value;
  const body = {
    feedUrl: feedUrlInput.value,
    channelId: channelSelect.value,
    alertType: currentAlertType,
    alias: showAliasInput.value || null,
    minBoostSats: currentAlertType === 'BOOSTAGRAM' ? parseInt(minBoostInput.value, 10) || 0 : 0,
    theme: currentAlertType === 'BOOSTAGRAM' ? themeSelect.value : 'aegis'
  };
  
  try {
    let res;
    if (subId) {
      // Edit mode (PUT)
      res = await fetch(`/api/guilds/${currentGuildId}/subscriptions/${subId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } else {
      // Add mode (POST)
      res = await fetch(`/api/guilds/${currentGuildId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }
    
    const result = await res.json();
    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      resetForm();
      loadGuildSubscriptions(currentGuildId);
    }
  } catch (err) {
    console.error('Failed to submit subscription form:', err);
    alert('Failed to save subscription.');
  }
}

async function deleteSubscription(subId) {
  if (!confirm('Are you sure you want to stop watching this podcast on this server?')) return;
  
  try {
    const res = await fetch(`/api/guilds/${currentGuildId}/subscriptions/${subId}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    
    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      loadGuildSubscriptions(currentGuildId);
    }
  } catch (err) {
    console.error('Failed to delete subscription:', err);
    alert('Failed to delete subscription.');
  }
}

// ─── Guild Tabs & Feedback Panel Extensions ───────────────────────────────────

function switchGuildTab(tab) {
  if (tab === 'alerts') {
    tabAlertsBtn.classList.add('active');
    tabEpisodesBtn.classList.remove('active');
    tabAgoraBtn.classList.remove('active');
    alertsConfigView.style.display = 'grid';
    episodesFeedbackView.style.display = 'none';
    agoraRoomView.style.display = 'none';
    stopAgoraPolling();
  } else if (tab === 'episodes') {
    tabAlertsBtn.classList.remove('active');
    tabEpisodesBtn.classList.add('active');
    tabAgoraBtn.classList.remove('active');
    alertsConfigView.style.display = 'none';
    episodesFeedbackView.style.display = 'flex';
    agoraRoomView.style.display = 'none';
    populateEpisodesFeedSelect();
    stopAgoraPolling();
  } else if (tab === 'agora') {
    tabAlertsBtn.classList.remove('active');
    tabEpisodesBtn.classList.remove('active');
    tabAgoraBtn.classList.add('active');
    alertsConfigView.style.display = 'none';
    episodesFeedbackView.style.display = 'none';
    agoraRoomView.style.display = 'flex';
    startAgoraPolling();
  }
}

let agoraInterval = null;

function startAgoraPolling() {
  stopAgoraPolling();
  updateAgoraView();
  agoraInterval = setInterval(updateAgoraView, 2000);
}

function stopAgoraPolling() {
  if (agoraInterval) {
    clearInterval(agoraInterval);
    agoraInterval = null;
  }
}

async function updateAgoraView() {
  if (!currentGuildId) return;

  try {
    const res = await fetch(`/api/public/rooms/${currentGuildId}`);
    if (res.status === 404) {
      renderMockAgoraState();
      return;
    }
    const data = await res.json();
    renderAgoraState(data);
  } catch (err) {
    console.warn('[Agora] Failed to fetch live room state, falling back to mock:', err);
    renderMockAgoraState();
  }
}

function renderAgoraState(data) {
  agoraTrackTitle.textContent = data.episodeTitle || 'No Active Episode';
  agoraTrackFeed.textContent = data.feedUrl || '--';
  agoraStatusBadge.textContent = data.isPlaying ? '🟢 LIVE' : '⏸️ PAUSED';
  agoraStatusBadge.style.background = data.isPlaying ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.05)';
  agoraStatusBadge.style.color = data.isPlaying ? 'var(--accent)' : 'var(--text-dim)';

  // Calculate elapsed progress
  const durationMs = 3600000; // Default 1 hour if unspecified
  const progressPercent = Math.min(100, (data.extrapolatedPositionMs / durationMs) * 100);
  agoraProgressBar.style.width = `${progressPercent}%`;
  
  const formatTime = (ms) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  agoraCurrentTime.textContent = formatTime(data.extrapolatedPositionMs);

  // Host Info
  if (data.hostUserId) {
    agoraHostName.textContent = `Host User (ID: ${data.hostUserId})`;
  } else {
    agoraHostName.textContent = 'No active host';
  }

  // Listeners List
  agoraListenersList.innerHTML = '';
  if (data.listeners && data.listeners.length > 0) {
    data.listeners.forEach(l => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.background = 'rgba(255,255,255,0.01)';
      item.style.padding = '8px 12px';
      item.style.borderRadius = '8px';
      item.style.border = '1px solid var(--border)';
      
      const walletPart = l.walletAddress ? `<span style="font-size: 0.8rem; color: var(--accent);">⚡ ${l.walletAddress}</span>` : '';
      item.innerHTML = `
        <span style="font-size: 0.9rem; font-weight: 500;">👤 ${l.username}</span>
        ${walletPart}
      `;
      agoraListenersList.appendChild(item);
    });
  } else {
    agoraListenersList.innerHTML = '<div style="color: var(--text-dim); font-style: italic;">No active listeners.</div>';
  }

  // Upcoming Schedule List
  agoraUpcomingList.innerHTML = '';
  if (data.upcoming && data.upcoming.length > 0) {
    data.upcoming.forEach(item => {
      const el = document.createElement('div');
      el.style.display = 'flex';
      el.style.justifyContent = 'space-between';
      el.style.background = 'rgba(255,255,255,0.01)';
      el.style.padding = '10px 14px';
      el.style.borderRadius = '8px';
      el.style.border = '1px solid var(--border)';
      
      const startStr = new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      el.innerHTML = `
        <div>
          <div style="font-size: 0.9rem; font-weight: 600; color: white;">${item.title}</div>
          <div style="font-size: 0.75rem; color: var(--text-dim); font-family: 'JetBrains Mono', monospace;">${item.episodeGuid}</div>
        </div>
        <span style="font-size: 0.8rem; color: var(--accent); font-weight: 500;">${startStr}</span>
      `;
      agoraUpcomingList.appendChild(el);
    });
  } else {
    agoraUpcomingList.innerHTML = '<div style="color: var(--text-dim); font-style: italic;">No upcoming tracks scheduled.</div>';
  }
}

function renderMockAgoraState() {
  const mockData = {
    episodeTitle: 'Mock Podcast Episode: Aegis Aether Liveplugs',
    feedUrl: 'https://example.com/mock-feed.xml',
    isPlaying: true,
    extrapolatedPositionMs: 1450000,
    hostUserId: 'discord-admin-999',
    listeners: [
      { username: 'TrueBooster', walletAddress: 'truebooster@getalby.com' },
      { username: 'AegisFan', walletAddress: 'aegisfan@alby.com' },
      { username: 'LNSplitter', walletAddress: 'splitter@lens.xyz' }
    ],
    upcoming: [
      { title: 'Next Up: Value Flow Mechanics deep dive', startTime: Date.now() + 1800000, episodeGuid: 'guid-next-1' },
      { title: 'Future: Boostagram Leaderboard Reaper live', startTime: Date.now() + 3600000, episodeGuid: 'guid-next-2' }
    ]
  };
  renderAgoraState(mockData);
}

function populateEpisodesFeedSelect() {
  const selectedVal = episodesFeedSelect.value;
  episodesFeedSelect.innerHTML = '<option value="" disabled selected>Select a subscribed feed...</option>';
  
  // Deduplicate feeds
  const uniqueFeeds = [];
  const feedUrls = new Set();
  
  activeSubscriptions.forEach(s => {
    if (!feedUrls.has(s.feed_url)) {
      feedUrls.add(s.feed_url);
      uniqueFeeds.push(s);
    }
  });
  
  uniqueFeeds.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.feed_url;
    opt.textContent = s.alias || s.feed_url;
    episodesFeedSelect.appendChild(opt);
  });
  
  if (selectedVal && feedUrls.has(selectedVal)) {
    episodesFeedSelect.value = selectedVal;
  } else {
    // Reset view
    episodesListContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Select a feed to view episodes.</div>';
    selectedEpisodeHeaderCard.style.display = 'none';
    chaptersCard.style.display = 'none';
    commentsCard.style.display = 'none';
    currentSelectedEpisode = null;
    currentFeedUrl = null;
  }
}

async function loadEpisodesList(feedUrl) {
  episodesListContainer.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 20px;"><div class="spinner" style="width: 24px; height: 24px; margin: 0 auto 10px auto;"></div>Loading episodes...</div>';
  selectedEpisodeHeaderCard.style.display = 'none';
  chaptersCard.style.display = 'none';
  commentsCard.style.display = 'none';
  currentSelectedEpisode = null;

  try {
    const res = await fetch(`/api/guilds/${currentGuildId}/episodes?feedUrl=${encodeURIComponent(feedUrl)}`);
    const episodes = await res.json();

    episodesListContainer.innerHTML = '';
    if (!episodes || episodes.length === 0) {
      episodesListContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">No episodes found in feed.</div>';
      return;
    }

    episodes.forEach(ep => {
      const item = document.createElement('div');
      item.className = 'episode-item';
      
      const pubDateFormatted = ep.pubDate ? new Date(ep.pubDate).toLocaleDateString() : 'Unknown Date';
      
      let durationStr = '--:--';
      if (ep.duration) {
        const h = Math.floor(ep.duration / 3600);
        const m = Math.floor((ep.duration % 3600) / 60);
        const s = ep.duration % 60;
        durationStr = h > 0 
          ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` 
          : `${m}:${String(s).padStart(2, '0')}`;
      }

      item.innerHTML = `
        <div class="episode-title-lbl">${ep.title}</div>
        <div class="episode-meta-lbl">
          <span>${pubDateFormatted}</span>
          <span>${durationStr}</span>
        </div>
      `;

      item.addEventListener('click', () => selectEpisode(ep, item));
      episodesListContainer.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load episodes:', err);
    episodesListContainer.innerHTML = '<div style="color: var(--danger); text-align: center; padding: 20px;">Failed to load episodes.</div>';
  }
}

function selectEpisode(ep, element) {
  document.querySelectorAll('.episode-item').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  currentSelectedEpisode = ep;

  selectedEpisodeTitle.textContent = ep.title;
  selectedEpisodeDate.textContent = ep.pubDate 
    ? `Published: ${new Date(ep.pubDate).toLocaleString()}` 
    : 'Published: Unknown';
  
  if (ep.image) {
    selectedEpisodeImg.src = ep.image;
    selectedEpisodeImg.style.display = 'block';
  } else {
    selectedEpisodeImg.style.display = 'none';
  }
  selectedEpisodeHeaderCard.style.display = 'block';

  loadChapters(ep);
  loadNostrComments(ep);
}

async function loadChapters(ep) {
  chaptersCard.style.display = 'block';
  chaptersTimelineContainer.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 20px;"><div class="spinner" style="width: 20px; height: 20px; margin: 0 auto 10px auto;"></div>Loading chapters...</div>';

  if (!ep.chaptersUrl) {
    chaptersTimelineContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">No chapters defined in feed for this episode.</div>';
    return;
  }

  try {
    const url = `/api/guilds/${currentGuildId}/episodes/${encodeURIComponent(ep.guid)}/chapters?feedUrl=${encodeURIComponent(currentFeedUrl)}&chaptersUrl=${encodeURIComponent(ep.chaptersUrl)}`;
    const res = await fetch(url);
    const data = await res.json();

    chaptersTimelineContainer.innerHTML = '';
    const chapters = data.chapters || [];
    if (chapters.length === 0) {
      chaptersTimelineContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">No chapters found.</div>';
      return;
    }

    chapters.forEach((chap, idx) => {
      const item = document.createElement('div');
      item.className = 'chapter-item';

      const startSecs = parseInt(chap.startTime, 10) || 0;
      const startFormatted = formatTime(startSecs);

      let detailsHtml = '';
      if (chap.customLinkUrl || chap.customNotes) {
        detailsHtml = `
          <div class="chapter-attachment-box">
            ${chap.customLinkUrl ? `
              <div>
                <a href="${chap.customLinkUrl}" target="_blank" class="chapter-link">
                  🔗 ${chap.customLinkTitle || 'Reference Link'}
                </a>
              </div>
            ` : ''}
            ${chap.customNotes ? `
              <div class="chapter-notes-lbl">${chap.customNotes}</div>
            ` : ''}
          </div>
        `;
      }

      item.innerHTML = `
        <div class="chapter-header">
          <div class="chapter-title-lbl">${idx + 1}. ${chap.title || `Chapter ${idx + 1}`}</div>
          <span class="chapter-duration">${startFormatted}</span>
        </div>
        ${detailsHtml}
        <button type="button" class="chapter-btn-edit">Edit Attachment</button>
      `;

      item.querySelector('.chapter-btn-edit').addEventListener('click', () => openChapterModal(chap, idx));
      chaptersTimelineContainer.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load chapters:', err);
    chaptersTimelineContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Failed to load chapters.</div>';
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` 
    : `${m}:${String(s).padStart(2, '0')}`;
}

function openChapterModal(chap, idx) {
  modalFeedUrl.value = currentFeedUrl;
  modalEpisodeGuid.value = currentSelectedEpisode.guid;
  modalChapterIndex.value = idx;

  const startFormatted = formatTime(parseInt(chap.startTime, 10) || 0);
  modalChapterInfo.textContent = `Chapter #${idx + 1}: ${chap.title || 'Untitled'} (${startFormatted})`;

  modalLinkTitle.value = chap.customLinkTitle || '';
  modalLinkUrl.value = chap.customLinkUrl || '';
  modalNotes.value = chap.customNotes || '';

  chapterModal.style.display = 'flex';
}

async function handleChapterModalSubmit(e) {
  e.preventDefault();
  
  const feedUrl = modalFeedUrl.value;
  const guid = modalEpisodeGuid.value;
  const index = modalChapterIndex.value;

  const body = {
    feedUrl,
    linkTitle: modalLinkTitle.value || null,
    linkUrl: modalLinkUrl.value || null,
    notes: modalNotes.value || null
  };

  try {
    const url = `/api/guilds/${currentGuildId}/episodes/${encodeURIComponent(guid)}/chapters/${index}/metadata`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await res.json();
    
    if (result.error) {
      alert(`Error saving metadata: ${result.error}`);
    } else {
      chapterModal.style.display = 'none';
      loadChapters(currentSelectedEpisode);
    }
  } catch (err) {
    console.error('Failed to save chapter metadata:', err);
    alert('Failed to save chapter metadata.');
  }
}

async function loadNostrComments(ep) {
  commentsCard.style.display = 'block';
  commentsListContainer.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 20px;"><div class="spinner" style="width: 20px; height: 20px; margin: 0 auto 10px auto;"></div>Loading Nostr comments...</div>';

  const nostrConfig = ep.socialInteract ? ep.socialInteract.find(
    si => si.protocol === 'nostr' || si.uri?.includes('note1') || si.uri?.includes('nevent1')
  ) : null;

  if (!nostrConfig) {
    commentsListContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">No Nostr feed configuration (podcast:socialInteract) found for this episode.</div>';
    return;
  }

  try {
    const url = `/api/guilds/${currentGuildId}/episodes/${encodeURIComponent(ep.guid)}/comments?feedUrl=${encodeURIComponent(currentFeedUrl)}&nostrUri=${encodeURIComponent(nostrConfig.uri)}`;
    const res = await fetch(url);
    const comments = await res.json();

    commentsListContainer.innerHTML = '';
    if (!comments || comments.length === 0) {
      commentsListContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">No comments found on Nostr for this event.</div>';
      return;
    }

    comments.forEach(c => {
      const item = document.createElement('div');
      item.className = 'comment-item';

      const timeFormatted = new Date(c.createdAt * 1000).toLocaleString();
      const avatarUrl = c.authorAvatar || '';

      item.innerHTML = `
        <div class="comment-header">
          <div class="comment-author-avatar" style="${avatarUrl ? `background-image: url(${avatarUrl})` : ''}">
            ${avatarUrl ? '' : '💬'}
          </div>
          <div class="comment-author-info">
            <div class="comment-author-name">${c.authorName}</div>
            <div class="comment-time">${timeFormatted}</div>
          </div>
        </div>
        <div class="comment-body">${c.content}</div>
        <div class="comment-footer-actions">
          <button type="button" class="comment-btn-push" ${c.pushed ? 'disabled' : ''}>
            ${c.pushed ? 'Pushed to Discord' : 'Push to Discord'}
          </button>
        </div>
      `;

      if (!c.pushed) {
        item.querySelector('.comment-btn-push').addEventListener('click', (e) => pushCommentToDiscord(c, ep, e.target));
      }

      commentsListContainer.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load Nostr comments:', err);
    commentsListContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Failed to fetch comments from Nostr relays.</div>';
  }
}

async function pushCommentToDiscord(c, ep, button) {
  const sub = activeSubscriptions.find(s => s.feed_url === currentFeedUrl) || {};
  const showTitle = sub.alias || 'Podcast';

  const body = {
    feedUrl: currentFeedUrl,
    episodeTitle: ep.title,
    showTitle,
    authorName: c.authorName,
    authorAvatar: c.authorAvatar,
    content: c.content,
    pubkey: c.pubkey,
    createdAt: c.createdAt
  };

  button.disabled = true;
  button.textContent = 'Pushing...';

  try {
    const url = `/api/guilds/${currentGuildId}/episodes/${encodeURIComponent(ep.guid)}/comments/${c.id}/push`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await res.json();

    if (result.success) {
      button.textContent = 'Pushed to Discord';
    } else {
      button.disabled = false;
      button.textContent = 'Push to Discord';
      alert(`Failed to push comment: ${result.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error('Push comment failed:', err);
    button.disabled = false;
    button.textContent = 'Push to Discord';
    alert('Failed to push comment to Discord.');
  }
}

// Run boot check

window.addEventListener('load', checkAuth);
