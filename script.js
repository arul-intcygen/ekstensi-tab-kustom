import { KEYS } from './js/config.js';
import { store } from './js/storage.js';
import { $, el, svg } from './js/utils.js';
import { initThemes, toggleMode } from './js/features/themes.js';

/* =========================================================
   Cozy Haven Tab — script.js

   Alur kerja (seperti resep: bahan → masak → sajikan):
     state (data)  →  render*() (menggambar)  →  event handler (mengubah data) → simpan → render ulang
   ========================================================= */

/* ---------- Konfigurasi ---------- */

const DEFAULT_SETTINGS = {
    userName: 'Petualang',
    islandName: 'Sherwood Haven',
    city: 'Jakarta',
    lat: -6.2088,
    lon: 106.8456,
};

const DEFAULT_CATEGORIES = ['Koding & AI', 'Pekerjaan', 'Belajar', 'Hiburan & Games'];

// Tebakan kategori (hanya dipakai sekali untuk shortcut lama yang belum punya kategori).
const CATEGORY_HINTS = {
    'Koding & AI': ['github', 'gemini', 'chatgpt', 'openai', 'claude', 'perplexity', 'deepseek', 'z.ai', 'glm', 'huggingface', 'stackoverflow'],
    'Belajar': ['duolingo', 'brilliant', 'medium', 'freedium', 'coursera', 'khanacademy', 'wikipedia'],
    'Hiburan & Games': ['epicgames', 'youtube', 'netflix', 'twitch', 'steampowered', 'spotify'],
    'Pekerjaan': ['notion', 'trello', 'slack', 'docs.google', 'drive.google', 'linkedin', 'shopee'],
};

const MIN_ICON_PX = 32;      // favicon lebih kecil dari ini dianggap buram/ikon bawaan → pakai huruf
const IDEAL_TABS = 5;        // ≤ jumlah ini = kerapian 100%
const MAX_TABS = 25;         // ≥ jumlah ini = kerapian 0%
const XP_PER_TASK = 10;
const XP_PER_STAR = 100;
const DAY = 86400000;

const TIPS = [
    'Istirahat sejenak setiap 45 menit. Minum segelas air putih dan lihat hijaunya daun di luar jendela!',
    'Aturan 20-20-20: setiap 20 menit, tatap benda sejauh 6 meter selama 20 detik.',
    'Tulis satu target terpenting hari ini dulu, baru buka tab yang lain.',
    'Tutup tab yang sudah tidak dipakai. Kepala ikut lega, RAM pun begitu.',
    'Belajar 25 menit, istirahat 5 menit. Teknik Pomodoro cocok untuk topik yang berat.',
    'Coba jelaskan konsep baru dengan kata-kata paling sederhana. Bagian yang tersendat itulah yang belum kamu pahami.',
    'Buat singkatan (mnemonik) untuk daftar yang sulit diingat, lalu ucapkan keras-keras.',
    'Regangkan bahu dan leher sebentar. Tubuh yang santai membuat pikiran lebih jernih.',
];

const LETTER_COLORS = ['#2E4F3E', '#4E6450', '#7A6A3F', '#8A5A2B', '#5F7F8A', '#8C5B4C', '#5C7A4E', '#6B5B7B'];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function hydrateIcons() {
    document.querySelectorAll('[data-icon]').forEach((node) => node.replaceChildren(svg(node.dataset.icon)));
}

function iconButton(icon, label, onClick, extraClass = '') {
    const b = el('button', 'mini-btn ' + extraClass);
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.appendChild(svg(icon));
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
    return b;
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Hanya http/https yang diterima (menolak javascript:, file:, dll.)
function normalizeUrl(input) {
    let s = String(input || '').trim();
    if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
    try {
        const u = new URL(s);
        return /^https?:$/.test(u.protocol) ? u.href : null;
    } catch (e) {
        return null;
    }
}

function hostname(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
}

function labelFromHost(host) {
    const part = host.split('.')[0] || host;
    return part.charAt(0).toUpperCase() + part.slice(1);
}

function isPrivateHost(host) {
    return !host.includes('.') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /\.(local|lan|home)$/.test(host);
}

function colorFor(name) {
    let sum = 0;
    for (const ch of name) sum += ch.charCodeAt(0);
    return LETTER_COLORS[sum % LETTER_COLORS.length];
}

function guessCategory(url) {
    const host = hostname(url).toLowerCase();
    for (const cat of Object.keys(CATEGORY_HINTS)) {
        if (state.categories.includes(cat) && CATEGORY_HINTS[cat].some((k) => host.includes(k))) return cat;
    }
    return '';
}

/* ---------- State ---------- */

function setActiveCat(cat) {
    state.activeCat = cat;
    store.set(KEYS.activeCat, cat);
}

const state = {
    settings: { ...DEFAULT_SETTINGS, ...store.get(KEYS.settings, {}) },
    categories: [],
    shortcuts: [],
    tasks: [],
    hits: {},
    xp: 0,
    activeCat: 'all',
    reorder: false,
    dragId: null,
    editingId: null,
};

const ui = {};   // referensi elemen, diisi saat init

/* ---------- Data: shortcut ---------- */

function sanitizeShortcuts(list) {
    const seen = new Set();
    return list.map((sc) => {
        if (!sc || typeof sc !== 'object') return null;
        const url = normalizeUrl(sc.url);
        if (!url) return null;
        let id = typeof sc.id === 'string' && sc.id && !seen.has(sc.id) ? sc.id : uid();
        seen.add(id);
        const name = String(sc.name || '').trim().slice(0, 40) || labelFromHost(hostname(url));
        let cat = typeof sc.cat === 'string' ? sc.cat : guessCategory(url);
        if (cat && !state.categories.includes(cat)) cat = '';
        return { id, name, url, desc: String(sc.desc || '').trim().slice(0, 30), cat };
    }).filter(Boolean);
}

function saveShortcuts() { store.set(KEYS.shortcuts, state.shortcuts); }
function saveCategories() { store.set(KEYS.categories, state.categories); }
function saveTasks() { store.set(KEYS.tasks, state.tasks); store.set(KEYS.xp, state.xp); }

function initShortcuts(done) {
    const stored = store.get(KEYS.shortcuts, null);
    if (Array.isArray(stored)) {
        state.shortcuts = sanitizeShortcuts(stored);
        saveShortcuts();
        return done();
    }

    const fallback = () => {
        state.shortcuts = sanitizeShortcuts([{ name: 'GitHub', url: 'https://github.com' }]);
        saveShortcuts();
        done();
    };

    // Pertama kali dipakai: isi awal dari situs teratas Chrome (sama seperti versimu sebelumnya)
    if (typeof chrome !== 'undefined' && chrome.topSites) {
        chrome.topSites.get((sites) => {
            const seeds = (sites || []).slice(0, 6).map((s) => ({
                name: s.title && s.title.length <= 24 ? s.title : labelFromHost(hostname(s.url)),
                url: s.url,
            }));
            if (!seeds.length) return fallback();
            state.shortcuts = sanitizeShortcuts(seeds);
            saveShortcuts();
            done();
        });
    } else {
        fallback();
    }
}

function visibleShortcuts() {
    return state.activeCat === 'all' ? state.shortcuts : state.shortcuts.filter((s) => s.cat === state.activeCat);
}

function recordHit(id) {
    const now = Date.now();
    const arr = (state.hits[id] || []).filter((t) => now - t < 14 * DAY);
    arr.push(now);
    state.hits[id] = arr;
    store.set(KEYS.hits, state.hits);
}

function moveShortcut(fromId, toId) {
    if (!fromId || fromId === toId) return;
    const from = state.shortcuts.findIndex((s) => s.id === fromId);
    const to = state.shortcuts.findIndex((s) => s.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = state.shortcuts.splice(from, 1);
    state.shortcuts.splice(to, 0, item);
    saveShortcuts();
    renderShortcuts();
}

function deleteShortcut(id) {
    const idx = state.shortcuts.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const [removed] = state.shortcuts.splice(idx, 1);
    saveShortcuts();
    renderAll();
    toast(`“${removed.name}” dihapus`, {
        label: 'Urungkan',
        onClick: () => {
            state.shortcuts.splice(Math.min(idx, state.shortcuts.length), 0, removed);
            saveShortcuts();
            renderAll();
        },
    });
}

/* ---------- Render: header & profil ---------- */

function greeting(hour) {
    if (hour >= 4 && hour < 11) return 'Selamat Pagi';
    if (hour >= 11 && hour < 15) return 'Selamat Siang';
    if (hour >= 15 && hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
}

function tzLabel() {
    const h = -new Date().getTimezoneOffset() / 60;
    return ({ 7: 'WIB', 8: 'WITA', 9: 'WIT' })[h] || `UTC${h >= 0 ? '+' : ''}${h}`;
}

function tick() {
    const d = new Date();
    ui.clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    ui.greeting.textContent = `${greeting(d.getHours())}, ${state.settings.userName}!`;
    ui.date.textContent = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function renderHeader() {
    const m = new Date().getMonth();   // Indonesia: hujan ≈ Okt–Apr, kemarau ≈ Mei–Sep
    ui.season.textContent = m >= 9 || m <= 3 ? 'Musim Hujan' : 'Musim Kemarau';
    ui.clockSub.textContent = `${tzLabel()} • ${state.settings.city}`;
    ui.avatarLetter.textContent = (state.settings.userName.trim().charAt(0) || 'P').toUpperCase();
    tick();
}

function renderProfile() {
    const done = state.tasks.filter((t) => t.done).length;
    const stars = Math.min(5, 1 + Math.floor(state.xp / XP_PER_STAR));
    ui.islandName.textContent = state.settings.islandName;
    ui.islandRank.textContent = `Peringkat ${stars} Bintang`;
    ui.statSaved.textContent = `${state.shortcuts.length} Web`;
    ui.statDone.textContent = `${done}/${state.tasks.length}`;
}

/* ---------- Render: kategori ---------- */

function renderCategories() {
    const list = ui.categoryList;
    list.textContent = '';

    const add = (key, label, count) => {
        const li = el('li');
        const btn = el('button', 'cat-item' + (state.activeCat === key ? ' active' : ''));
        btn.type = 'button';
        if (state.activeCat === key) btn.setAttribute('aria-current', 'true');
        btn.append(el('span', 'cat-name', label), el('span', 'cat-count', String(count)));
        btn.addEventListener('click', () => {
            setActiveCat(key);
            renderCategories();
            renderShortcuts();
        });
        li.appendChild(btn);
        list.appendChild(li);
    };

    add('all', 'Semua Shortcut', state.shortcuts.length);
    state.categories.forEach((c) => add(c, c, state.shortcuts.filter((s) => s.cat === c).length));
}

/* ---------- Render: shortcut ---------- */

function createIcon(sc) {
    const box = el('div', 'icon');
    const host = hostname(sc.url);

    const showLetter = () => {
        box.classList.add('icon-letter');
        box.style.background = colorFor(sc.name);
        box.replaceChildren(document.createTextNode((sc.name.trim().charAt(0) || '?').toUpperCase()));
    };

    // Alamat lokal (router, localhost) tidak punya favicon publik → langsung huruf
    if (isPrivateHost(host)) { showLetter(); return box; }

    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.onload = () => { if (img.naturalWidth < MIN_ICON_PX) showLetter(); };
    img.onerror = showLetter;
    img.src = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(sc.url)}&sz=128`;
    box.appendChild(img);
    return box;
}

function createTile(sc) {
    const wrap = el('div', 'shortcut-wrap');
    wrap.dataset.id = sc.id;

    const a = el('a', 'shortcut');
    a.href = sc.url;
    a.title = `${sc.name} — ${hostname(sc.url)}`;
    a.draggable = false;
    a.append(createIcon(sc), el('span', 'sc-name', sc.name), el('span', 'sc-desc', sc.desc || hostname(sc.url)));
    a.addEventListener('click', (e) => {
        if (state.reorder) { e.preventDefault(); return; }
        recordHit(sc.id);
    });
    a.addEventListener('auxclick', (e) => { if (e.button === 1 && !state.reorder) recordHit(sc.id); });

    const actions = el('div', 'tile-actions');
    actions.append(
        iconButton('edit', 'Ubah', () => openShortcutDialog(sc)),
        iconButton('close', 'Hapus', () => deleteShortcut(sc.id), 'danger'),
    );

    wrap.append(a, actions);
    wrap.draggable = state.reorder;

    wrap.addEventListener('dragstart', (e) => {
        if (!state.reorder) return;
        state.dragId = sc.id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', sc.id);
        requestAnimationFrame(() => wrap.classList.add('dragging'));
    });
    wrap.addEventListener('dragend', () => {
        state.dragId = null;
        document.querySelectorAll('.dragging, .drag-over').forEach((n) => n.classList.remove('dragging', 'drag-over'));
    });
    wrap.addEventListener('dragover', (e) => {
        if (!state.reorder || !state.dragId || state.dragId === sc.id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        wrap.classList.add('drag-over');
    });
    wrap.addEventListener('dragleave', () => wrap.classList.remove('drag-over'));
    wrap.addEventListener('drop', (e) => {
        e.preventDefault();
        wrap.classList.remove('drag-over');
        moveShortcut(state.dragId, sc.id);
    });

    return wrap;
}

function createAddTile() {
    const btn = el('button', 'shortcut add-tile');
    btn.type = 'button';
    const icon = el('div', 'icon icon-add');
    icon.appendChild(svg('plus'));
    btn.append(icon, el('span', 'sc-name', 'Tambah Baru'), el('span', 'sc-desc', 'Kustom URL'));
    btn.addEventListener('click', () => openShortcutDialog());
    return btn;
}

function renderShortcuts() {
    const grid = ui.grid;
    grid.textContent = '';
    grid.classList.toggle('reorder', state.reorder);
    ui.btnDelCat.hidden = state.activeCat === 'all';

    const list = visibleShortcuts();
    if (!list.length && state.activeCat !== 'all') {
        grid.appendChild(el('p', 'empty grid-empty', 'Belum ada shortcut di kategori ini. Tambahkan yang pertama dengan tombol di bawah.'));
    }
    list.forEach((sc) => grid.appendChild(createTile(sc)));
    grid.appendChild(createAddTile());
}

/* ---------- Render: to-do ---------- */

function loadTasks() {
    const raw = store.get(KEYS.tasks, []);
    const today = todayKey();
    return (Array.isArray(raw) ? raw : [])
        .filter((t) => t && typeof t.text === 'string' && t.text.trim())
        // Tugas yang selesai di hari sebelumnya dibersihkan otomatis; yang belum selesai ikut terbawa
        .filter((t) => !(t.done && t.doneOn !== today))
        .map((t) => ({ id: t.id || uid(), text: t.text.slice(0, 120), done: !!t.done, priority: !!t.priority, doneOn: t.doneOn || null }));
}

function toggleTask(id, done) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t || t.done === done) return;
    t.done = done;
    t.doneOn = done ? todayKey() : null;
    state.xp = Math.max(0, state.xp + (done ? XP_PER_TASK : -XP_PER_TASK));
    saveTasks();
    renderTasks();
    renderProfile();
}

function renderTasks() {
    const list = ui.taskList;
    list.textContent = '';
    const done = state.tasks.filter((t) => t.done).length;
    ui.taskProgress.textContent = `${done} / ${state.tasks.length} Selesai`;
    ui.xpText.textContent = `Ketenangan fokus +${state.xp}XP`;

    if (!state.tasks.length) {
        list.appendChild(el('li', 'empty', 'Belum ada rencana. Tulis satu target kecil untuk hari ini.'));
        return;
    }

    state.tasks.forEach((t) => {
        const li = el('li', 'task' + (t.done ? ' done' : ''));

        const cb = el('input', 'check');
        cb.type = 'checkbox';
        cb.checked = t.done;
        cb.setAttribute('aria-label', `Tandai selesai: ${t.text}`);
        cb.addEventListener('change', () => toggleTask(t.id, cb.checked));

        li.append(cb, el('span', 'task-text', t.text));

        if (t.done) li.appendChild(el('span', 'tag tag-done', 'Selesai'));
        else if (t.priority) li.appendChild(el('span', 'tag tag-priority', 'Prioritas'));

        const actions = el('div', 'task-actions');
        actions.append(
            iconButton('star', t.priority ? 'Hapus prioritas' : 'Jadikan prioritas', () => {
                t.priority = !t.priority;
                saveTasks();
                renderTasks();
            }, t.priority ? 'on' : ''),
            iconButton('close', 'Hapus target', () => {
                state.tasks = state.tasks.filter((x) => x.id !== t.id);
                saveTasks();
                renderTasks();
                renderProfile();
            }, 'danger'),
        );
        li.appendChild(actions);
        list.appendChild(li);
    });
}

/* ---------- Render: sering dibuka & kerapian tab ---------- */

function trend(cur, prev) {
    if (!prev) return { text: 'Baru', cls: 'up' };
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (pct === 0) return { text: 'Stabil', cls: '' };
    return { text: `${pct > 0 ? '+' : ''}${pct}%`, cls: pct > 0 ? 'up' : 'down' };
}

function renderVisits() {
    const box = ui.visitList;
    box.textContent = '';
    const now = Date.now();
    const W = 7 * DAY;

    const top = state.shortcuts
        .map((sc) => {
            const arr = state.hits[sc.id] || [];
            return {
                sc,
                cur: arr.filter((t) => now - t < W).length,
                prev: arr.filter((t) => now - t >= W && now - t < 2 * W).length,
            };
        })
        .filter((x) => x.cur > 0)
        .sort((a, b) => b.cur - a.cur)
        .slice(0, 3);

    if (!top.length) {
        box.appendChild(el('p', 'empty', 'Belum ada data minggu ini. Buka shortcut dari halaman ini dan statistiknya akan muncul di sini.'));
        return;
    }

    top.forEach(({ sc, cur, prev }) => {
        const a = el('a', 'visit');
        a.href = sc.url;
        a.addEventListener('click', () => recordHit(sc.id));

        const info = el('div', 'visit-info');
        info.append(el('strong', null, hostname(sc.url)), el('span', null, sc.desc || sc.name));

        const tr = trend(cur, prev);
        const stat = el('div', 'visit-stat');
        stat.append(el('strong', null, `${cur}x`), el('small', tr.cls, tr.text));

        a.append(createIcon(sc), info, stat);
        box.appendChild(a);
    });
}

function renderTabMeter() {
    const canQuery = typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query;
    ui.tabMeter.hidden = !canQuery;
    if (!canQuery) return;

    chrome.tabs.query({ currentWindow: true }, (tabs) => {
        const n = (tabs || []).length;
        const pct = clamp(Math.round(100 - ((n - IDEAL_TABS) / (MAX_TABS - IDEAL_TABS)) * 100), 0, 100);
        const mood = pct >= 80 ? 'Optimal' : pct >= 50 ? 'Cukup Rapi' : 'Terlalu Penuh';
        ui.tabLabel.textContent = `Kerapian Tab • ${n} tab terbuka`;
        ui.tabValue.textContent = `${pct}% ${mood}`;
        ui.tabBar.style.width = pct + '%';
    });
}

function renderAll() {
    renderProfile();
    renderCategories();
    renderShortcuts();
    renderTasks();
    renderVisits();
}

/* ---------- Cuaca (Open-Meteo, tanpa API key) ---------- */

function weatherText(code) {
    if (code === 0) return 'Cerah';
    if (code === 1) return 'Cerah Berawan';
    if (code === 2) return 'Berawan Sebagian';
    if (code === 3) return 'Berawan';
    if (code === 45 || code === 48) return 'Berkabut';
    if (code >= 51 && code <= 57) return 'Gerimis';
    if (code >= 61 && code <= 67) return 'Hujan';
    if (code >= 71 && code <= 77) return 'Bersalju';
    if (code >= 80 && code <= 82) return 'Hujan Lebat';
    if (code === 85 || code === 86) return 'Salju Lebat';
    if (code >= 95) return 'Badai Petir';
    return 'Berawan';
}

function showWeather(data) {
    ui.weatherWrap.hidden = !data;
    if (data) ui.weather.textContent = `${data.temp}°C ${weatherText(data.code)}`;
}

async function loadWeather() {
    const { lat, lon, city } = state.settings;
    const cached = store.get(KEYS.weather, null);
    const fresh = cached && cached.city === city && Date.now() - cached.t < 30 * 60 * 1000;
    if (fresh) return showWeather(cached);

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        const data = { t: Date.now(), city, temp: Math.round(j.current.temperature_2m), code: j.current.weather_code };
        store.set(KEYS.weather, data);
        showWeather(data);
    } catch (e) {
        showWeather(cached && cached.city === city ? cached : null);   // offline → pakai cache lama / sembunyikan
    }
}

async function geocode(city) {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=id&format=json`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const r = j.results && j.results[0];
    return r ? { lat: r.latitude, lon: r.longitude, city: r.name } : null;
}

/* ---------- Toast ---------- */

let toastTimer = null;

function hideToast() { ui.toast.classList.remove('show'); }

function toast(message, action) {
    ui.toastMsg.textContent = message;
    if (action) {
        ui.toastAction.hidden = false;
        ui.toastAction.textContent = action.label;
        ui.toastAction.onclick = () => { action.onClick(); hideToast(); };
    } else {
        ui.toastAction.hidden = true;
    }
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 6000 : 3200);
}

/* ---------- Dialog ---------- */

function fillCategorySelect(select, value) {
    select.replaceChildren();
    select.add(new Option('Tanpa kategori', ''));
    state.categories.forEach((c) => select.add(new Option(c, c)));
    select.value = value || '';
}

function openShortcutDialog(sc = null) {
    state.editingId = sc ? sc.id : null;
    $('#dlg-shortcut-title').textContent = sc ? 'Ubah Pintasan' : 'Tambah Pintasan';
    $('#sc-name').value = sc ? sc.name : '';
    $('#sc-url').value = sc ? sc.url : '';
    $('#sc-desc').value = sc ? sc.desc : '';
    fillCategorySelect($('#sc-cat'), sc ? sc.cat : state.activeCat !== 'all' ? state.activeCat : '');
    ui.scError.hidden = true;
    $('#dlg-shortcut').showModal();
    (sc ? $('#sc-name') : $('#sc-url')).focus();
}

function submitShortcut(e) {
    e.preventDefault();
    const url = normalizeUrl($('#sc-url').value);
    if (!url) {
        ui.scError.textContent = 'URL belum valid. Contoh: youtube.com atau https://github.com';
        ui.scError.hidden = false;
        return;
    }
    const name = $('#sc-name').value.trim() || labelFromHost(hostname(url));
    const desc = $('#sc-desc').value.trim();
    const cat = $('#sc-cat').value;

    if (state.editingId) {
        const sc = state.shortcuts.find((s) => s.id === state.editingId);
        if (sc) Object.assign(sc, { name, url, desc, cat });
    } else {
        state.shortcuts.push({ id: uid(), name, url, desc, cat });
    }
    saveShortcuts();
    $('#dlg-shortcut').close();
    renderAll();
}

function submitCategory(e) {
    e.preventDefault();
    const name = $('#cat-name').value.trim();
    const err = $('#category-error');
    if (!name) { err.textContent = 'Nama kategori tidak boleh kosong.'; err.hidden = false; return; }
    if (state.categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
        err.textContent = 'Kategori itu sudah ada.'; err.hidden = false; return;
    }
    state.categories.push(name);
    setActiveCat(name);
    saveCategories();
    $('#dlg-category').close();
    renderAll();
}

function deleteActiveCategory() {
    const c = state.activeCat;
    if (c === 'all') return;
    if (!confirm(`Hapus kategori “${c}”? Shortcut di dalamnya tidak ikut terhapus, hanya menjadi tanpa kategori.`)) return;
    state.categories = state.categories.filter((x) => x !== c);
    state.shortcuts.forEach((s) => { if (s.cat === c) s.cat = ''; });
    setActiveCat('all');
    saveCategories();
    saveShortcuts();
    renderAll();
}

async function submitSettings(e) {
    e.preventDefault();
    const next = {
        ...state.settings,
        userName: $('#set-name').value.trim() || DEFAULT_SETTINGS.userName,
        islandName: $('#set-island').value.trim() || DEFAULT_SETTINGS.islandName,
    };
    const city = $('#set-city').value.trim();
    let note = null;

    if (city && city.toLowerCase() !== state.settings.city.toLowerCase()) {
        try {
            const geo = await geocode(city);
            if (geo) Object.assign(next, geo);
            else note = 'Kota tidak ditemukan, cuaca tetap memakai lokasi sebelumnya.';
        } catch (err) {
            note = 'Tidak bisa mencari kota. Periksa koneksi internetmu.';
        }
    }

    state.settings = next;
    store.set(KEYS.settings, next);
    $('#dlg-settings').close();
    renderHeader();
    renderProfile();
    loadWeather();
    if (note) toast(note);
}

/* ---------- Backup ---------- */

function exportBackup() {
    const data = {
        app: 'cozy-haven-tab',
        version: 1,
        exportedAt: new Date().toISOString(),
        shortcuts: state.shortcuts,
        categories: state.categories,
        tasks: state.tasks,
        notes: ui.notes.value,
        settings: state.settings,
        xp: state.xp,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cozy-tab-backup-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importBackup(file) {
    try {
        const data = JSON.parse(await file.text());
        const list = Array.isArray(data) ? data : data.shortcuts;   // juga menerima format lama (array polos)
        if (!Array.isArray(list)) throw new Error('format');
        if (!confirm(`Impor ${list.length} shortcut? Data shortcut saat ini akan ditimpa.`)) return;

        const cats = new Set(
            (Array.isArray(data.categories) ? data.categories : state.categories)
                .filter((c) => typeof c === 'string' && c.trim())
                .map((c) => c.trim().slice(0, 24)),
        );
        list.forEach((s) => { if (s && typeof s.cat === 'string' && s.cat.trim()) cats.add(s.cat.trim().slice(0, 24)); });
        state.categories = [...cats];
        state.shortcuts = sanitizeShortcuts(list);

        if (!Array.isArray(data)) {
            if (Array.isArray(data.tasks)) {
                store.set(KEYS.tasks, data.tasks);
                state.tasks = loadTasks();
            }
            if (typeof data.notes === 'string') { ui.notes.value = data.notes; store.set(KEYS.notes, data.notes); }
            if (Number.isFinite(data.xp)) state.xp = Math.max(0, data.xp);
            if (data.settings && typeof data.settings === 'object') {
                const s = data.settings;
                state.settings = {
                    ...state.settings,
                    userName: typeof s.userName === 'string' && s.userName.trim() ? s.userName.trim().slice(0, 24) : state.settings.userName,
                    islandName: typeof s.islandName === 'string' && s.islandName.trim() ? s.islandName.trim().slice(0, 28) : state.settings.islandName,
                };
                store.set(KEYS.settings, state.settings);
            }
        }

        setActiveCat('all');
        saveCategories();
        saveShortcuts();
        saveTasks();
        renderHeader();
        renderAll();
        $('#dlg-backup').close();
        toast(`${state.shortcuts.length} shortcut berhasil diimpor`);
    } catch (err) {
        toast('File backup tidak valid.');
    }
}

/* ---------- Tema, pencarian, catatan ---------- */

function toNavigable(q) {
    if (/\s/.test(q)) return null;
    if (/^https?:\/\//i.test(q)) return normalizeUrl(q);
    if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/\S*)?$/i.test(q)) return 'http://' + q;
    if (/^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(q)) return normalizeUrl(q);
    return null;
}

function runSearch(ai = false) {
    const q = ui.searchInput.value.trim();
    if (!ai) {
        if (!q) return;
        const direct = toNavigable(q);
        if (direct) { location.assign(direct); return; }
    }
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (ai) params.set('udm', '50');   // Google AI Mode
    location.assign('https://www.google.com/search?' + params.toString());
}

let notesTimer = null;
function flushNotes() {
    clearTimeout(notesTimer);
    store.set(KEYS.notes, ui.notes.value);
    ui.notesStatus.textContent = 'Tersimpan otomatis lokal';
}

/* ---------- Init ---------- */

function cacheElements() {
    Object.assign(ui, {
        greeting: $('#greeting'), season: $('#season'), date: $('#date'),
        weatherWrap: $('#weather-wrap'), weather: $('#weather'),
        clock: $('#clock'), clockSub: $('#clock-sub'), avatarLetter: $('#avatar-letter'),
        searchInput: $('#search-input'),
        islandName: $('#island-name'), islandRank: $('#island-rank'),
        statSaved: $('#stat-saved'), statDone: $('#stat-done'),
        categoryList: $('#category-list'),
        grid: $('#shortcut-grid'), btnDelCat: $('#btn-del-cat'), btnReorder: $('#btn-reorder'),
        taskList: $('#task-list'), taskProgress: $('#task-progress'), taskInput: $('#task-input'), xpText: $('#xp-text'),
        visitList: $('#visit-list'), tabMeter: $('#tab-meter'), tabLabel: $('#tab-label'), tabValue: $('#tab-value'), tabBar: $('#tab-bar'),
        notes: $('#notes'), notesStatus: $('#notes-status'),
        scError: $('#shortcut-error'),
        toast: $('#toast'), toastMsg: $('#toast-msg'), toastAction: $('#toast-action'),
    });
}

function bindEvents() {
    // Pencarian
    $('#search-form').addEventListener('submit', (e) => { e.preventDefault(); runSearch(false); });
    $('#ai-mode').addEventListener('click', () => runSearch(true));
    ui.searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') ui.searchInput.blur(); });

    // Header & footer
    $('#settings-btn').addEventListener('click', () => {
        $('#set-name').value = state.settings.userName;
        $('#set-island').value = state.settings.islandName;
        $('#set-city').value = state.settings.city;
        $('#dlg-settings').showModal();
    });
    $('#foot-backup').addEventListener('click', () => $('#dlg-backup').showModal());
    $('#foot-keys').addEventListener('click', () => $('#dlg-keys').showModal());

    // Hub shortcut
    $('#btn-add').addEventListener('click', () => openShortcutDialog());
    ui.btnDelCat.addEventListener('click', deleteActiveCategory);
    ui.btnReorder.addEventListener('click', toggleReorder);
    $('#add-category').addEventListener('click', () => {
        $('#cat-name').value = '';
        $('#category-error').hidden = true;
        $('#dlg-category').showModal();
        $('#cat-name').focus();
    });

    // Form dialog
    $('#shortcut-form').addEventListener('submit', submitShortcut);
    $('#category-form').addEventListener('submit', submitCategory);
    $('#settings-form').addEventListener('submit', submitSettings);

    // Tutup dialog: tombol [data-close] atau klik di luar kotak
    document.addEventListener('click', (e) => {
        const closer = e.target.closest && e.target.closest('[data-close]');
        if (closer) closer.closest('dialog').close();
        else if (e.target.tagName === 'DIALOG') e.target.close();
    });

    // Backup
    $('#btn-export').addEventListener('click', exportBackup);
    $('#btn-import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (file) importBackup(file);
    });

    // To-do
    $('#task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const text = ui.taskInput.value.trim();
        if (!text) return;
        state.tasks.push({ id: uid(), text: text.slice(0, 120), done: false, priority: false, doneOn: null });
        ui.taskInput.value = '';
        saveTasks();
        renderTasks();
        renderProfile();
    });
    $('#task-clear').addEventListener('click', () => {
        if (!state.tasks.some((t) => t.done)) return;
        state.tasks = state.tasks.filter((t) => !t.done);
        saveTasks();
        renderTasks();
        renderProfile();
    });

    // Catatan (simpan otomatis setelah berhenti mengetik)
    ui.notes.addEventListener('input', () => {
        ui.notesStatus.textContent = 'Menyimpan…';
        clearTimeout(notesTimer);
        notesTimer = setTimeout(flushNotes, 400);
    });
    window.addEventListener('pagehide', flushNotes);
    $('#notes-clear').addEventListener('click', () => {
        const prev = ui.notes.value;
        if (!prev.trim()) return;
        ui.notes.value = '';
        flushNotes();
        toast('Catatan dihapus', {
            label: 'Urungkan',
            onClick: () => { ui.notes.value = prev; flushNotes(); },
        });
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (document.querySelector('dialog[open]')) return;
        const t = e.target;
        if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
        switch (e.key) {
            case '/': e.preventDefault(); ui.searchInput.focus(); break;
            case 'n': case 'N': e.preventDefault(); openShortcutDialog(); break;
            case 'e': case 'E': toggleReorder(); break;
            case 't': case 'T': toggleMode(); break;
            default:
        }
    });

    // Segarkan info tab saat kembali ke halaman ini
    document.addEventListener('visibilitychange', () => { if (!document.hidden) renderTabMeter(); });
}

function toggleReorder() {
    state.reorder = !state.reorder;
    ui.btnReorder.setAttribute('aria-pressed', String(state.reorder));
    ui.btnReorder.textContent = state.reorder ? 'Selesai Mengurutkan' : 'Urutan Kustom';
    renderShortcuts();
}

function init() {
    cacheElements();
    hydrateIcons();
    initThemes();

    // Muat data
    const savedCats = store.get(KEYS.categories, null);
    state.categories = Array.isArray(savedCats)
        ? savedCats.filter((c) => typeof c === 'string' && c.trim())
        : [...DEFAULT_CATEGORIES];

    const savedActiveCat = store.get(KEYS.activeCat, 'all');
    state.activeCat = savedActiveCat === 'all' || state.categories.includes(savedActiveCat)
        ? savedActiveCat
        : 'all';

    state.tasks = loadTasks();
    state.xp = Math.max(0, Number(store.get(KEYS.xp, 0)) || 0);
    state.hits = store.get(KEYS.hits, {}) || {};

    ui.notes.value = store.get(KEYS.notes, '');
    $('#tip-text').textContent = TIPS[Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / DAY) % TIPS.length];
    try { $('#version').textContent = chrome.runtime.getManifest().version; } catch (e) { /* di luar ekstensi */ }

    bindEvents();
    renderHeader();
    setInterval(tick, 1000);

    initShortcuts(() => {
        saveCategories();
        // Buang data klik milik shortcut yang sudah tidak ada
        const ids = new Set(state.shortcuts.map((s) => s.id));
        Object.keys(state.hits).forEach((k) => { if (!ids.has(k)) delete state.hits[k]; });
        store.set(KEYS.hits, state.hits);
        renderAll();
    });

    renderTabMeter();
    loadWeather();
}

document.addEventListener('DOMContentLoaded', init);
