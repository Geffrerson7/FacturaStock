/**
 * Tema claro u oscuro. El valor vive en `data-theme` del `<html>`, que es lo
 * que leen las variables de `globals.css`, y se recuerda en `localStorage`.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "facturastock-theme";

const THEME_EVENT = "facturastock:theme";

/**
 * Se ejecuta en línea antes del primer pintado (ver `app/layout.tsx`) para que
 * la página no parpadee en claro cuando el usuario prefiere el tema oscuro.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Valor durante el renderizado en el servidor, que no conoce la preferencia. */
export function getServerTheme(): Theme {
  return "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Sin almacenamiento (modo privado): el tema dura lo que dure la página.
  }

  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeToTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);

  return () => window.removeEventListener(THEME_EVENT, onChange);
}
