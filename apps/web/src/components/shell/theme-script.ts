export const THEME_STORAGE_KEY = "bc-theme";

/** Runs inline in <head> before first paint so a stored theme never flashes. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})();`;
