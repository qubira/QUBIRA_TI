// Conectado a la API centralizada de Qubira (misma base que usan RRHH y
// Soporte). El login y "quién soy" pegan contra /api/auth; todo lo demás
// (proyectos, contratos, documentos, etc.) vive en /api/ti dentro de esa
// misma API, en la base de Neon compartida.
const CENTRAL_API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:4000'
  : 'https://api-qubira.onrender.com';

function resolveUrl(path) {
  if (path.startsWith('/auth')) return CENTRAL_API + '/api' + path;
  return CENTRAL_API + '/api/ti' + path;
}

async function request(method, path, body) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const isFormData = body instanceof FormData;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(resolveUrl(path), opts);

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.hash = '#/login';
    throw new Error('No autorizado');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw Object.assign(new Error(data?.error || 'Error del servidor'), { response: { data } });
  }
  return data;
}

export const api = {
  get(path, params) {
    let url = path;
    if (params) {
      const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
      if (entries.length) url += '?' + new URLSearchParams(entries);
    }
    return request('GET', url);
  },
  post: (path, body) => request('POST', path, body),
  put:  (path, body) => request('PUT',  path, body),
  delete: (path)     => request('DELETE', path),
};
