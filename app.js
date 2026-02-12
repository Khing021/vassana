// Main Application Logic V3
import { NostrManager } from './nostr-manager.js';
import { GeoManager } from './geo-manager.js';
import { nip19 } from 'https://esm.sh/nostr-tools@2.1.0';

// --- Configuration ---
const TOPICS = [
    "Bitcoin", "Economics", "Privacy", "Coding", "Nostr",
    "Gadgets", "Mining", "Investment/Trading", "Geopolitics", "History",
    "Philosophy", "Art", "Music", "Gaming", "Health/Diet",
    "Parenting", "Spirituality", "Dating", "Anime/Manga", "Science"
];

const PERSONAS = [
    { id: 'newbie', label: 'Bitcoin Newbie', icon: '🐣', talks: [], listens: ['Bitcoin', 'Nostr', 'gadgets'] },
    { id: 'maxi', label: 'Bitcoiner', icon: '⚡', talks: ['Bitcoin', 'Economics'], listens: ['Privacy', 'Mining'] },
    { id: 'investor', label: 'Investor', icon: '📈', talks: ['Investment/Trading', 'Economics'], listens: ['Geopolitics'] },
    { id: 'tech', label: 'Tech Bro', icon: '💻', talks: ['Coding', 'Gadgets'], listens: ['Science', 'AI'] },
    { id: 'philosopher', label: 'Philosopher', icon: '🤔', talks: ['Philosophy', 'History'], listens: ['Spirituality'] },
    { id: 'artist', label: 'Artist', icon: '🎨', talks: ['Art', 'Music'], listens: ['Nostr'] },
    { id: 'health', label: 'Health Nut', icon: '🥦', talks: ['Health/Diet'], listens: ['Science'] },
    { id: 'gamer', label: 'Gamer', icon: '🎮', talks: ['Gaming', 'Anime/Manga'], listens: ['Coding'] },
    { id: 'freedom', label: 'Freedom Lover', icon: '🗽', talks: ['Privacy', 'Geopolitics'], listens: ['Bitcoin'] },
    { id: 'precoiner', label: 'Pre-coiner', icon: '👀', talks: [], listens: ['Bitcoin', 'Economics'] }
];

// --- State ---
const state = {
    map: null,
    centerPinMarker: null, // Virtual concept, actually fixed in HTML
    mapCenterCoords: null, // {lat, lng}

    currentUser: null,
    nostrManager: new NostrManager(),
    geoManager: new GeoManager(),

    // Wizard State
    selectedPersonas: new Set(),
    endpointTopicMap: new Map(), // merged result
    markers: {}
};

// --- DOM Elements ---
const els = {
    map: document.getElementById('map'),
    centerPin: document.getElementById('center-pin'),

    // Modals
    modals: document.querySelectorAll('.modal'),
    loginModal: document.getElementById('login-modal'),
    profileModal: document.getElementById('profile-modal'),
    relayModal: document.getElementById('relay-modal'),
    wizardModal: document.getElementById('checkin-wizard'),

    // Wizard Steps
    step1: document.getElementById('step-1'),
    step2: document.getElementById('step-2'),
    step3: document.getElementById('step-3'),
    wizardTitle: document.getElementById('wizard-title'),

    // Inputs/Containers
    personaGrid: document.querySelector('.persona-grid'),
    topicGrid: document.querySelector('.topic-grid'),
    relayList: document.getElementById('relay-list'),

    // Buttons
    checkinBtn: document.getElementById('checkin-trigger-btn'),
    showLoginBtn: document.getElementById('show-login-btn'),
    createAccountBtn: document.getElementById('create-account-btn'),
    nsecLoginBtn: document.getElementById('nsec-login-btn'),
    profileBtn: document.getElementById('profile-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    gpsResetBtn: document.getElementById('gps-reset-btn'),
    broadcastBtn: document.getElementById('broadcast-btn')
};

// --- Initialization ---

async function init() {
    initMap();
    initUI();

    // Auth Check
    const user = await state.nostrManager.loadSession();
    if (user) {
        state.currentUser = user;
        updateUserUI();
    }
}

function initMap() {
    // Default Bangkok
    state.map = L.map('map').setView([13.7563, 100.5018], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(state.map);

    // Initial GPS
    state.geoManager.getPosition().then(pos => {
        state.map.setView([pos.lat, pos.lng], 15);

        // Add User Marker (Blue Dot)
        L.circleMarker([pos.lat, pos.lng], {
            radius: 8,
            fillColor: "#3b82f6",
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(state.map).bindPopup("You are here");

        updateMapCenter();

        // Fix for "gray tiles" / incomplete loading
        setTimeout(() => state.map.invalidateSize(), 500);
    }).catch(e => {
        console.warn("GPS Fail", e);
        // Even if GPS fails, ensure map settles
        setTimeout(() => state.map.invalidateSize(), 500);
    });

    // Force show center pin (it starts hidden)
    els.centerPin.classList.remove('hidden');

    // Listen to Map Move
    state.map.on('move', updateMapCenter);
    state.map.on('moveend', updateMapCenter);

    // Hide Pin when Popup Open (Fix Overlap)
    state.map.on('popupopen', () => els.centerPin.classList.add('hidden'));
    state.map.on('popupclose', () => els.centerPin.classList.remove('hidden'));

    // Subscribe
    subscribeRelays();
}

function updateMapCenter() {
    const center = state.map.getCenter();
    state.mapCenterCoords = center;
    // Update subscription if we moved far enough (handled by subscribeRelays logic)
    subscribeRelays();
}

function initUI() {
    // Populate Personas
    els.personaGrid.innerHTML = PERSONAS.map(p => `
        <div class="persona-card" data-id="${p.id}">
            <div class="persona-icon">${p.icon}</div>
            <div>${p.label}</div>
        </div>
    `).join('');

    // Populate Topics
    els.topicGrid.innerHTML = TOPICS.map(t => `
        <button class="topic-tag" data-topic="${t}">${t}</button>
    `).join('');

    // Click Handlers
    document.querySelectorAll('.btn-icon, .btn-primary, .btn-secondary, .btn-action, .btn-scan, .btn-danger, .btn-vassana-scan, .btn-vassana-checkin').forEach(b => {
        if (b.id) b.addEventListener('click', handleBtnClick);
    });

    // Close Modals
    document.querySelectorAll('.close-modal').forEach(b => {
        b.addEventListener('click', () => els.modals.forEach(m => m.classList.add('hidden')));
    });

    // Delegated Events
    els.personaGrid.addEventListener('click', e => {
        const card = e.target.closest('.persona-card');
        if (card) togglePersona(card);
    });

    els.topicGrid.addEventListener('click', e => {
        const tag = e.target.closest('.topic-tag');
        if (tag) cycleTopic(tag);
    });

    // Key Copying
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);

            let text = input.value;
            if (targetId === 'nsec-display') {
                text = state.nostrManager.getNsec() || text;
            }

            navigator.clipboard.writeText(text);
            const originalIcon = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => btn.innerHTML = originalIcon, 1500);
        });
    });

    // Nsec Toggle
    document.getElementById('toggle-nsec-btn').addEventListener('click', (e) => {
        const input = document.getElementById('nsec-display');
        if (input.type === 'password') {
            input.type = 'text';
            input.value = state.nostrManager.getNsec() || '';
        } else {
            input.type = 'password';
            input.value = '••••••••••••••••';
        }
    });

    // Relay Add
    document.getElementById('add-relay-btn').addEventListener('click', () => {
        const url = document.getElementById('new-relay-url').value.trim();
        if (url) {
            state.nostrManager.addRelay(url);
            renderRelays();
            document.getElementById('new-relay-url').value = '';
        }
    });
}

// --- Interaction Logic ---

function handleBtnClick(e) {
    const id = e.currentTarget.id;

    switch (id) {
        case 'show-login-btn': els.loginModal.classList.remove('hidden'); break;
        case 'profile-btn': openProfile(); break;
        case 'settings-btn': openRelays(); break;
        case 'checkin-trigger-btn': startWizard(); break;

        // Auth
        case 'create-account-btn': createAccount(); break;
        case 'nsec-login-btn': loginNsec(); break;
        case 'logout-btn': logout(); break;

        // Map
        case 'gps-reset-btn': resetGPS(); break;

        // Wizard Navigation
        case 'step1-next': goToStep(2); break;
        case 'step2-back': goToStep(1); break;
        case 'step2-next':
            if (isFilterMode) {
                scanForMatches();
            } else {
                goToStep(3);
            }
            break;
        case 'step3-back': goToStep(2); break;
        case 'broadcast-btn': broadcast(); break;

        // Find Peers
        case 'find-peers-btn': startFindPeers(); break;
        case 'close-feed-btn': document.getElementById('results-feed').classList.add('hidden'); break;
        case 'rescan-btn': scanForMatches(); break;
        case 'clear-feed-btn': clearFindPeersResults(); break;
    }
}

// ... (renderTopics etc.)

// --- Find Peers Logic ---

let isFilterMode = false; // "Find Peers" vs "Check-in"
let lastScanMatches = null; // Persistence

function startWizard() {
    isFilterMode = false; // Check-in Mode
    resetWizardState();

    // Pre-fill fields
    const profile = state.nostrManager.profile || {};
    document.getElementById('user-name').value = profile.name || (profile.display_name || '');

    initTimeInputs();

    els.wizardModal.classList.remove('hidden');
    // Ensure button says Next (might have been changed by Filter Mode)
    document.getElementById('step2-next').innerText = "Next: Details";
    goToStep(1);
}

function startFindPeers() {
    // If we have results, just open the feed (Persistence)
    if (lastScanMatches && lastScanMatches.length > 0) {
        renderResultsFeed(lastScanMatches);
        return;
    }

    isFilterMode = true; // Filter Mode
    // Do NOT reset if we want to remember last choice? User said "Rescan with same topics", implying state.endpointTopicMap should survive.
    if (state.endpointTopicMap.size === 0) resetWizardState(); // Only reset if empty

    els.wizardModal.classList.remove('hidden');
    // Change Step 2 Button to "Scan"
    document.getElementById('step2-next').innerText = "Scan for Peers 🔍";
    goToStep(1);
}

function clearFindPeersResults() {
    lastScanMatches = null;
    state.endpointTopicMap.clear(); // Clear selection
    // Also clear wizard UI state
    resetWizardState();
    document.getElementById('results-feed').classList.add('hidden');
    startFindPeers(); // Re-open wizard immediately? Or just close? User said "return to set new topics". Opening wizard seems right.
}

function resetWizardState() {
    state.selectedPersonas.clear();
    state.endpointTopicMap.clear();
    document.querySelectorAll('.persona-card.selected').forEach(e => e.classList.remove('selected'));
    document.querySelectorAll('.topic-tag').forEach(e => {
        delete e.dataset.status;
        e.classList.remove('selected');
    });
}

function scanForMatches() {
    const scannerTopics = state.endpointTopicMap;
    const matches = [];

    // Iterate all loaded markers
    Object.values(state.markers).forEach(marker => {
        const content = marker.options.parsedContent;
        if (!content || !content.topics) return;

        const targetTopics = content.topics;

        // Match Logic
        const commonTopics = [];
        for (const [topic, scannerStatus] of scannerTopics.entries()) {
            const targetStatus = targetTopics[topic];
            if (!targetStatus) continue;

            let isMatch = false;
            // 1. Scanner=Talk -> Match if Target is Talk OR Listen
            if (scannerStatus === 'talk') {
                if (targetStatus === 'talk' || targetStatus === 'listen') isMatch = true;
            }
            // 2. Scanner=Listen -> Match if Target is Talk ONLY
            else if (scannerStatus === 'listen') {
                if (targetStatus === 'talk') isMatch = true;
            }

            if (isMatch) {
                commonTopics.push({ topic, scannerStatus, targetStatus });
            }
        }

        if (commonTopics.length > 0) {
            matches.push({ marker, content, commonTopics, event: marker.options.eventData });
        }
    });

    lastScanMatches = matches; // Save for persistence
    renderResultsFeed(matches);
    els.wizardModal.classList.add('hidden');
}

function renderResultsFeed(matches) {
    const feed = document.getElementById('results-feed');
    const list = document.getElementById('feed-list');
    list.innerHTML = '';

    if (!matches || matches.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:#bbb;">No matches found nearby.<br>Try broader topics!</div>';
        // Allow rescan even if no matches
    } else {
        matches.forEach(m => {
            const div = document.createElement('div');
            div.className = 'feed-item';

            // Time logic
            let timeStr = "";
            const endTag = m.event.tags.find(t => t[0] === 'end_time');
            if (endTag) {
                const date = new Date(parseInt(endTag[1]) * 1000);
                timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            // Topics HTML
            // Match styles: Talk=Green/Speaker, Listen=Blue/Ear
            const topicsHtml = m.commonTopics.map(t => {
                const isTalk = t.targetStatus === 'talk'; // Show TARGET's status
                const color = isTalk ? '#10b981' : '#3b82f6';
                const icon = isTalk ? '🗣️' : '👂';
                return `<span style="background:${color}33; color:${color}; padding:2px 8px; border-radius:12px; font-size:0.75em; display:inline-flex; align-items:center; gap:4px; margin-right:4px; margin-top:4px;">${icon} ${t.topic}</span>`;
            }).join('');

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <strong style="font-size:1em;">${m.content.name || "Anonymous"}</strong>
                        <div style="font-size:0.85em; color:#bbb; margin-top:2px;">📍 ${m.content.place || 'Unknown'}</div>
                    </div>
                    ${timeStr ? `<div style="font-size:0.8em; color:#f43f5e; font-weight:600;">⏳ ${timeStr}</div>` : ''}
                </div>

                ${m.content.note ? `<div style="font-size:0.85em; color:#888; font-style:italic; margin:6px 0;">"${m.content.note}"</div>` : ''}

                <div style="display:flex; flex-wrap:wrap;">
                    ${topicsHtml}
                </div>
            `;

            div.addEventListener('click', () => {
                state.map.setView(m.marker.getLatLng(), 16);
                m.marker.openPopup();
            });

            list.appendChild(div);
        });
    }

    feed.classList.remove('hidden');
}

// --- Auth ---
async function createAccount() {
    await state.nostrManager.createAccount();
    state.currentUser = state.nostrManager.pk;
    updateUserUI();
    els.loginModal.classList.add('hidden');
}

async function loginNsec() {
    const key = document.getElementById('nsec-input').value.trim();
    if (!key) return;
    try {
        await state.nostrManager.loginWithSecret(key);
        state.currentUser = state.nostrManager.pk;
        updateUserUI();
        els.loginModal.classList.add('hidden'); // Fix: Close modal
    } catch (e) { alert(e.message); }
}

function logout() {
    if (confirm("Are you sure you want to logout?")) {
        state.nostrManager.logout();
        state.currentUser = null;
        updateUserUI();
        window.location.reload();
    }
}

function updateUserUI() {
    const loggedIn = !!state.currentUser;
    document.getElementById('login-area').classList.toggle('hidden', loggedIn);
    document.getElementById('user-status').classList.toggle('hidden', !loggedIn);

    els.checkinBtn.disabled = !loggedIn;
    els.checkinBtn.innerText = loggedIn ? "📍 I'm available here" : "🔒 Login to Check-in";
    els.centerPin.classList.toggle('hidden', !loggedIn); // Only show pin when ready to checkin? Or always?
    // Let's show pin always for exploration, but maybe it's cleaner to show only when wizard active? 
    // User requested: "Lock pin at center... drag map to move pin". This implies pin is always visible or visible during checkin.
    // Let's keep it hidden until checkin wizard starts? Or clearer: Always visible to indicate WHERE checkin will happen.
    els.centerPin.classList.remove('hidden');
}

function openProfile() {
    els.profileModal.classList.remove('hidden');
    document.getElementById('npub-display').value = state.nostrManager.getNpub();
    // nsec is masked by default
    document.getElementById('nsec-display').value = '••••••••••••••••';
    document.getElementById('nsec-display').type = 'password';
}

// --- Relay Mgmt ---
function openRelays() {
    els.relayModal.classList.remove('hidden');
    renderRelays();
}

function renderRelays() {
    const relays = state.nostrManager.getRelays();
    els.relayList.innerHTML = relays.map(r => `
        <li class="relay-item">
            <span><span class="relay-status connected"></span>${r}</span>
            <button onclick="removeRelay('${r}')" style="color:red; background:none; border:none; cursor:pointer;">&times;</button>
        </li>
    `).join('');

    // Hack to attach remove listener (since innerHTML wipes listeners)
    window.removeRelay = (url) => {
        state.nostrManager.removeRelay(url);
        renderRelays();
    };
}

// --- Wizard Helpers ---

function goToStep(n) {
    els.step1.classList.add('hidden');
    els.step2.classList.add('hidden');
    els.step3.classList.add('hidden');

    if (n === 1) {
        els.step1.classList.remove('hidden');
        els.wizardTitle.innerText = "Step 1: Choose Persona";
    } else if (n === 2) {
        els.step2.classList.remove('hidden');
        els.wizardTitle.innerText = "Step 2: Refine Topics";
        calculateTopicPresets(); // Apply persona logic
    } else if (n === 3) {
        els.step3.classList.remove('hidden');
        els.wizardTitle.innerText = "Step 3: Details";
    }
}

function togglePersona(card) {
    const id = card.dataset.id;
    if (state.selectedPersonas.has(id)) {
        state.selectedPersonas.delete(id);
        card.classList.remove('selected');
    } else {
        state.selectedPersonas.add(id);
        card.classList.add('selected');
    }
}

function calculateTopicPresets() {
    // Re-calc map from personas
    // Priority: Talk > Listen > Ignore
    const map = new Map();

    PERSONAS.forEach(p => {
        if (state.selectedPersonas.has(p.id)) {
            p.talks.forEach(t => map.set(t, 'talk'));
            p.listens.forEach(t => {
                if (map.get(t) !== 'talk') map.set(t, 'listen');
            });
        }
    });

    state.endpointTopicMap = map;
    renderTopics();
}

function renderTopics() {
    document.querySelectorAll('.topic-tag').forEach(tag => {
        const topic = tag.dataset.topic;
        const status = state.endpointTopicMap.get(topic);
        if (status) {
            tag.dataset.status = status;
        } else {
            delete tag.dataset.status;
        }
    });
}

function cycleTopic(tag) {
    const topic = tag.dataset.topic;
    const current = state.endpointTopicMap.get(topic);

    if (!current) state.endpointTopicMap.set(topic, 'talk');
    else if (current === 'talk') state.endpointTopicMap.set(topic, 'listen');
    else state.endpointTopicMap.delete(topic);

    renderTopics();
}

// --- GPS & Map ---

function resetGPS() {
    state.geoManager.getPosition().then(pos => {
        state.map.setView([pos.lat, pos.lng], 15);
    });
}

async function broadcast() {
    const btn = els.broadcastBtn;
    btn.innerText = "Broadcasting...";
    btn.disabled = true;

    try {
        const name = document.getElementById('user-name').value.trim();
        if (!name) throw new Error("Nickname is required!");

        const details = {
            name: name,
            place: document.getElementById('place-name').value.trim(),
            note: document.getElementById('landmark-note').value.trim()
        };

        const center = state.map.getCenter();
        const geohash = state.geoManager.encode(center.lat, center.lng);

        // Times
        const now = new Date();
        const sTime = document.getElementById('start-time').value;
        const eTime = document.getElementById('end-time').value;
        const start = new Date(now.toDateString() + ' ' + sTime);
        const end = new Date(now.toDateString() + ' ' + eTime);
        if (end < start) end.setDate(end.getDate() + 1);

        const contentObj = {
            ...details,
            topics: Object.fromEntries(state.endpointTopicMap)
        };

        const publishedEvent = await state.nostrManager.publishCheckIn(
            geohash,
            state.endpointTopicMap,
            Math.floor(start.getTime() / 1000),
            Math.floor(end.getTime() / 1000),
            contentObj
        );

        // Optimistic UI: Show my own check-in immediately
        addMarker({
            id: 'my-checkin-' + Date.now(),
            pubkey: state.currentUser,
            content: JSON.stringify(contentObj),
            tags: publishedEvent.tags
        }, true); // isSelf = true

        alert("Broadcast Success!");
        els.wizardModal.classList.add('hidden');
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.innerText = "Broadcast Availability 📡";
        btn.disabled = false;
    }
}

// --- Subscriptions ---
let lastSubscribedGeohash = null;

function subscribeRelays() {
    // Discovery Precision: 5 (approx 5km radius) to find nearby users
    const DISCOVERY_PRECISION = 5;

    // Use map center to find appropriate geohashes
    const center = state.map.getCenter();
    const geohash = state.geoManager.encode(center.lat, center.lng, DISCOVERY_PRECISION);

    // Debounce: Only resubscribe if we moved to a new sector
    if (geohash === lastSubscribedGeohash) return;
    lastSubscribedGeohash = geohash;
    console.log("Moved to new sector, subscribing:", geohash);

    const neighbors = state.geoManager.getNeighborGeohashes(geohash);

    state.nostrManager.subscribeToNearby(neighbors, handleEvent);
}

function handleEvent(event) {
    if (state.markers[event.id]) return;
    addMarker(event);
}

function addMarker(event, isSelf = false) {
    // Parse
    let lat, lng;
    const gTag = event.tags.find(t => t[0] === 'g');
    if (gTag) {
        const decoded = state.geoManager.decode(gTag[1]);
        lat = decoded.latitude;
        lng = decoded.longitude;
    } else return;

    // Content
    let content = {};
    if (typeof event.content === 'string') {
        try {
            // Robust parsing: Look for "(JSON: " marker at the end
            const marker = "\n\n(JSON: ";
            const idx = event.content.lastIndexOf(marker);

            if (idx !== -1) {
                // Extract just the JSON part, excluding the closing ')'
                const jsonStr = event.content.substring(idx + marker.length, event.content.lastIndexOf(')'));
                content = JSON.parse(jsonStr);
            } else {
                // Try finding first '{' check as fallback (legacy)
                const jsonStart = event.content.indexOf('{');
                if (jsonStart !== -1) {
                    // Try to parse, but it might fail if there's trailing junk. 
                    // Let's rely on valid JSON structure being self-contained or crash safely.
                    content = JSON.parse(event.content.substring(jsonStart));
                } else {
                    content = { note: event.content };
                }
            }
        } catch (e) {
            // Final fallback: Use entire content as note (but clean up the JSON part if visual clutter)
            console.warn("Content parse error", e);
            content = { note: event.content.split('\n\n(JSON:')[0] };
        }
    }

    // Parse Time
    let untilStr = "";
    const endTag = event.tags.find(t => t[0] === 'end_time');
    if (endTag) {
        const date = new Date(parseInt(endTag[1]) * 1000);
        untilStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Icon customization for self
    const color = isSelf ? '#10b981' : '#8b5cf6';

    // Marker
    const marker = L.circleMarker([lat, lng], {
        eventData: event,
        parsedContent: content, // Store parsed content for filtering
        radius: 8,
        fillColor: color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 1
    }).addTo(state.map);

    const npub = event.pubkey ? nip19.npubEncode(event.pubkey) : '';

    marker.bindPopup(`
            <div style="min-width: 180px; font-family: 'Inter', sans-serif;">
                <div style="margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
                    <strong style="font-size: 1.1em; color: #333;">${content.name || 'Anonymous'}</strong>
                    ${npub ? `
                        <button onclick="navigator.clipboard.writeText('${npub}'); this.innerHTML='✅'; setTimeout(()=>this.innerHTML='📋',1000);" 
                        style="background:none; border:none; cursor:pointer; font-size:1.1em;" title="Copy Npub">
                        📋
                        </button>
                    ` : ''}
                </div>
                
                <div style="color: #555; font-size: 0.9em; margin-bottom: 2px;">
                    📍 ${content.place || 'Unknown Place'}
                </div>
                
                ${untilStr ? `<div style="color: #e11d48; font-size: 0.85em; font-weight: 600; margin-bottom: 6px;">
                    ⏳ Until ${untilStr}
                </div>` : ''}

                ${content.note ? `<div style="background: #f3f4f6; padding: 6px; border-radius: 6px; color: #444; font-style: italic; font-size: 0.9em; margin-bottom: 8px;">"${content.note}"</div>` : ''}
                
                ${content.topics ? `<div style="display: flex; flex-wrap: wrap; gap: 4px;">
                    ${Object.entries(content.topics).map(([k, v]) =>
        `<span style="
                            background: ${v === 'talk' ? '#10b981' : '#3b82f6'}; 
                            color: white; 
                            padding: 3px 8px; 
                            border-radius: 12px; 
                            font-size: 0.75em; 
                            font-weight: 600;
                            display: inline-flex;
                            align-items: center;
                            gap: 3px;
                        ">
                            ${v === 'talk' ? '🗣️' : '👂'} ${k}
                        </span>`
    ).join('')}
                </div>` : ''}
            </div>
        `);

    state.markers[event.id || event.id_temp] = marker; // Handle temp IDs
}

// Time Lib
function initTimeInputs() {
    const now = new Date();
    const coeff = 1000 * 60 * 15;
    const rounded = new Date(Math.ceil(now.getTime() / coeff) * coeff);
    const end = new Date(rounded.getTime() + 60 * 60 * 1000);

    const startEl = document.getElementById('start-time');
    const endEl = document.getElementById('end-time');
    const displayEl = document.getElementById('duration-display');

    startEl.value = rounded.toTimeString().slice(0, 5);
    endEl.value = end.toTimeString().slice(0, 5);

    function updateDuration() {
        const s = startEl.value.split(':');
        const e = endEl.value.split(':');
        if (!s[0] || !e[0]) return;

        let startMin = parseInt(s[0]) * 60 + parseInt(s[1]);
        let endMin = parseInt(e[0]) * 60 + parseInt(e[1]);

        if (endMin < startMin) endMin += 24 * 60; // Cross midnight

        const diff = endMin - startMin;
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        displayEl.innerText = `Total: ${h}h ${m > 0 ? m + 'm' : ''}`;
    }

    startEl.addEventListener('input', updateDuration);
    endEl.addEventListener('input', updateDuration);
}

// Run
init();
