import { api }      from '../api.js';
import { toast }    from '../utils.js';
import { navigate, normalizeUser } from '../state.js';

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `
  <div class="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden">
          <img src="https://raw.githubusercontent.com/qubira/IMAGENES/main/logo2.png" alt="Qubira" class="w-full h-full object-contain p-1.5">
        </div>
        <h1 class="text-3xl font-bold text-white">Qubira CRM</h1>
        <p class="text-primary-200 mt-1">Sistema de Gestión de Proyectos</p>
      </div>
      <div class="bg-white rounded-2xl shadow-2xl p-8">
        <h2 class="text-xl font-semibold text-gray-800 mb-6">Iniciar Sesión</h2>
        <form id="login-form" class="space-y-5">
          <div>
            <label class="label">Usuario</label>
            <div class="relative">
              <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:18px">person</span>
              <input id="username" type="text" required class="input pl-10" placeholder="usuario">
            </div>
          </div>
          <div>
            <label class="label">Contraseña</label>
            <div class="relative">
              <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:18px">lock</span>
              <input id="password" type="password" required class="input pl-10 pr-10" placeholder="••••••••">
              <button type="button" id="toggle-pwd" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <span class="material-icons" style="font-size:18px" id="eye-icon">visibility</span>
              </button>
            </div>
          </div>
          <button id="submit-btn" type="submit" class="btn-primary w-full justify-center py-2.5 text-base">
            Ingresar
          </button>
        </form>
        <p class="text-center text-xs text-gray-400 mt-6">
          Usa tu cuenta de acceso de Qubira
        </p>
      </div>
    </div>
  </div>`;

  // Toggle password visibility
  document.getElementById('toggle-pwd').addEventListener('click', () => {
    const pwd = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');
    if (pwd.type === 'password') {
      pwd.type = 'text';
      eyeIcon.textContent = 'visibility_off';
    } else {
      pwd.type = 'password';
      eyeIcon.textContent = 'visibility';
    }
  });

  // Login form submit
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Verificando...';
    try {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const data = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user',  JSON.stringify(normalizeUser(data.user)));
      navigate('/');
    } catch (err) {
      toast(err.message || 'Error al iniciar sesión', 'error');
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  });
}
