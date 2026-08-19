export let currentUser = null;

// La cuenta viene de la API central de Qubira (RRHH/Soporte), con otra
// forma ({nombre, apellidos, rol, nivel_acceso}). Se normaliza acá a la
// forma que ya usa el resto de la app ({name, role}) para no tener que
// tocar cada pantalla.
export function normalizeUser(central) {
  return {
    id: central.id,
    name: `${central.nombre || ''} ${central.apellidos || ''}`.trim() || central.username,
    username: central.username,
    role: central.nivel_acceso >= 80 ? 'admin' : 'manager',
    avatar: null,
    rol: central.rol,
    nivel_acceso: central.nivel_acceso,
    cargo: central.cargo || null,
  };
}

export function setUser(user) {
  currentUser = user;
}

export function getUser() {
  if (currentUser) return currentUser;
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

export function navigate(path) {
  location.hash = '#' + path;
}

// Evita que una carga lenta (que resuelve DESPUÉS de que el usuario ya
// navegó a otra pantalla) pise el contenido de la pantalla nueva. Cada
// render() lee `pageToken` al empezar y lo vuelve a comparar cuando su
// fetch termina; si ya cambió, no toca el DOM.
export let pageToken = 0;
export function bumpPageToken() {
  return ++pageToken;
}
