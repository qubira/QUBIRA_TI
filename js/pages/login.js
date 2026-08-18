import { api }      from '../api.js';
import { toast }    from '../utils.js';
import { navigate, normalizeUser } from '../state.js';

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `
  <style>
    .qlogin-page { min-height: 100%; font-family: 'Inter', 'Segoe UI', sans-serif; background: #f3f4f6; color: #111827;
      display: grid; place-items: center; padding: clamp(12px, 2vw, 22px); }
    .qlogin-shell { width: min(1180px, 100%); min-height: min(700px, calc(100dvh - 44px)); max-height: calc(100dvh - 44px);
      display: grid; grid-template-columns: 1.05fr 0.95fr; border-radius: 28px; overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,.08), 0 4px 6px -4px rgba(0,0,0,.05); border: 1px solid #e5e7eb; }
    .qlogin-brand-side { position: relative; padding: clamp(32px, 5vh, 64px) clamp(24px, 4vw, 52px);
      display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;
      background: radial-gradient(circle at 20% 20%, rgba(129,140,248,0.22), transparent 24%),
        radial-gradient(circle at 80% 75%, rgba(79,70,229,0.28), transparent 30%),
        linear-gradient(160deg, #111827, #1f2937); color: #fff; }
    .qlogin-brand-top { display: flex; align-items: center; gap: 14px; animation: qenterUp .8s ease both; }
    .qlogin-brand-logo { width: 56px; height: 56px; object-fit: contain; border-radius: 14px; background: rgba(255,255,255,0.1); padding: 9px; }
    .qlogin-brand-name { display: flex; flex-direction: column; gap: 4px; }
    .qlogin-brand-name strong { font-size: 20px; letter-spacing: .1em; font-weight: 800; color: #fff; }
    .qlogin-brand-name span { font-size: 11px; letter-spacing: .2em; color: #818cf8; text-transform: uppercase; }
    .qlogin-hero { max-width: 520px; padding: 22px 0 0; }
    .qlogin-eyebrow { display: inline-flex; align-items: center; gap: 10px; padding: 9px 15px;
      border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9);
      border-radius: 999px; font-size: 12.5px; font-weight: 600; margin-bottom: 24px; animation: qenterUp .9s ease .08s both; }
    .qlogin-eyebrow::before { content:''; width:8px; height:8px; border-radius:50%; background: #818cf8; box-shadow: 0 0 0 6px rgba(129,140,248,.18); }
    .qlogin-hero h1 { font-size: clamp(26px, 3vw, 46px); line-height: 1.05; font-weight: 800; letter-spacing: -.02em;
      margin-bottom: 16px; animation: qenterUp .95s ease .16s both; color: #fff; }
    .qlogin-hero p { max-width: 460px; font-size: 15px; line-height: 1.75; color: rgba(255,255,255,0.68); animation: qenterUp 1s ease .24s both; }
    .qlogin-hero-cards { margin-top: 30px; display: flex; gap: 14px; flex-wrap: wrap; animation: qenterUp 1.05s ease .32s both; }
    .qlogin-mini-card { min-width: 170px; flex: 1 1 170px; padding: 16px 16px 14px; border-radius: 16px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); }
    .qlogin-mini-card strong { display: block; font-size: 23px; font-weight: 800; margin-bottom: 6px; color: #fff; }
    .qlogin-mini-card span { font-size: 12.5px; color: rgba(255,255,255,0.65); line-height: 1.5; }
    .qlogin-brand-footer { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap;
      color: rgba(255,255,255,0.5); font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase; animation: qenterUp 1.1s ease .4s both; }
    .qlogin-form-side { position: relative; display: flex; align-items: center; justify-content: center; padding: clamp(24px, 3vw, 44px); background: #fff; }
    .qlogin-form-card { width: min(410px, 100%); animation: qscaleIn .9s ease .18s both; }
    .qlogin-form-mobile-brand { display: none; align-items: center; gap: 12px; margin-bottom: 26px; padding-bottom: 18px; border-bottom: 1px solid #e5e7eb; }
    .qlogin-form-mobile-logo { width: 40px; height: 40px; object-fit: contain; border-radius: 10px; background: #111827; padding: 5px; }
    .qlogin-form-mobile-brand strong { display: block; font-size: .92rem; font-weight: 800; letter-spacing: .1em; color: #4f46e5; }
    .qlogin-form-mobile-brand span { font-size: .65rem; color: #6b7280; text-transform: uppercase; letter-spacing: .1em; }
    .qlogin-form-card h2 { font-size: 32px; line-height: 1; font-weight: 800; margin-bottom: 9px; letter-spacing: -.02em; color: #111827; }
    .qlogin-form-card p { font-size: 13.5px; line-height: 1.7; color: #6b7280; margin-bottom: 24px; }
    .qlogin-field { position: relative; margin-bottom: 15px; }
    .qlogin-field input { width: 100%; height: 54px; border: 1px solid #e5e7eb; outline: none; border-radius: 12px;
      padding: 0 16px 0 48px; background: #f9fafb; color: #111827; font-size: 14.5px; font-weight: 500; transition: .2s ease; font-family: inherit; }
    .qlogin-field input::placeholder { color: #9ca3af; }
    .qlogin-field input:focus { background: #fff; border-color: #4f46e5; box-shadow: 0 0 0 4px #eef2ff; }
    .qlogin-field svg { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; fill: #9ca3af; pointer-events: none; }
    .qlogin-toggle { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); height: 32px; padding: 0 11px;
      border: none; border-radius: 9px; background: #eef2ff; color: #4f46e5; font-size: 11.5px; font-weight: 800;
      letter-spacing: .08em; cursor: pointer; transition: .2s ease; }
    .qlogin-toggle:hover { background: #e0e7ff; }
    .qlogin-actions { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 6px 0 22px; }
    .qlogin-secure-badge { display: inline-flex; align-items: center; gap: 9px; color: #6b7280; font-size: 12.5px; font-weight: 600; }
    .qlogin-secure-badge::before { content:''; width:9px; height:9px; border-radius:50%; background: #059669; box-shadow: 0 0 0 6px rgba(5,150,105,.12); }
    .qlogin-submit { width: 100%; height: 54px; border: none; border-radius: 12px;
      background: linear-gradient(135deg, #4f46e5, #818cf8); color: #fff; font-size: 14.5px; font-weight: 800;
      letter-spacing: .1em; text-transform: uppercase; cursor: pointer; box-shadow: 0 16px 28px rgba(79,70,229,0.28);
      transition: .25s ease; font-family: inherit; }
    .qlogin-submit:hover { transform: translateY(-2px); box-shadow: 0 20px 34px rgba(79,70,229,0.34); }
    .qlogin-submit:active { transform: translateY(0); }
    .qlogin-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }
    .qlogin-foot-note { margin-top: 16px; color: #6b7280; font-size: 11.5px; line-height: 1.7; text-align: center; }
    @keyframes qenterUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
    @keyframes qscaleIn { from{opacity:0;transform:scale(.96) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @media (max-width: 1040px) {
      .qlogin-shell { grid-template-columns: 1fr; }
      .qlogin-brand-side { padding: 40px 24px 26px; }
      .qlogin-hero { max-width: none; }
      .qlogin-form-side { padding: 22px 16px 30px; }
    }
    @media (max-width: 640px) {
      .qlogin-page { padding: 0; align-items: stretch; }
      .qlogin-shell { grid-template-columns: 1fr; max-height: none; min-height: 100dvh; height: auto; border-radius: 0; overflow: auto; }
      .qlogin-brand-side { display: none; }
      .qlogin-form-side { min-height: 100dvh; padding: 46px 22px 36px; display: flex; align-items: center; justify-content: center; }
      .qlogin-form-card { width: 100%; max-width: 420px; }
      .qlogin-form-card h2 { font-size: 1.7rem; }
      .qlogin-actions { flex-direction: column; align-items: flex-start; }
      .qlogin-form-mobile-brand { display: flex; }
    }
  </style>
  <div class="qlogin-page">
    <main class="qlogin-shell">
      <section class="qlogin-brand-side">
        <div>
          <div class="qlogin-brand-top">
            <img class="qlogin-brand-logo" src="https://raw.githubusercontent.com/qubira/IMAGENES/main/logo2.png" alt="QUBIRA logo">
            <div class="qlogin-brand-name">
              <strong>QUBIRA</strong>
              <span>Tecnología</span>
            </div>
          </div>

          <div class="qlogin-hero">
            <div class="qlogin-eyebrow">Acceso de personal de TI</div>
            <h1>Panel de gestión de proyectos técnicos.</h1>
            <p>
              Inicia sesión con tu cuenta corporativa de Qubira para reclamar
              proyectos, cargar avances y dar seguimiento a lo que te toca construir.
            </p>

            <div class="qlogin-hero-cards">
              <div class="qlogin-mini-card">
                <strong>Proyectos</strong>
                <span>Reclama y da seguimiento a los proyectos que te asignan.</span>
              </div>
              <div class="qlogin-mini-card">
                <strong>Seguro</strong>
                <span>Acceso protegido por sesión con tu cuenta corporativa.</span>
              </div>
            </div>
          </div>
        </div>

        <div class="qlogin-brand-footer">
          <span>Plataforma interna</span>
          <span>Qubira Systems</span>
          <span>TI Access</span>
        </div>
      </section>

      <section class="qlogin-form-side">
        <div class="qlogin-form-card">
          <div class="qlogin-form-mobile-brand">
            <img src="https://raw.githubusercontent.com/qubira/IMAGENES/main/logo2.png" alt="QUBIRA" class="qlogin-form-mobile-logo">
            <div>
              <strong>QUBIRA</strong>
              <span>Tecnología</span>
            </div>
          </div>

          <h2>Ingresar</h2>
          <p>Accede con tu cuenta corporativa para continuar.</p>

          <form id="login-form" novalidate autocomplete="off">
            <div class="qlogin-field">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-3.87 0-7 2.24-7 5v1h14v-1c0-2.76-3.13-5-7-5Z"/>
              </svg>
              <input type="text" id="username" placeholder="Usuario corporativo" autocomplete="off">
            </div>

            <div class="qlogin-field">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17 8h-1V6a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-6 8.73V18h2v-1.27a2 2 0 1 0-2 0ZM10 8V6a2 2 0 1 1 4 0v2h-4Z"/>
              </svg>
              <input type="password" id="password" placeholder="Contraseña" autocomplete="new-password">
              <button type="button" class="qlogin-toggle" id="toggle-pwd">VER</button>
            </div>

            <div class="qlogin-actions">
              <div class="qlogin-secure-badge">Sesión protegida</div>
            </div>

            <button class="qlogin-submit" type="submit" id="submit-btn">Ingresar</button>
          </form>

          <div class="qlogin-foot-note">
            Acceso exclusivo para personal autorizado de Qubira.
          </div>
        </div>
      </section>
    </main>
  </div>`;

  document.getElementById('toggle-pwd').addEventListener('click', () => {
    const pwd = document.getElementById('password');
    const toggle = document.getElementById('toggle-pwd');
    const hidden = pwd.type === 'password';
    pwd.type = hidden ? 'text' : 'password';
    toggle.textContent = hidden ? 'OCULTAR' : 'VER';
  });

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
