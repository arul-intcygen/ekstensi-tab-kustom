/* =========================================================
   theme-init.js — skrip klasik kecil, dimuat di <head>.

   Tugasnya hanya satu: memasang mode (terang/gelap) dan tema (skin)
   yang tersimpan SEBELUM halaman digambar, agar tidak ada kedip warna.
   Skrip module (script.js) baru berjalan setelah halaman selesai
   di-parse, jadi tidak bisa dipakai untuk keperluan ini.

   Logika lengkapnya ada di js/features/themes.js.
   Nama kunci di bawah HARUS sama dengan KEYS.theme dan KEYS.skin
   di js/config.js.
   ========================================================= */
(() => {
    const root = document.documentElement;

    const read = (key) => {
        try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    };

    root.dataset.theme = read('cozyTheme') === 'dark' ? 'dark' : 'light';

    const skin = read('cozySkin');
    if (typeof skin === 'string' && skin) root.dataset.skin = skin;
})();
