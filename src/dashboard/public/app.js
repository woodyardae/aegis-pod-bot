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

// Run boot check
window.addEventListener('load', checkAuth);
