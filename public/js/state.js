export let currentUser = null;

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
