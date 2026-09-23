
(() => {
    const root = document.documentElement;

    const read = (key) => {
        try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    };

    root.dataset.theme = read('cozyTheme') === 'dark' ? 'dark' : 'light';

    const skin = read('cozySkin');
    if (typeof skin === 'string' && skin) root.dataset.skin = skin;

    // Sembunyikan halaman dulu — dilepas oleh script.js setelah data asli siap
    root.dataset.boot = 'pending';
})();