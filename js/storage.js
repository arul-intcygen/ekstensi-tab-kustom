/* =========================================================
   js/storage.js — satu-satunya pintu ke penyimpanan.
   Kalau nanti pindah ke chrome.storage.local, cukup ubah file ini.
   ========================================================= */

export const store = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('Gagal menyimpan', key, e);
        }
    },
};
