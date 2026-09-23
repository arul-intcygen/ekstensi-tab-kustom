/* =========================================================
   js/config.js — konstanta bersama.
   Tambahkan tema baru cukup dengan menambah satu objek di THEMES
   (plus satu file di themes/ dan satu <link> di index.html).
   ========================================================= */

// Kunci penyimpanan. 'myShortcuts' sengaja dipertahankan dari versi lama.
export const KEYS = {
    shortcuts: 'myShortcuts',
    categories: 'cozyCategories',
    tasks: 'cozyTasks',
    notes: 'cozyNotes',
    hits: 'cozyHits',
    xp: 'cozyXP',
    theme: 'cozyTheme',      // mode: "light" | "dark"
    skin: 'cozySkin',        // tema: id dari THEMES
    settings: 'cozySettings',
    weather: 'cozyWeather',
    activeCat: 'cozyActiveCat',
};

export const DEFAULT_SKIN = 'cozy';

/**
 * @typedef {Object} Theme
 * @property {string} id            dipakai di atribut data-skin dan nama file themes/<id>.css
 * @property {string} name          nama yang tampil di pemilih tema
 * @property {string} desc          deskripsi singkat
 * @property {string[]} swatch      3 warna contoh untuk pratinjau
 * @property {string|null} bg       path gambar latar default (relatif ke akar ekstensi), atau null
 */

/** @type {Theme[]} */
export const THEMES = [
    {
        id: 'cozy',
        name: 'Cozy Haven',
        desc: 'Hijau hutan & krem hangat',
        swatch: ['#2E4F3E', '#6C836E', '#D4A373'],
        bg: null,
    },
    {
        id: 'hollow-knight',
        name: 'Hollow Knight',
        desc: 'Gua berkabut, teal & cahaya kunang-kunang',
        swatch: ['#398186', '#7468B0', '#D9EC8A'],
        bg: 'assets/hollow-knight/background.webp',
    },
    {
        id: 'moss-grotto',
        name: 'Moss Grotto Rest',
        desc: 'Gua lumut zamrud & sutra Hornet (satu mode)',
        swatch: ['#4ade80', '#a3e635', '#f43f5e'],
        bg: 'assets/moss-grotto/background.webp',
        singleMode: true,   // penanda: tema ini tidak punya gelap/terang
    },
    {
        id: 'minimalist',
        name: 'Minimalist Focus',
        desc: 'Monokrom bersih, tanpa gambar latar — fokus ke shortcut',
        swatch: ['#18181b', '#71717a', '#22c55e'],
        bg: null,
    },
];
