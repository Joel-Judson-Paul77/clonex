// Kept apart from theme.ts (a client module) so the server layout can import the script as a plain string.

export const THEME_KEY = "clonex.theme";
export const CHANGE_EVENT = "clonex-theme-change";

/**
 * Runs inline in <head> before first paint (see layout.tsx): reads the saved choice and sets
 * data-theme-choice (what was picked) and data-theme (light or dark) on <html>, then keeps "system"
 * in step with the OS setting. Plain ES5 on purpose, since it is not compiled.
 */
export const THEME_SCRIPT = `(function(){var d=document.documentElement,c="system";try{var s=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(s==="light"||s==="dark")c=s;}catch(e){}d.setAttribute("data-theme-choice",c);var m=window.matchMedia("(prefers-color-scheme: light)");function a(){var k=d.getAttribute("data-theme-choice");d.setAttribute("data-theme",k==="light"||k==="dark"?k:m.matches?"light":"dark");window.dispatchEvent(new Event(${JSON.stringify(CHANGE_EVENT)}));}a();m.addEventListener("change",a);})();`;
