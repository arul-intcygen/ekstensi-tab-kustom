/* =========================================================
   js/features/themes.js — semua urusan tema.

   Dua konsep yang terpisah:
     • MODE  = terang / gelap   → atribut data-theme di <html>  (tombol bulan/matahari)
     • TEMA  = paket visual     → atribut data-skin  di <html>  (dialog pemilih tema)
   Keduanya bebas dikombinasikan: 2 tema × 2 mode = 4 tampilan.

   Modul ini memegang: pemasangan mode & tema, latar gambar, dialog
   pemilih tema, dan event tombol-tombolnya.
   ========================================================= */

import { KEYS, THEMES, DEFAULT_SKIN } from '../config.js';
import { store } from '../storage.js';
import { $, el, svg } from '../utils.js';

const root = document.documentElement;

/* ---------- Mode (terang / gelap) ---------- */

export function getMode() {
    return root.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function setMode(mode) {
    root.dataset.theme = mode === 'dark' ? 'dark' : 'light';
    store.set(KEYS.theme, root.dataset.theme);
    updateModeButton();
}

export function toggleMode() {
    if (isSingleModeSkin()) return;
    setMode(getMode() === 'dark' ? 'light' : 'dark');
}

function isSingleModeSkin() {
    const theme = THEMES.find((t) => t.id === getSkin());
    return !!(theme && theme.singleMode);
}

function updateModeButton() {
    const btn = $('#theme-btn');
    if (!btn) return;
    if (isSingleModeSkin()) {
        btn.hidden = true;
        return;
    }
    btn.hidden = false;
    const dark = getMode() === 'dark';
    const label = dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap';
    btn.replaceChildren(svg(dark ? 'sun' : 'moon'));
    btn.setAttribute('aria-label', label);
    btn.title = label;
}

/* ---------- Tema (skin) ---------- */

export function getSkin() {
    const id = root.dataset.skin;
    return THEMES.some((t) => t.id === id) ? id : DEFAULT_SKIN;
}

export function setSkin(id) {
    if (!THEMES.some((t) => t.id === id)) return;
    root.dataset.skin = id;
    store.set(KEYS.skin, id);
    applyBackground();
    markActiveTheme();
    updateModeButton();
}

/** Memasang gambar latar milik tema aktif (jika ada). CSS-nya ada di style.css: :root[data-bg] body::before */
function applyBackground() {
    const theme = THEMES.find((t) => t.id === getSkin());

    if (theme && theme.bg) {
        const url = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
            ? chrome.runtime.getURL(theme.bg)
            : theme.bg;   // cadangan jika halaman dibuka di luar ekstensi
        root.style.setProperty('--bg-image', `url("${url}")`);
        root.dataset.bg = 'on';
    } else {
        root.style.removeProperty('--bg-image');
        delete root.dataset.bg;
    }
}

/* ---------- Dialog pemilih tema ---------- */

function renderThemeList() {
    const list = $('#theme-list');
    if (!list) return;
    list.textContent = '';

    THEMES.forEach((theme) => {
        const card = el('button', 'theme-card');
        card.type = 'button';
        card.dataset.skin = theme.id;

        const swatches = el('span', 'theme-swatches');
        theme.swatch.forEach((color) => {
            const dot = el('i');
            dot.style.background = color;
            swatches.appendChild(dot);
        });

        const text = el('span', 'theme-text');
        text.append(el('strong', null, theme.name), el('small', null, theme.desc));

        card.append(swatches, text);
        card.addEventListener('click', () => setSkin(theme.id));   // dialog tetap terbuka: pratinjau langsung
        list.appendChild(card);
    });

    markActiveTheme();
}

function markActiveTheme() {
    const active = getSkin();
    document.querySelectorAll('.theme-card').forEach((card) => {
        const on = card.dataset.skin === active;
        card.classList.toggle('active', on);
        card.setAttribute('aria-pressed', String(on));
    });
}

export function openThemePicker() {
    renderThemeList();
    $('#dlg-themes').showModal();
}

/* ---------- Init ---------- */

/** Panggil sekali dari init() di script.js, setelah DOM siap. */
export function initThemes() {
    // theme-init.js sudah memasang atribut lebih awal; di sini kita validasi (id lama/hilang → default)
    const saved = store.get(KEYS.skin, DEFAULT_SKIN);
    root.dataset.skin = THEMES.some((t) => t.id === saved) ? saved : DEFAULT_SKIN;
    applyBackground();
    updateModeButton();

    const modeBtn = $('#theme-btn');
    if (modeBtn) modeBtn.addEventListener('click', toggleMode);

    const pickerBtn = $('#foot-theme');
    if (pickerBtn) pickerBtn.addEventListener('click', openThemePicker);

    // Kemudahan uji di Console: setSkin('hollow-knight'). Hapus baris ini jika tidak diperlukan.
    window.setSkin = setSkin;
}
