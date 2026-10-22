// Shared by the server root layout (inline script) and the client ThemeToggle.
export const THEME_STORAGE_KEY = "jr-theme";

/**
 * Runs in <head> before first paint so the saved theme applies without a flash.
 * globals.css: no data-theme = follow the OS; data-theme="light"/"dark" = forced.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}}catch(e){}})();`;
