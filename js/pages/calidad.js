import { api } from '../api.js';
import { getUser, navigate } from '../state.js';
import {
  toast, showModal, closeModal, confirmModal, pageHeader,
  spinner, icon, fmtDate
} from '../utils.js';

// ─── Constantes y metadatos por tipo de acta ──────────────────────────────────
export const TIPOS_CONFIG = {
  seguridad: {
    tipo: 'seguridad',
    sigla: 'SEC',
    titulo: 'ACTA DE AUDITORÍA DE SEGURIDAD',
    subtitulo: 'Seguridad de aplicaciones · Revisión de código y pruebas sobre entorno',
    badgeCls: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    iconName: 'security',
    label: 'Seguridad',
    descripcion: 'Análisis de vulnerabilidades, control de acceso, OWASP, cifrado y secretos',
    metodologiaDef: 'Revisión estática de código (SAST) · Pruebas dinámicas controladas (DAST) · Análisis de dependencias (SCA) · Inspección de historial de Git',
    alcanceDef: 'Autenticación, autorización, validación de datos, APIs REST, base de datos y repositorios de código',
  },
  calidad: {
    tipo: 'calidad',
    sigla: 'CAL',
    titulo: 'ACTA DE AUDITORÍA DE CALIDAD DE SOFTWARE',
    subtitulo: 'Calidad de software · Arquitectura, código limpio, rendimiento y pruebas',
    badgeCls: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    iconName: 'verified',
    label: 'Calidad de Software',
    descripcion: 'Arquitectura modular, principios SOLID/DRY, cobertura de pruebas y rendimiento',
    metodologiaDef: 'Análisis de código estático (Linter) · Medición de complejidad ciclomática · Pruebas de carga y Core Web Vitals · Cobertura de pruebas unitarias/E2E',
    alcanceDef: 'Estructura del proyecto, estándares de codificación, suite de pruebas, tiempos de respuesta y manejo de excepciones',
  },
  reglas: {
    tipo: 'reglas',
    sigla: 'RN',
    titulo: 'ACTA DE AUDITORÍA DE REGLAS DE NEGOCIO',
    subtitulo: 'Lógica de negocio · Flujos transaccionales, coherencia de datos y políticas operativas',
    badgeCls: 'bg-purple-100 text-purple-800 border border-purple-200',
    iconName: 'gavel',
    label: 'Reglas de Negocio',
    descripcion: 'Lógica transaccional, cálculos de precios/impuestos, stock y segregación de funciones SoD',
    metodologiaDef: 'Verificación de flujos transaccionales · Pruebas de casos borde y concurrencia · Validación de políticas comerciales · Inspección de trazabilidad contable',
    alcanceDef: 'Cálculo de tarifas e impuestos, políticas de cupones, reserva y control de stock, matriz de aprobación y no borrado físico de transacciones',
  },
};

const ESTADOS_CONFIG = {
  borrador:    { label: 'Borrador',    cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  en_revision: { label: 'En revisión', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  emitida:     { label: 'Emitida',     cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  cerrada:     { label: 'Cerrada',     cls: 'bg-green-100 text-green-800 border-green-200' },
};

const SEVERIDAD_CONFIG = {
  critico: { label: 'CRÍTICO', bg: '#C0392B', text: '#FFFFFF', plazo: 'Mismo día', criterio: 'Explotable hoy en producción; compromete cuentas administrativas, pagos o datos de clientes.' },
  alto:    { label: 'ALTO',    bg: '#E67E22', text: '#FFFFFF', plazo: '7 días',    criterio: 'Explotable con un dato que un atacante puede obtener (identificador, enlace compartido).' },
  medio:   { label: 'MEDIO',   bg: '#F1C40F', text: '#1F2937', plazo: 'Próximo sprint', criterio: 'Debilidad que facilita otro ataque o expone información interna.' },
  bajo:    { label: 'BAJO',    bg: '#27AE60', text: '#FFFFFF', plazo: 'Backlog',   criterio: 'Buena práctica pendiente o código frágil, no explotable actualmente.' },
};

// ─── Controles por defecto según la plantilla MODELO_DOC/AUDITORIA ───────────
const DEFAULT_CONTROLES = {
  seguridad: [
    {
      dominio: 'Autenticación y sesiones',
      items: [
        { control: 'Contraseñas de cuentas administrativas robustas y únicas (min. 12 caracteres)', cumple: 'si', ref: 'SEC-01' },
        { control: 'Doble factor (2FA/MFA) implementado en cuentas con privilegios administrativos', cumple: 'no', ref: 'SEC-02' },
        { control: 'Bloqueo o retraso tras múltiples intentos fallidos de inicio de sesión', cumple: 'si', ref: 'SEC-03' },
        { control: 'Mensajes de inicio de sesión genéricos (sin enumeración de cuentas de usuario)', cumple: 'si', ref: 'SEC-04' },
        { control: 'Revocación inmediata de sesiones activas al cambiar o resetear contraseña', cumple: 'si', ref: 'SEC-05' },
      ],
    },
    {
      dominio: 'Autorización y control de acceso',
      items: [
        { control: 'Endpoints con datos privados exigen token JWT válido con verificación de firma', cumple: 'si', ref: 'SEC-06' },
        { control: 'Verificación de propietario del recurso en cada consulta (sin vulnerabilidad IDOR)', cumple: 'si', ref: 'SEC-07' },
        { control: 'Ningún recurso sensible protegido únicamente por un identificador predecible en la URL', cumple: 'si', ref: 'SEC-08' },
      ],
    },
    {
      dominio: 'API y seguridad de red',
      items: [
        { control: 'CORS restringido estrictamente al dominio oficial; falla cerrado si falta la variable', cumple: 'si', ref: 'SEC-09' },
        { control: 'Limitación de peticiones (Rate Limiting) global y en rutas críticas (login, pagos)', cumple: 'si', ref: 'SEC-10' },
        { control: 'Errores sanitizados sin mensajes internos, rutas del servidor ni trazas al cliente', cumple: 'si', ref: 'SEC-11' },
        { control: 'Certificados TLS (HTTPS) y conexiones cifradas hacia base de datos y servicios externos', cumple: 'si', ref: 'SEC-12' },
      ],
    },
    {
      dominio: 'Datos y validación',
      items: [
        { control: 'Consultas parametrizadas u ORM en todas las operaciones (sin inyección SQL)', cumple: 'si', ref: 'SEC-13' },
        { control: 'Montos, precios, IDs y stock validados en el servidor (rangos válidos, no negativos)', cumple: 'si', ref: 'SEC-14' },
        { control: 'Subida de archivos validada en servidor (tipo MIME real, peso y storage aislado)', cumple: 'si', ref: 'SEC-15' },
      ],
    },
    {
      dominio: 'Dependencias y gestión de secretos',
      items: [
        { control: 'Análisis de dependencias libre de vulnerabilidades críticas o altas (npm audit)', cumple: 'si', ref: 'SEC-16' },
        { control: 'Sin secretos, credenciales ni API keys en el código fuente ni en el historial de Git', cumple: 'si', ref: 'SEC-17' },
        { control: 'Archivos .env estrictamente excluidos del repositorio mediante .gitignore', cumple: 'si', ref: 'SEC-18' },
        { control: 'Registros (logs) libres de cuerpos de petición con contraseñas, tokens o datos sensibles', cumple: 'si', ref: 'SEC-19' },
      ],
    },
  ],

  calidad: [
    {
      dominio: 'Arquitectura y Código Limpio',
      items: [
        { control: 'Separación modular limpia de capas (rutas, controladores, servicios y acceso a datos)', cumple: 'si', ref: 'CAL-01' },
        { control: 'Cumplimiento de estándares de nomenclatura, principios SOLID y DRY en todo el código', cumple: 'si', ref: 'CAL-02' },
        { control: 'Tipado estricto o validación de contratos de entrada con esquemas (Zod, Joi o TS)', cumple: 'si', ref: 'CAL-03' },
        { control: 'Ausencia de código muerto, funciones sobredimensionadas (>60 líneas) o dependencias sin uso', cumple: 'si', ref: 'CAL-04' },
      ],
    },
    {
      dominio: 'Rendimiento y Optimización',
      items: [
        { control: 'Tiempos de respuesta de endpoints API bajo 300ms en condiciones normales de tráfico', cumple: 'si', ref: 'CAL-05' },
        { control: 'Optimización de base de datos: índices en claves foráneas y eliminación de consultas N+1', cumple: 'si', ref: 'CAL-06' },
        { control: 'Optimización frontend: compresión de respuestas (gzip), lazy loading y bundle splitting', cumple: 'si', ref: 'CAL-07' },
        { control: 'Estrategias de caché en consultas pesadas o repetitivas para reducir carga en base de datos', cumple: 'si', ref: 'CAL-08' },
      ],
    },
    {
      dominio: 'Pruebas y Cobertura',
      items: [
        { control: 'Suite de pruebas unitarias implementada para funciones de cálculo y lógica central', cumple: 'si', ref: 'CAL-09' },
        { control: 'Pruebas de integración automatizadas para flujos críticos de API y persistencia en DB', cumple: 'si', ref: 'CAL-10' },
        { control: 'Pipeline de CI/CD que corre pruebas automáticas y linters antes de autorizar el merge', cumple: 'no', ref: 'CAL-11' },
      ],
    },
    {
      dominio: 'Manejo de Errores y Resiliencia',
      items: [
        { control: 'Captura y manejo estructurado de excepciones con códigos de estado HTTP semánticos', cumple: 'si', ref: 'CAL-12' },
        { control: 'Mecanismos de reintento con backoff exponencial para llamadas a servicios de terceros', cumple: 'si', ref: 'CAL-13' },
        { control: 'Logging estructurado centralizado con niveles de severidad (INFO, WARN, ERROR)', cumple: 'si', ref: 'CAL-14' },
      ],
    },
    {
      dominio: 'Experiencia de Usuario y Accesibilidad',
      items: [
        { control: 'Interfaz completamente responsiva y funcional en pantallas móviles, tablets y desktop', cumple: 'si', ref: 'CAL-15' },
        { control: 'Estados visuales interactivos completos (loading spinners, estados vacíos, alertas de error)', cumple: 'si', ref: 'CAL-16' },
        { control: 'Navegación accesible con teclado y contrastes cromáticos legibles según pautas WCAG', cumple: 'si', ref: 'CAL-17' },
      ],
    },
  ],

  reglas: [
    {
      dominio: 'Flujos Transaccionales y Pagos',
      items: [
        { control: 'Garantía de idempotencia en pasarelas de pago para prevenir cobros dobles ante reintentos', cumple: 'si', ref: 'RN-01' },
        { control: 'Conciliación y confirmación de pagos vía Webhook seguro con verificación de firma', cumple: 'si', ref: 'RN-02' },
        { control: 'Manejo atómico de transacciones (ACID / Rollback) ante fallos a mitad de un proceso de compra', cumple: 'si', ref: 'RN-03' },
        { control: 'Estados de ciclo de vida del pedido/transacción claramente definidos y no salteables', cumple: 'si', ref: 'RN-04' },
      ],
    },
    {
      dominio: 'Políticas de Precios e Impuestos',
      items: [
        { control: 'Cálculo exacto de impuestos oficiales (IGV 18%) y redondeo bancario a dos decimales', cumple: 'si', ref: 'RN-05' },
        { control: 'Validación estricta de cupones: vigencia, límite de usos por usuario y no acumulación ilícita', cumple: 'si', ref: 'RN-06' },
        { control: 'Bloqueo absoluto de montos totales negativos o descuentos que superen el valor máximo', cumple: 'si', ref: 'RN-07' },
      ],
    },
    {
      dominio: 'Gestión de Stock e Inventarios',
      items: [
        { control: 'Control de concurrencia y bloqueo de stock para compras simultáneas del último ítem', cumple: 'si', ref: 'RN-08' },
        { control: 'Reserva temporal de inventario con expiración automática si la pasarela de pago caduca', cumple: 'si', ref: 'RN-09' },
        { control: 'Bloqueo de stock negativo en el servidor salvo autorización explícita de pedido preventa', cumple: 'si', ref: 'RN-10' },
      ],
    },
    {
      dominio: 'Roles y Segregación de Funciones (SoD)',
      items: [
        { control: 'Segregación de funciones: el creador de una orden/factura no puede autorizar su propio desembolso', cumple: 'si', ref: 'RN-11' },
        { control: 'Matriz de aprobación escalonada según montos transaccionales o límites comerciales', cumple: 'si', ref: 'RN-12' },
        { control: 'Registro de auditoría obligatorio ante anulaciones, notas de crédito o descuentos especiales', cumple: 'si', ref: 'RN-13' },
      ],
    },
    {
      dominio: 'Integridad y Trazabilidad de Datos',
      items: [
        { control: 'Prohibición de eliminación física (soft delete) en comprobantes, transacciones y contratos', cumple: 'si', ref: 'RN-14' },
        { control: 'Inmutabilidad de documentos y constancias emitidas legalmente hacia clientes', cumple: 'si', ref: 'RN-15' },
        { control: 'Trazabilidad completa de autorías: registro de usuario, timestamp y detalle del cambio', cumple: 'si', ref: 'RN-16' },
      ],
    },
  ],
};

const DEFAULT_TOOLS = {
  seguridad: [
    { herramienta: 'Doble factor (2FA / Authenticator TOTP)', prioridad: 'Alta', justificacion: 'Protección mandataria de cuentas con acceso administrativo y privilegios de despliegue.' },
    { herramienta: 'Gitleaks / TruffleHog (Hook de pre-commit)', prioridad: 'Alta', justificacion: 'Bloqueo automático del commit si detecta secretos o claves API en el código fuente.' },
    { herramienta: 'Doppler / Infisical / OpenBao', prioridad: 'Media', justificacion: 'Gestión centralizada de variables de entorno y rotación periódica de credenciales.' },
    { herramienta: 'OWASP ZAP / Burp Suite', prioridad: 'Media', justificacion: 'Ejecución de escaneos dinámicos periódicos sobre endpoints en entorno de Staging.' },
  ],
  calidad: [
    { herramienta: 'ESLint / Prettier / SonarQube', prioridad: 'Alta', justificacion: 'Estandarización de estilo y detección temprana de deuda técnica y bugs en código.' },
    { herramienta: 'Playwright / Vitest / Jest', prioridad: 'Alta', justificacion: 'Automatización de suite de pruebas unitarias y de integración en el pipeline de desarrollo.' },
    { herramienta: 'Lighthouse CI / Web Vitals', prioridad: 'Media', justificacion: 'Monitoreo continuo de tiempos de renderizado, accesibilidad y rendimiento web.' },
    { herramienta: 'Sentry / Datadog', prioridad: 'Media', justificacion: 'Monitoreo de excepciones en tiempo real y alertas ante fallos de backend o frontend.' },
  ],
  reglas: [
    { herramienta: 'Webhook Simulator / Mock Server', prioridad: 'Alta', justificacion: 'Validación de flujos de pago asíncronos y escenarios de desconexión o doble llamada.' },
    { herramienta: 'Database Transaction Log / CDC (Debezium)', prioridad: 'Media', justificacion: 'Auditoría inmutable de cambios en tablas críticas de pedidos, saldos y precios.' },
    { herramienta: 'Workflow Engine / Temporal / Camunda', prioridad: 'Baja', justificacion: 'Orquestación de procesos de negocio de larga duración y compensación ante errores.' },
  ],
};

// ─── Estilos dinámicos para resaltado de plantilla en modo edición ───────────
const ESTILOS_LUZ_AMARILLA = `
<style id="estilos-calidad-luz-amarilla">
  @keyframes pulsoLuzAmarilla {
    0%, 100% {
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.5), 0 0 14px rgba(251, 191, 36, 0.4);
    }
    50% {
      box-shadow: 0 0 0 4.5px rgba(245, 158, 11, 0.8), 0 0 22px rgba(251, 191, 36, 0.65);
    }
  }
  .campo-plantilla-luz-amarilla {
    background-color: #FEF9C3 !important; /* amarillo cálido */
    border-color: #F59E0B !important; /* borde ámbar/dorado */
    color: #78350F !important;
    animation: pulsoLuzAmarilla 2.5s infinite ease-in-out;
    position: relative;
    transition: all 0.3s ease;
  }
  .tarjeta-plantilla-luz-amarilla {
    background-color: #FEFCE8 !important; /* fondo ámbar tenue */
    border: 1.5px solid #F59E0B !important;
    animation: pulsoLuzAmarilla 3s infinite ease-in-out;
  }
</style>
`;

function asegurarEstilosLuzAmarilla() {
  if (!document.getElementById('estilos-calidad-luz-amarilla')) {
    document.head.insertAdjacentHTML('beforeend', ESTILOS_LUZ_AMARILLA);
  }
}

// ─── Estado local del módulo ──────────────────────────────────────────────────
let _actas = [];
let _projects = [];
let _filters = { tipo: '', estado: '', project_id: '', q: '' };
let _currentActa = null;
let _mode = 'list'; // 'list' | 'view' | 'edit'

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Sincronización en vivo con la Base de Datos ─────────────────────────────
async function recargarActas() {
  try {
    const actasRes = await api.get('/calidad/actas');
    _actas = Array.isArray(actasRes) ? actasRes : [];
    return _actas;
  } catch (err) {
    console.error('Error al sincronizar actas:', err);
    return _actas;
  }
}

// ─── Render principal ─────────────────────────────────────────────────────────
export async function render(params = {}) {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="calidad-container">${spinner()}</div>`;

  try {
    const [actasRes, projectsRes] = await Promise.all([
      recargarActas(),
      api.get('/projects').catch(() => []),
    ]);
    _projects = Array.isArray(projectsRes) ? projectsRes : [];

    if (params.id) {
      const encontrada = _actas.find(a => a.id === params.id);
      if (encontrada) {
        await verActa(params.id);
        return;
      }
    }

    _mode = 'list';
    renderBandeja();
  } catch (err) {
    const c = document.getElementById('calidad-container');
    if (c) {
      c.innerHTML = `
        <div class="card p-8 text-center text-red-500">
          <p class="font-semibold text-lg mb-2">Error al cargar las actas de calidad</p>
          <p class="text-sm text-gray-500 mb-4">${esc(err.message || 'Error de conexión con la API')}</p>
          <button id="retry-btn" class="btn-primary inline-flex items-center gap-2">
            ${icon('refresh', 18)} Reintentar
          </button>
        </div>`;
      document.getElementById('retry-btn')?.addEventListener('click', () => render());
    }
  }
}

// ─── BANDEJA DE ACTAS (List View) ─────────────────────────────────────────────
function renderBandeja() {
  const c = document.getElementById('calidad-container');
  if (!c) return;

  // Filtrado de actas
  const filtradas = _actas.filter(a => {
    if (_filters.tipo && a.tipo !== _filters.tipo) return false;
    if (_filters.estado && a.estado !== _filters.estado) return false;
    if (_filters.project_id && a.project_id !== _filters.project_id) return false;
    if (_filters.q) {
      const q = _filters.q.toLowerCase();
      const code = (a.codigo || '').toLowerCase();
      const proj = (a.project_name || '').toLowerCase();
      const aud = (a.auditor || '').toLowerCase();
      if (!code.includes(q) && !proj.includes(q) && !aud.includes(q)) return false;
    }
    return true;
  });

  // Métricas agregadas
  let totalCriticos = 0, totalAltos = 0, totalMedios = 0, totalVencidos = 0;
  _actas.forEach(a => {
    const r = a.resumen || {};
    totalCriticos += r.abiertos?.critico || 0;
    totalAltos += r.abiertos?.alto || 0;
    totalMedios += r.abiertos?.medio || 0;
    totalVencidos += r.vencidos || 0;
  });

  const projOpts = _projects.map(p => `
    <option value="${p.id}" ${_filters.project_id === p.id ? 'selected' : ''}>
      ${esc(p.name)} (${esc(p.code || 'S/C')})
    </option>`).join('');

  c.innerHTML = `
    <!-- Encabezado de página -->
    ${pageHeader(
      'Calidad & Auditorías',
      'Actas oficiales de revisión de Seguridad, Calidad de Software y Reglas de Negocio',
      `<button id="btn-nueva-acta" class="btn-primary inline-flex items-center gap-2 shadow-sm">
        ${icon('add_circle', 20)} Nueva Acta de Auditoría
      </button>`
    )}

    <!-- Tarjetas de métricas tipo KPI -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mb-6">
      <div class="card p-4 bg-white border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Actas</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">${_actas.length}</p>
        </div>
        <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          ${icon('assignment', 22)}
        </div>
      </div>

      <div class="card p-4 bg-white border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-red-600 uppercase tracking-wide">Críticos Abiertos</p>
          <p class="text-2xl font-bold text-red-700 mt-1">${totalCriticos}</p>
        </div>
        <div class="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
          ${icon('error', 22)}
        </div>
      </div>

      <div class="card p-4 bg-white border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-amber-600 uppercase tracking-wide">Altos Abiertos</p>
          <p class="text-2xl font-bold text-amber-700 mt-1">${totalAltos}</p>
        </div>
        <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
          ${icon('warning', 22)}
        </div>
      </div>

      <div class="card p-4 bg-white border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-yellow-600 uppercase tracking-wide">Medios Abiertos</p>
          <p class="text-2xl font-bold text-yellow-700 mt-1">${totalMedios}</p>
        </div>
        <div class="w-10 h-10 rounded-xl bg-yellow-50 text-yellow-700 flex items-center justify-center">
          ${icon('info', 22)}
        </div>
      </div>

      <div class="card p-4 bg-white border border-gray-100 shadow-sm flex items-center justify-between col-span-2 sm:col-span-1">
        <div>
          <p class="text-xs font-semibold text-purple-600 uppercase tracking-wide">Vencidos</p>
          <p class="text-2xl font-bold ${totalVencidos > 0 ? 'text-red-600' : 'text-gray-900'} mt-1">${totalVencidos}</p>
        </div>
        <div class="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
          ${icon('alarm_on', 22)}
        </div>
      </div>
    </div>

    <!-- Barra de Filtros -->
    <div class="card p-3.5 mb-5 bg-white border border-gray-200/80 shadow-sm flex flex-wrap items-center gap-3">
      <div class="flex-1 min-w-[220px]">
        <input id="f-q" type="text" class="input w-full text-sm" placeholder="Buscar por código, proyecto o auditor..." value="${esc(_filters.q)}">
      </div>

      <select id="f-tipo" class="input w-auto text-sm">
        <option value="">Todos los tipos</option>
        <option value="seguridad" ${_filters.tipo === 'seguridad' ? 'selected' : ''}>🛡️ Seguridad (SEC)</option>
        <option value="calidad" ${_filters.tipo === 'calidad' ? 'selected' : ''}>✅ Calidad de Software (CAL)</option>
        <option value="reglas" ${_filters.tipo === 'reglas' ? 'selected' : ''}>⚖️ Reglas de Negocio (RN)</option>
      </select>

      <select id="f-project" class="input w-auto text-sm max-w-[240px]">
        <option value="">Todos los proyectos</option>
        ${projOpts}
      </select>

      <select id="f-estado" class="input w-auto text-sm">
        <option value="">Todos los estados</option>
        <option value="borrador" ${_filters.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
        <option value="en_revision" ${_filters.estado === 'en_revision' ? 'selected' : ''}>En revisión</option>
        <option value="emitida" ${_filters.estado === 'emitida' ? 'selected' : ''}>Emitida</option>
        <option value="cerrada" ${_filters.estado === 'cerrada' ? 'selected' : ''}>Cerrada</option>
      </select>

      ${(_filters.tipo || _filters.estado || _filters.project_id || _filters.q) ? `
        <button id="btn-limpiar-filtros" class="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1 text-gray-500 hover:text-gray-800">
          ${icon('clear', 16)} Limpiar
        </button>` : ''}

      <button id="btn-refrescar-bandeja" class="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5 text-gray-700 hover:text-primary-700 hover:border-primary-300 ml-auto transition-all shadow-sm" title="Sincronizar lista con la base de datos">
        ${icon('refresh', 16)} Actualizar
      </button>
    </div>

    <!-- Tabla de Actas -->
    <div class="card overflow-hidden bg-white border border-gray-200 shadow-sm rounded-xl">
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-gray-50/90 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th class="px-4 py-3">Código</th>
              <th class="px-4 py-3">Tipo</th>
              <th class="px-4 py-3">Proyecto / Cliente</th>
              <th class="px-4 py-3 text-center">Versión</th>
              <th class="px-4 py-3">Fecha Emisión</th>
              <th class="px-4 py-3">Auditor</th>
              <th class="px-4 py-3 text-center">Hallazgos</th>
              <th class="px-4 py-3 text-center">Estado</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${filtradas.length === 0 ? `
              <tr>
                <td colspan="9" class="px-6 py-12 text-center text-gray-400">
                  <div class="flex flex-col items-center justify-center gap-2">
                    <span class="material-icons text-4xl text-gray-300">fact_check</span>
                    <p class="font-medium text-gray-600">No se encontraron actas de calidad</p>
                    <p class="text-xs text-gray-400">Crea una nueva acta usando el botón superior o ajusta los filtros.</p>
                  </div>
                </td>
              </tr>` : filtradas.map(a => renderFilaActa(a)).join('')}
          </tbody>
        </table>
      </div>
      <div class="px-4 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500 flex flex-wrap justify-between items-center gap-2">
        <div class="flex items-center gap-2.5">
          <span>Mostrando <b>${filtradas.length}</b> de <b>${_actas.length}</b> actas</span>
          <span class="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Base de Datos: Neon PostgreSQL (ti.auditorias_calidad)
          </span>
        </div>
        <span class="text-gray-400">Modelo oficial: MODELO_DOC/AUDITORIA</span>
      </div>
    </div>
  `;

  // Listeners de la bandeja
  document.getElementById('btn-nueva-acta')?.addEventListener('click', () => abrirModalNuevaActa());

  document.getElementById('btn-refrescar-bandeja')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-refrescar-bandeja');
    if (btn) btn.innerHTML = `${icon('hourglass_empty', 16)} Sincronizando...`;
    await recargarActas();
    renderBandeja();
    toast('Lista de actas actualizada');
  });

  document.getElementById('f-q')?.addEventListener('input', e => {
    _filters.q = e.target.value;
    renderBandeja();
  });
  document.getElementById('f-tipo')?.addEventListener('change', e => {
    _filters.tipo = e.target.value;
    renderBandeja();
  });
  document.getElementById('f-project')?.addEventListener('change', e => {
    _filters.project_id = e.target.value;
    renderBandeja();
  });
  document.getElementById('f-estado')?.addEventListener('change', e => {
    _filters.estado = e.target.value;
    renderBandeja();
  });
  document.getElementById('btn-limpiar-filtros')?.addEventListener('click', () => {
    _filters = { tipo: '', estado: '', project_id: '', q: '' };
    renderBandeja();
  });

  // Acciones en filas
  c.querySelectorAll('[data-action="ver"]').forEach(btn => {
    btn.addEventListener('click', () => verActa(btn.dataset.id));
  });
  c.querySelectorAll('[data-action="editar"]').forEach(btn => {
    btn.addEventListener('click', () => editarActa(btn.dataset.id));
  });
  c.querySelectorAll('[data-action="word"]').forEach(btn => {
    btn.addEventListener('click', () => descargarWordPorId(btn.dataset.id));
  });
  c.querySelectorAll('[data-action="pdf"]').forEach(btn => {
    btn.addEventListener('click', () => imprimirPorId(btn.dataset.id));
  });
  c.querySelectorAll('[data-action="eliminar"]').forEach(btn => {
    btn.addEventListener('click', () => eliminarActa(btn.dataset.id, btn.dataset.codigo));
  });
}

function renderFilaActa(a) {
  const cfg = TIPOS_CONFIG[a.tipo] || TIPOS_CONFIG.seguridad;
  const est = ESTADOS_CONFIG[a.estado] || ESTADOS_CONFIG.borrador;
  const res = a.resumen || { severidad: { critico: 0, alto: 0, medio: 0, bajo: 0 } };
  const s = res.severidad || {};

  return `
    <tr class="hover:bg-blue-50/40 transition-colors">
      <td class="px-4 py-3.5 font-mono font-semibold text-primary-700">
        <a href="javascript:void(0)" data-action="ver" data-id="${a.id}" class="hover:underline flex items-center gap-1.5">
          ${icon('description', 16)} ${esc(a.codigo)}
        </a>
      </td>
      <td class="px-4 py-3.5">
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badgeCls}">
          ${icon(cfg.iconName, 14)} ${cfg.label}
        </span>
      </td>
      <td class="px-4 py-3.5">
        <div class="font-medium text-gray-900">${esc(a.project_name || 'Sin proyecto vinculado')}</div>
        <div class="text-xs text-gray-500">${esc(a.project_client || a.project_code || 'QUBIRA interno')}</div>
      </td>
      <td class="px-4 py-3.5 text-center font-mono text-xs text-gray-600">v${esc(a.version || '1.0')}</td>
      <td class="px-4 py-3.5 text-xs text-gray-700 whitespace-nowrap">${fmtDate(a.fecha_emision)}</td>
      <td class="px-4 py-3.5 text-xs text-gray-800">${esc(a.auditor || a.created_by_name || '—')}</td>
      <td class="px-4 py-3.5 text-center">
        <div class="inline-flex items-center gap-1 text-xs font-mono font-semibold">
          <span class="px-1.5 py-0.5 rounded text-white" style="background:#C0392B" title="${s.critico || 0} Críticos">${s.critico || 0}</span>
          <span class="px-1.5 py-0.5 rounded text-white" style="background:#E67E22" title="${s.alto || 0} Altos">${s.alto || 0}</span>
          <span class="px-1.5 py-0.5 rounded text-gray-900" style="background:#F1C40F" title="${s.medio || 0} Medios">${s.medio || 0}</span>
          <span class="px-1.5 py-0.5 rounded text-white" style="background:#27AE60" title="${s.bajo || 0} Bajos">${s.bajo || 0}</span>
        </div>
      </td>
      <td class="px-4 py-3.5 text-center">
        <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${est.cls}">
          ${est.label}
        </span>
      </td>
      <td class="px-4 py-3.5 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1">
          <button data-action="ver" data-id="${a.id}" class="p-1.5 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-100" title="Ver documento fiel">
            ${icon('visibility', 18)}
          </button>
          <button data-action="editar" data-id="${a.id}" class="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-gray-100" title="Editar acta">
            ${icon('edit', 18)}
          </button>
          <button data-action="word" data-id="${a.id}" class="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-100" title="Descargar Word (.doc)">
            ${icon('article', 18)}
          </button>
          <button data-action="pdf" data-id="${a.id}" class="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100" title="Imprimir / Exportar PDF">
            ${icon('picture_as_pdf', 18)}
          </button>
          <button data-action="eliminar" data-id="${a.id}" data-codigo="${esc(a.codigo)}" class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Eliminar acta">
            ${icon('delete', 18)}
          </button>
        </div>
      </td>
    </tr>
  `;
}

// ─── MODAL NUEVA ACTA ─────────────────────────────────────────────────────────
function abrirModalNuevaActa() {
  const user = getUser();
  const projOpts = _projects.map(p => `
    <option value="${p.id}">${esc(p.name)} (${esc(p.code || 'S/C')}) — ${esc(p.client || 'Interno')}</option>
  `).join('');

  showModal(
    'Crear Nueva Acta de Calidad / Auditoría',
    `
    <form id="form-nueva-acta" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Tipo de Auditoría</label>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${Object.values(TIPOS_CONFIG).map((tc, idx) => `
            <label class="relative flex flex-col p-3 border-2 rounded-xl cursor-pointer hover:border-primary-500 transition-all ${idx === 0 ? 'border-primary-600 bg-primary-50/30' : 'border-gray-200'} tipo-radio-card">
              <input type="radio" name="tipo" value="${tc.tipo}" class="sr-only" ${idx === 0 ? 'checked' : ''}>
              <div class="flex items-center gap-2 mb-1">
                <span class="w-7 h-7 rounded-lg ${tc.badgeCls} flex items-center justify-center shrink-0">
                  ${icon(tc.iconName, 18)}
                </span>
                <span class="font-bold text-sm text-gray-900">${tc.label}</span>
              </div>
              <p class="text-xs text-gray-500 leading-relaxed">${tc.descripcion}</p>
              <span class="mt-2 text-[11px] font-mono font-semibold text-primary-700">AUD-${tc.sigla}-[AAAA]-[NNN]</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center justify-between">
          <span>Proyecto a Auditar</span>
          <span id="label-proyecto-seleccionado" class="text-[11px] font-medium text-primary-700 font-mono"></span>
        </label>
        <div class="relative" id="contenedor-filtro-proyecto">
          <input type="hidden" id="new-project_id" value="">
          <div class="relative flex items-center">
            <span class="absolute left-3 text-gray-400 pointer-events-none flex items-center">
              ${icon('search', 18)}
            </span>
            <input
              type="text"
              id="new-project-search"
              class="input w-full pl-9 pr-9 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              placeholder="Escribe para buscar proyecto por nombre, código o cliente..."
              autocomplete="off"
              spellcheck="false"
            >
            <button
              type="button"
              id="btn-limpiar-proyecto-search"
              class="absolute right-2.5 text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 hidden transition-colors"
              title="Limpiar selección"
            >
              ${icon('close', 16)}
            </button>
          </div>

          <!-- Dropdown flotante con las opciones filtradas -->
          <div
            id="new-project-dropdown"
            class="hidden absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-gray-100"
            style="scrollbar-width: thin;"
          ></div>
        </div>
        <p class="text-xs text-gray-400 mt-1">Escribe para filtrar proyectos. Se extraerán repositorios, cliente y entorno automáticamente.</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center justify-between">
            <span>Auditor Responsable</span>
            <span class="text-[11px] font-normal text-gray-400 flex items-center gap-1">${icon('lock', 12)} Bloqueado</span>
          </label>
          <input
            type="text"
            id="new-auditor"
            class="input w-full text-sm bg-gray-100/90 text-gray-700 border-gray-200 cursor-not-allowed select-none font-medium"
            value="${esc(user?.name || 'Abraham Aranda Cerna')}"
            readonly
            tabindex="-1"
          >
          <p class="text-[11px] text-gray-400 mt-1">Usuario de sesión activo</p>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center justify-between">
            <span>Fecha de Emisión</span>
            <span class="text-[11px] font-normal text-gray-400 flex items-center gap-1">${icon('lock', 12)} Bloqueado</span>
          </label>
          <input
            type="date"
            id="new-fecha_emision"
            class="input w-full text-sm bg-gray-100/90 text-gray-700 border-gray-200 cursor-not-allowed select-none font-medium pointer-events-none"
            value="${hoyISO()}"
            readonly
            tabindex="-1"
          >
          <p class="text-[11px] text-gray-400 mt-1">Fecha actual del sistema</p>
        </div>
      </div>
    </form>
    `,
    'lg',
    `
    <div class="flex justify-end gap-2">
      <button id="modal-cancel-btn" class="btn-secondary">Cancelar</button>
      <button id="modal-crear-btn" class="btn-primary inline-flex items-center gap-2">
        ${icon('check', 18)} Crear e Iniciar Acta
      </button>
    </div>
    `
  );

  // Selector visual de tarjetas tipo radio
  const cards = document.querySelectorAll('.tipo-radio-card');
  cards.forEach(c => {
    c.addEventListener('click', () => {
      cards.forEach(x => {
        x.classList.remove('border-primary-600', 'bg-primary-50/30');
        x.classList.add('border-gray-200');
      });
      c.classList.add('border-primary-600', 'bg-primary-50/30');
      c.classList.remove('border-gray-200');
      c.querySelector('input[type="radio"]').checked = true;
    });
  });

  // Buscador y filtro en tiempo real para el proyecto
  const inputSearch = document.getElementById('new-project-search');
  const hiddenId = document.getElementById('new-project_id');
  const dropdown = document.getElementById('new-project-dropdown');
  const btnLimpiar = document.getElementById('btn-limpiar-proyecto-search');
  const labelSeleccion = document.getElementById('label-proyecto-seleccionado');

  function renderOpcionesProyecto(filtro = '') {
    if (!dropdown) return;
    const q = filtro.trim().toLowerCase();
    const filtrados = _projects.filter(p => {
      if (!q) return true;
      const nombre = (p.name || '').toLowerCase();
      const codigo = (p.code || '').toLowerCase();
      const cliente = (p.client || '').toLowerCase();
      return nombre.includes(q) || codigo.includes(q) || cliente.includes(q);
    });

    if (filtrados.length === 0) {
      dropdown.innerHTML = `
        <div class="p-3.5 text-center text-xs text-gray-400">
          No se encontraron proyectos con "${esc(filtro)}"
        </div>
      `;
      dropdown.classList.remove('hidden');
      return;
    }

    dropdown.innerHTML = filtrados.map(p => {
      const isSelected = p.id === hiddenId.value;
      return `
        <div
          class="p-2.5 hover:bg-primary-50 cursor-pointer flex items-center justify-between transition-colors option-proj-item ${isSelected ? 'bg-primary-50/70 font-semibold' : ''}"
          data-id="${p.id}"
          data-name="${esc(p.name)}"
          data-code="${esc(p.code || 'S/C')}"
          data-client="${esc(p.client || 'Interno')}"
        >
          <div class="min-w-0 pr-2">
            <div class="text-sm font-medium text-gray-900 truncate">${esc(p.name)}</div>
            <div class="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
              <span class="font-medium text-gray-700">${esc(p.client || 'Interno')}</span>
              ${p.code ? `<span class="text-gray-300">•</span><span class="font-mono text-gray-400">Código: ${esc(p.code)}</span>` : ''}
            </div>
          </div>
          ${p.code ? `<span class="shrink-0 px-2 py-0.5 rounded text-[11px] font-mono bg-gray-100 text-gray-700 font-semibold">${esc(p.code)}</span>` : ''}
        </div>
      `;
    }).join('');

    dropdown.querySelectorAll('.option-proj-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const name = el.dataset.name;
        const code = el.dataset.code;
        const client = el.dataset.client;

        hiddenId.value = id;
        inputSearch.value = `${name} (${code}) — ${client}`;
        if (labelSeleccion) labelSeleccion.textContent = `[Seleccionado: ${code}]`;
        btnLimpiar?.classList.remove('hidden');
        dropdown.classList.add('hidden');
      });
    });

    dropdown.classList.remove('hidden');
  }

  let activeIndex = -1;

  function resaltarOpcionActiva(items) {
    items.forEach((it, idx) => {
      if (idx === activeIndex) {
        it.classList.add('bg-primary-100', 'text-primary-900');
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.classList.remove('bg-primary-100', 'text-primary-900');
      }
    });
  }

  inputSearch?.addEventListener('focus', () => {
    activeIndex = -1;
    renderOpcionesProyecto(hiddenId.value ? '' : inputSearch.value);
  });

  inputSearch?.addEventListener('input', (e) => {
    activeIndex = -1;
    const val = e.target.value;
    if (!val) {
      hiddenId.value = '';
      if (labelSeleccion) labelSeleccion.textContent = '';
      btnLimpiar?.classList.add('hidden');
    } else {
      btnLimpiar?.classList.remove('hidden');
    }
    renderOpcionesProyecto(val);
  });

  inputSearch?.addEventListener('keydown', (e) => {
    const items = dropdown?.querySelectorAll('.option-proj-item');
    if (!items || items.length === 0 || dropdown?.classList.contains('hidden')) {
      if (e.key === 'ArrowDown') {
        renderOpcionesProyecto(inputSearch.value);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      resaltarOpcionActiva(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      resaltarOpcionActiva(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < items.length) {
        items[activeIndex].click();
      } else if (items.length === 1) {
        items[0].click();
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
    }
  });

  btnLimpiar?.addEventListener('click', (e) => {
    e.stopPropagation();
    activeIndex = -1;
    hiddenId.value = '';
    inputSearch.value = '';
    if (labelSeleccion) labelSeleccion.textContent = '';
    btnLimpiar.classList.add('hidden');
    inputSearch.focus();
    renderOpcionesProyecto('');
  });

  const cerrarDropdownHandler = (e) => {
    const cont = document.getElementById('contenedor-filtro-proyecto');
    if (cont && !cont.contains(e.target)) {
      dropdown?.classList.add('hidden');
    }
  };
  document.addEventListener('click', cerrarDropdownHandler);

  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-crear-btn')?.addEventListener('click', async () => {
    const form = document.getElementById('form-nueva-acta');
    if (!form) return;
    const tipo = form.querySelector('input[name="tipo"]:checked')?.value || 'seguridad';
    const projectId = document.getElementById('new-project_id').value || null;
    const auditor = document.getElementById('new-auditor').value.trim() || user?.name || 'Auditor QUBIRA';
    const fechaEmision = document.getElementById('new-fecha_emision').value || hoyISO();

    const proj = _projects.find(p => p.id === projectId);
    const cfg = TIPOS_CONFIG[tipo];

    // Estructura inicial del acta con campos en blanco (los no llenados quedan vacíos)
    const datosIniciales = {
      tipo,
      fecha_emision: fechaEmision,
      version: '1.0',
      clasificacion: 'Confidencial',
      auditor,
      auditor_dni: '',
      auditor_cargo: '',
      responsable_proyecto: proj?.responsible_name || '',
      responsable_dni: '',
      responsable_cargo: '',
      entorno: '',
      repositorios: '',
      alcance: '',
      metodologia: '',
      periodo_desde: '',
      periodo_hasta: '',
      proxima_revision: '',
      conclusion: '',
      hallazgos: [],
      controles: [],
      herramientas: [],
      plan_remediacion: [],
    };

    try {
      const resp = await api.post('/calidad/actas', {
        tipo,
        project_id: projectId,
        datos: datosIniciales,
      });
      closeModal();
      await recargarActas();
      toast(`Acta ${resp.codigo} creada en blanco exitosamente`);
      await editarActa(resp.id);
    } catch (e) {
      toast(e.message || 'Error al crear acta', 'error');
    }
  });
}

function sumarDias(fechaStr, dias) {
  try {
    const d = new Date(fechaStr + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  } catch {
    return hoyISO();
  }
}

// ─── VER ACTA (Vista Word Fiel - MODELO_DOC/AUDITORIA) ────────────────────────
async function verActa(id) {
  const c = document.getElementById('calidad-container');
  if (!c) return;

  c.innerHTML = spinner();

  try {
    const acta = await api.get(`/calidad/actas/${id}`);
    _currentActa = acta;
    _mode = 'view';

    const cfg = TIPOS_CONFIG[acta.tipo] || TIPOS_CONFIG.seguridad;
    const est = ESTADOS_CONFIG[acta.estado] || ESTADOS_CONFIG.borrador;
    const d = acta.datos || {};
    const hs = Array.isArray(d.hallazgos) ? d.hallazgos : [];

    // Conteos por severidad
    const cnt = { critico: 0, alto: 0, medio: 0, bajo: 0 };
    hs.forEach(h => { if (cnt[h.severidad] !== undefined) cnt[h.severidad]++; else cnt.bajo++; });

    c.innerHTML = `
      <!-- Toolbar superior de la vista documento (Fijo / Sticky al hacer scroll) -->
      <div class="sticky top-0 z-30 pt-1 pb-3 bg-gray-50/95 backdrop-blur-md mb-4 print:hidden" style="position: -webkit-sticky; position: sticky; top: 0;">
        <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-md">
          <div class="flex items-center gap-3">
            <button id="btn-volver-bandeja" class="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-3">
              ${icon('arrow_back', 18)} Volver a la lista
            </button>
            <div class="h-6 w-px bg-gray-200"></div>
            <div>
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documento Activo:</span>
              <span class="font-mono font-bold text-gray-900 text-sm ml-1">${esc(acta.codigo)}</span>
              <span class="ml-2 px-2 py-0.5 rounded-full text-xs font-medium border ${est.cls}">${est.label}</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Selector rápido de estado -->
            <select id="cambiar-estado-select" class="input w-auto text-xs py-1.5">
              <option value="borrador" ${acta.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
              <option value="en_revision" ${acta.estado === 'en_revision' ? 'selected' : ''}>En revisión</option>
              <option value="emitida" ${acta.estado === 'emitida' ? 'selected' : ''}>Emitida</option>
              <option value="cerrada" ${acta.estado === 'cerrada' ? 'selected' : ''}>Cerrada</option>
            </select>

            <button id="btn-editar-doc" class="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-3 text-amber-700 border-amber-200 hover:bg-amber-50">
              ${icon('edit_note', 18)} Editar Acta
            </button>

            <button id="btn-descargar-word" class="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-3 text-blue-700 border-blue-200 hover:bg-blue-50">
              ${icon('file_download', 18)} Descargar Word (.doc)
            </button>

            <button id="btn-imprimir-pdf" class="btn-primary inline-flex items-center gap-1.5 text-sm py-2 px-3">
              ${icon('print', 18)} Imprimir / PDF
            </button>
          </div>
        </div>
      </div>

      <!-- Contenedor del Documento Word (Hoja A4 fiel a MODELO_DOC/AUDITORIA) -->
      <div class="flex justify-center mb-12">
        <div id="word-document-root" class="word-paper-container" style="
          width: 210mm;
          min-height: 297mm;
          background: #FFFFFF;
          box-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.2);
          padding: 12mm 20mm 15mm 20mm;
          box-sizing: border-box;
          font-family: 'Calibri', Arial, sans-serif;
          color: #1F2937;
          line-height: 1.25;
        ">
          ${generarHtmlDocumentoWord(acta)}
        </div>
      </div>
    `;

    // Listeners
    document.getElementById('btn-volver-bandeja')?.addEventListener('click', async () => {
      _mode = 'list';
      await recargarActas();
      renderBandeja();
    });
    document.getElementById('btn-editar-doc')?.addEventListener('click', () => editarActa(acta.id));
    document.getElementById('btn-descargar-word')?.addEventListener('click', () => descargarWord(acta));
    document.getElementById('btn-imprimir-pdf')?.addEventListener('click', () => window.print());

    document.getElementById('cambiar-estado-select')?.addEventListener('change', async e => {
      const nuevo = e.target.value;
      try {
        await api.put(`/calidad/actas/${acta.id}`, { estado: nuevo });
        toast(`Estado actualizado a ${nuevo.replace('_', ' ')}`);
        await recargarActas();
        verActa(acta.id);
      } catch (err) {
        toast(err.message || 'Error al cambiar estado', 'error');
      }
    });

  } catch (e) {
    c.innerHTML = `
      <div class="card p-8 text-center text-red-500">
        <p class="font-bold">Error al cargar el acta</p>
        <p class="text-xs text-gray-500 mt-1 mb-4">${esc(e.message)}</p>
        <button id="btn-volver-err" class="btn-primary">Volver a la lista</button>
      </div>`;
    document.getElementById('btn-volver-err')?.addEventListener('click', () => {
      _mode = 'list';
      renderBandeja();
    });
  }
}

// ─── GENERADOR DE HTML EXACTO AL MODELO DOCX ─────────────────────────────────
function generarHtmlDocumentoWord(acta) {
  const cfg = TIPOS_CONFIG[acta.tipo] || TIPOS_CONFIG.seguridad;
  const d = acta.datos || {};
  const hs = Array.isArray(d.hallazgos) ? d.hallazgos : [];

  // Severidades
  const cnt = { critico: 0, alto: 0, medio: 0, bajo: 0 };
  hs.forEach(h => {
    const k = cnt[h.severidad] !== undefined ? h.severidad : 'bajo';
    cnt[k]++;
  });

  const criticos = hs.filter(h => h.severidad === 'critico');
  const altos    = hs.filter(h => h.severidad === 'alto');
  const medios   = hs.filter(h => h.severidad === 'medio');
  const bajos    = hs.filter(h => h.severidad === 'bajo');

  const controles = Array.isArray(d.controles) ? d.controles : [];
  const herramientas = Array.isArray(d.herramientas) ? d.herramientas : [];
  const plan = Array.isArray(d.plan_remediacion) ? d.plan_remediacion : [];

  return `
    <!-- ENCABEZADO SUPERIOR DEL DOCUMENTO -->
    <div style="border-bottom:0.5pt solid #C9D3DF;padding-bottom:4pt;margin-bottom:12pt;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:8pt;font-family:'Calibri', Arial, sans-serif;">
        QUBIRA S.A.C. &nbsp;·&nbsp; <span style="font-weight:normal;color:#6B7280;">${cfg.titulo}</span>
      </span>
      <span style="font-weight:bold;color:#2E6DA4;font-size:8pt;font-family:'Calibri', Arial, sans-serif;">
        ${esc(acta.codigo)}
      </span>
    </div>

    <!-- TÍTULOS CORPORATIVOS -->
    <p style="margin-top:4pt;margin-bottom:2pt;line-height:1.15;">
      <span style="font-weight:bold;color:#2E6DA4;font-size:10pt;font-family:'Calibri', Arial, sans-serif;letter-spacing:0.5px;">QUBIRA S.A.C.</span>
    </p>
    <p style="margin-top:0pt;margin-bottom:3pt;line-height:1.15;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:20pt;font-family:'Calibri', Arial, sans-serif;">${cfg.titulo}</span>
    </p>
    <p style="margin-top:0pt;margin-bottom:11pt;border-bottom:2.25pt solid #2E6DA4;padding-bottom:6pt;line-height:1.2;">
      <span style="font-style:italic;color:#6B7280;font-size:10pt;font-family:'Calibri', Arial, sans-serif;">${cfg.subtitulo}</span>
    </p>

    <!-- TABLA DE METADATOS INICIAL -->
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 10pt 0;">
      <colgroup>
        <col style="width:23.86%">
        <col style="width:26.14%">
        <col style="width:23.86%">
        <col style="width:26.14%">
      </colgroup>
      <tbody>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">N.º de acta</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="font-weight:bold;color:#2E6DA4;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">${esc(acta.codigo)}</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">Fecha de emisión</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="color:#1F2937;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">${esc(acta.fecha_emision || d.fecha_emision || hoyISO())}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">Versión</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="color:#1F2937;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">${esc(acta.version || '1.0')}</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">Clasificación</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="font-weight:bold;color:#C0392B;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">${esc(d.clasificacion || 'Confidencial')}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">Proyecto</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="font-weight:bold;color:#1F2937;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">${esc(acta.project_name || 'Proyecto QUBIRA')}</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">Cliente</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="color:#1F2937;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">${esc(acta.project_client || 'QUBIRA interno')}</span></p>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- SECCIÓN 1: DATOS GENERALES DE LA AUDITORÍA -->
    <p style="margin-top:14pt;margin-bottom:6pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:13pt;font-family:'Calibri', Arial, sans-serif;">1. DATOS GENERALES DE LA AUDITORÍA</span>
    </p>
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 10pt 0;">
      <colgroup>
        <col style="width:28%">
        <col style="width:72%">
      </colgroup>
      <thead>
        <tr>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;">
            <span style="font-weight:bold;color:#FFFFFF;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">Campo</span>
          </th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;">
            <span style="font-weight:bold;color:#FFFFFF;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">Detalle</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;">Entorno auditado</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="color:#1F2937;font-size:9.5pt;">${esc(d.entorno || '—')}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;">Repositorios</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="color:#1F2937;font-size:9.5pt;">${esc(d.repositorios || '—')}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;">Alcance</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="color:#1F2937;font-size:9.5pt;">${esc(d.alcance || '—')}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;">Metodología</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="color:#1F2937;font-size:9.5pt;">${esc(d.metodologia || '—')}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;">Periodo de ejecución</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="color:#1F2937;font-size:9.5pt;">${(d.periodo_desde || d.periodo_hasta) ? `${esc(d.periodo_desde || '—')} al ${esc(d.periodo_hasta || '—')}` : '—'}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;">Auditor responsable</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F2937;font-size:9.5pt;">${esc(d.auditor || acta.auditor || '—')}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;">Próxima revisión</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="color:#1F2937;font-size:9.5pt;">${esc(d.proxima_revision || '—')}</span></p>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- SECCIÓN 2: RESUMEN EJECUTIVO -->
    <p style="margin-top:14pt;margin-bottom:6pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:13pt;font-family:'Calibri', Arial, sans-serif;">2. RESUMEN EJECUTIVO</span>
    </p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 8pt 0;">
      <tbody>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:5pt 7pt;width:20%;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;">Conclusión</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:5pt 7pt;vertical-align:top;">
            <p style="margin:1pt;line-height:1.4;"><span style="color:#1F2937;font-size:9.5pt;">${esc(d.conclusion || '—')}</span></p>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- TARJETAS DE CONTEO VISUAL DE SEVERIDADES (IGUAL A LA PLANTILLA WORD) -->
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 12pt 0;">
      <colgroup>
        <col style="width:25%">
        <col style="width:25%">
        <col style="width:25%">
        <col style="width:25%">
      </colgroup>
      <tbody>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#C0392B;padding:4pt 5pt;text-align:center;">
            <p style="margin:0;"><span style="font-weight:bold;color:#FFFFFF;font-size:9.5pt;">CRÍTICO</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;background:#E67E22;padding:4pt 5pt;text-align:center;">
            <p style="margin:0;"><span style="font-weight:bold;color:#FFFFFF;font-size:9.5pt;">ALTO</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;background:#F1C40F;padding:4pt 5pt;text-align:center;">
            <p style="margin:0;"><span style="font-weight:bold;color:#1F2937;font-size:9.5pt;">MEDIO</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;background:#27AE60;padding:4pt 5pt;text-align:center;">
            <p style="margin:0;"><span style="font-weight:bold;color:#FFFFFF;font-size:9.5pt;">BAJO</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;padding:6pt 5pt;text-align:center;">
            <p style="margin:0;"><span style="font-weight:bold;color:#C0392B;font-size:18pt;">${cnt.critico}</span></p>
            <p style="margin:0;"><span style="color:#6B7280;font-size:8pt;">hallazgo${cnt.critico !== 1 ? 's' : ''}</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:6pt 5pt;text-align:center;">
            <p style="margin:0;"><span style="font-weight:bold;color:#E67E22;font-size:18pt;">${cnt.alto}</span></p>
            <p style="margin:0;"><span style="color:#6B7280;font-size:8pt;">hallazgo${cnt.alto !== 1 ? 's' : ''}</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:6pt 5pt;text-align:center;">
            <p style="margin:0;"><span style="font-weight:bold;color:#1F3A5F;font-size:18pt;">${cnt.medio}</span></p>
            <p style="margin:0;"><span style="color:#6B7280;font-size:8pt;">hallazgo${cnt.medio !== 1 ? 's' : ''}</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:6pt 5pt;text-align:center;">
            <p style="margin:0;"><span style="font-weight:bold;color:#27AE60;font-size:18pt;">${cnt.bajo}</span></p>
            <p style="margin:0;"><span style="color:#6B7280;font-size:8pt;">hallazgo${cnt.bajo !== 1 ? 's' : ''}</span></p>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- SECCIÓN 3: CRITERIOS DE SEVERIDAD -->
    <p style="margin-top:14pt;margin-bottom:6pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:13pt;font-family:'Calibri', Arial, sans-serif;">3. CRITERIOS DE SEVERIDAD</span>
    </p>
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 10pt 0;">
      <colgroup>
        <col style="width:20%">
        <col style="width:60%">
        <col style="width:20%">
      </colgroup>
      <thead>
        <tr>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;">
            <span style="font-weight:bold;color:#FFFFFF;font-size:9.5pt;">Severidad</span>
          </th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;">
            <span style="font-weight:bold;color:#FFFFFF;font-size:9.5pt;">Criterio</span>
          </th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;">
            <span style="font-weight:bold;color:#FFFFFF;font-size:9.5pt;">Plazo de corrección</span>
          </th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(SEVERIDAD_CONFIG).map(([k, cfgSev]) => `
          <tr>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;background:#FFFFFF;">
              <span style="font-weight:bold;color:${cfgSev.bg};font-size:9.5pt;">${cfgSev.label}</span>
            </td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;color:#1F2937;">${cfgSev.criterio}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;font-weight:bold;color:#1F3A5F;">${cfgSev.plazo}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- SECCIÓN 4: RESUMEN DE HALLAZGOS -->
    <p style="margin-top:14pt;margin-bottom:6pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:13pt;font-family:'Calibri', Arial, sans-serif;">4. RESUMEN DE HALLAZGOS</span>
    </p>
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 4pt 0;">
      <colgroup>
        <col style="width:10%">
        <col style="width:40%">
        <col style="width:14%">
        <col style="width:14%">
        <col style="width:12%">
        <col style="width:10%">
      </colgroup>
      <thead>
        <tr>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">N.º</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Hallazgo</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:center;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Severidad</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:center;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Estado</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Responsable</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:center;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Fecha límite</span></th>
        </tr>
      </thead>
      <tbody>
        ${hs.length === 0 ? `
          <tr><td colspan="6" style="border:0.5pt solid #C9D3DF;padding:6pt;text-align:center;color:#6B7280;font-size:9pt;">Sin hallazgos registrados</td></tr>
        ` : hs.map((h, i) => {
          const scfg = SEVERIDAD_CONFIG[h.severidad] || SEVERIDAD_CONFIG.bajo;
          return `
            <tr>
              <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-weight:bold;color:#1F3A5F;font-size:9pt;">${esc(h.id || `H-${String(i+1).padStart(2,'0')}`)}</td>
              <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;color:#1F2937;">${esc(h.titulo)}</td>
              <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;text-align:center;">
                <span style="font-weight:bold;color:${scfg.bg};font-size:8.5pt;">${scfg.label}</span>
              </td>
              <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;text-align:center;font-size:8.5pt;color:#4B5563;text-transform:capitalize;">${esc((h.estado || 'pendiente').replace('_', ' '))}</td>
              <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#1F2937;">${esc(h.responsable || '—')}</td>
              <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;text-align:center;font-size:8.5pt;color:#1F2937;">${esc(h.fecha_limite || '—')}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    <p style="margin-top:2pt;margin-bottom:12pt;font-size:8pt;color:#6B7280;font-style:italic;">
      Estados válidos: Pendiente · En progreso · Corregido · Verificado.
    </p>

    <!-- SECCIÓN 5: DETALLE DE HALLAZGOS -->
    <p style="margin-top:14pt;margin-bottom:6pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:13pt;font-family:'Calibri', Arial, sans-serif;">5. DETALLE DE HALLAZGOS</span>
    </p>

    <!-- 5.1 Críticos -->
    <p style="margin-top:10pt;margin-bottom:4pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:11pt;font-family:'Calibri', Arial, sans-serif;">5.1 &nbsp;Críticos — acción inmediata</span>
    </p>
    ${criticos.length === 0 ? `
      <p style="font-size:9pt;color:#6B7280;font-style:italic;margin-bottom:8pt;">No se identificaron hallazgos de severidad crítica.</p>
    ` : criticos.map(h => renderTarjetaHallazgoDetallada(h, '#C0392B', 'CRÍTICO')).join('')}

    <!-- 5.2 Altos -->
    <p style="margin-top:12pt;margin-bottom:4pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:11pt;font-family:'Calibri', Arial, sans-serif;">5.2 &nbsp;Altos</span>
    </p>
    ${altos.length === 0 ? `
      <p style="font-size:9pt;color:#6B7280;font-style:italic;margin-bottom:8pt;">No se identificaron hallazgos de severidad alta.</p>
    ` : altos.map(h => renderTarjetaHallazgoDetallada(h, '#E67E22', 'ALTO')).join('')}

    <!-- 5.3 Medios -->
    <p style="margin-top:12pt;margin-bottom:4pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:11pt;font-family:'Calibri', Arial, sans-serif;">5.3 &nbsp;Medios</span>
    </p>
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 10pt 0;">
      <colgroup>
        <col style="width:12%">
        <col style="width:38%">
        <col style="width:25%">
        <col style="width:25%">
      </colgroup>
      <thead>
        <tr>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">N.º</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Hallazgo</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Ubicación</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Corrección</span></th>
        </tr>
      </thead>
      <tbody>
        ${medios.length === 0 ? `
          <tr><td colspan="4" style="border:0.5pt solid #C9D3DF;padding:5pt;text-align:center;color:#6B7280;font-size:9pt;">No se identificaron hallazgos medios</td></tr>
        ` : medios.map(h => `
          <tr>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-weight:bold;color:#1F3A5F;font-size:9pt;">${esc(h.id)}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;color:#1F2937;">${esc(h.titulo)}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#4B5563;">${esc(h.ubicacion || '—')}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#1F2937;">${esc(h.correccion || '—')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- 5.4 Bajos y controles conformes -->
    <p style="margin-top:12pt;margin-bottom:4pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:11pt;font-family:'Calibri', Arial, sans-serif;">5.4 &nbsp;Bajos y controles conformes</span>
    </p>
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 12pt 0;">
      <colgroup>
        <col style="width:25%">
        <col style="width:25%">
        <col style="width:50%">
      </colgroup>
      <thead>
        <tr>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Área / Dominio</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Resultado</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Observación</span></th>
        </tr>
      </thead>
      <tbody>
        ${bajos.length === 0 ? `
          <tr>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;font-weight:bold;color:#1F3A5F;">Arquitectura y Código</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;color:#27AE60;font-weight:bold;">Conforme</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#4B5563;">Cumple con la estructura base de seguridad y calidad del proyecto.</td>
          </tr>
        ` : bajos.map(h => `
          <tr>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;font-weight:bold;color:#1F3A5F;">${esc(h.ubicacion || 'General')}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;color:#27AE60;font-weight:bold;">Riesgo bajo</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#4B5563;">${esc(h.titulo)} — ${esc(h.correccion || 'Buena práctica')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- SECCIÓN 6: CONTROLES REVISADOS (CHECKLIST AGRUPADO) -->
    <p style="margin-top:14pt;margin-bottom:6pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:13pt;font-family:'Calibri', Arial, sans-serif;">6. CONTROLES REVISADOS</span>
    </p>
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 12pt 0;">
      <colgroup>
        <col style="width:26%">
        <col style="width:52%">
        <col style="width:11%">
        <col style="width:11%">
      </colgroup>
      <thead>
        <tr>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Dominio</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Control</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:center;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Cumple</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:center;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Ref.</span></th>
        </tr>
      </thead>
      <tbody>
        ${controles.length === 0 ? `
          <tr><td colspan="4" style="border:0.5pt solid #C9D3DF;padding:8pt;text-align:center;color:#6B7280;font-size:9pt;">Sin controles registrados en el acta</td></tr>
        ` : controles.map(dom => {
          const items = Array.isArray(dom.items) ? dom.items : [];
          return items.map((it, idx) => {
            const cumpleColor = it.cumple === 'si' ? '#27AE60' : it.cumple === 'no' ? '#C0392B' : '#6B7280';
            const cumpleText = it.cumple === 'si' ? 'Sí' : it.cumple === 'no' ? 'No' : 'N.A.';
            return `
              <tr>
                ${idx === 0 ? `
                  <td rowspan="${items.length}" style="border:0.5pt solid #C9D3DF;background:#F8FAFC;padding:4pt 5.5pt;vertical-align:top;font-weight:bold;color:#1F3A5F;font-size:9pt;">
                    ${esc(dom.dominio)}
                  </td>
                ` : ''}
                <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#1F2937;vertical-align:middle;">
                  ${esc(it.control)}
                </td>
                <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;text-align:center;font-weight:bold;color:${cumpleColor};font-size:9pt;vertical-align:middle;">
                  ${cumpleText}
                </td>
                <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;text-align:center;font-size:8pt;color:#6B7280;vertical-align:middle;">
                  ${esc(it.ref || '—')}
                </td>
              </tr>
            `;
          }).join('');
        }).join('')}
      </tbody>
    </table>

    <!-- SECCIÓN 7: HERRAMIENTAS RECOMENDADAS -->
    <p style="margin-top:14pt;margin-bottom:6pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:13pt;font-family:'Calibri', Arial, sans-serif;">7. HERRAMIENTAS RECOMENDADAS</span>
    </p>
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 12pt 0;">
      <colgroup>
        <col style="width:30%">
        <col style="width:18%">
        <col style="width:52%">
      </colgroup>
      <thead>
        <tr>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Herramienta</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:center;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Prioridad</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Justificación</span></th>
        </tr>
      </thead>
      <tbody>
        ${herramientas.length === 0 ? `
          <tr><td colspan="3" style="border:0.5pt solid #C9D3DF;padding:5pt;text-align:center;color:#6B7280;font-size:9pt;">No se añadieron herramientas recomendadas</td></tr>
        ` : herramientas.map(t => `
          <tr>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-weight:bold;color:#1F3A5F;font-size:9pt;">${esc(t.herramienta)}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;text-align:center;font-size:8.5pt;font-weight:bold;color:${t.prioridad === 'Alta' ? '#C0392B' : t.prioridad === 'Media' ? '#E67E22' : '#27AE60'};">${esc(t.prioridad || 'Media')}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#1F2937;">${esc(t.justificacion)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- SECCIÓN 8: PLAN DE REMEDIACIÓN -->
    <p style="margin-top:14pt;margin-bottom:6pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:13pt;font-family:'Calibri', Arial, sans-serif;">8. PLAN DE REMEDIACIÓN</span>
    </p>
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 12pt 0;">
      <colgroup>
        <col style="width:40%">
        <col style="width:10%">
        <col style="width:14%">
        <col style="width:18%">
        <col style="width:12%">
        <col style="width:6%">
      </colgroup>
      <thead>
        <tr>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Acción correctiva</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:center;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Ref.</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:center;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Prioridad</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Responsable</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:center;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Fecha</span></th>
          <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:center;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Hecho</span></th>
        </tr>
      </thead>
      <tbody>
        ${plan.length === 0 ? `
          <tr><td colspan="6" style="border:0.5pt solid #C9D3DF;padding:5pt;text-align:center;color:#6B7280;font-size:9pt;">Sin acciones registradas en el plan</td></tr>
        ` : plan.map(p => `
          <tr>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#1F2937;">${esc(p.accion)}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;text-align:center;font-weight:bold;font-size:8.5pt;color:#1F3A5F;">${esc(p.ref || '—')}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;text-align:center;font-size:8.5pt;font-weight:bold;color:${p.prioridad === 'Crítico' ? '#C0392B' : p.prioridad === 'Alto' ? '#E67E22' : '#1F3A5F'};">${esc(p.prioridad || 'Medio')}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#1F2937;">${esc(p.responsable || '—')}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;text-align:center;font-size:8.5pt;color:#1F2937;">${esc(p.fecha || '—')}</td>
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;text-align:center;font-size:11pt;color:${p.hecho ? '#27AE60' : '#9CA3AF'}; font-family:Arial;">
              ${p.hecho ? '☑' : '☐'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- SECCIÓN 9: CONFORMIDAD Y FIRMAS -->
    <p style="margin-top:14pt;margin-bottom:6pt;">
      <span style="font-weight:bold;color:#1F3A5F;font-size:13pt;font-family:'Calibri', Arial, sans-serif;">9. CONFORMIDAD</span>
    </p>
    <p style="margin-top:0pt;margin-bottom:20pt;font-size:9pt;color:#374151;line-height:1.4;">
      Las partes firmantes declaran conocer los hallazgos descritos en la presente acta y se comprometen a ejecutar el plan de remediación en los plazos establecidos.
    </p>

    <table style="border-collapse:collapse;width:100%;margin-top:30pt;margin-bottom:20pt;">
      <tbody>
        <tr>
          <td style="width:48%;text-align:center;vertical-align:bottom;padding:0 15pt;">
            <div style="border-top:1pt solid #1F3A5F;padding-top:6pt;">
              <p style="margin:0;font-weight:bold;font-size:9.5pt;color:#1F3A5F;">${esc(d.auditor || acta.auditor || 'Auditor Responsable')}</p>
              <p style="margin:2pt 0;font-size:8.5pt;color:#4B5563;">${esc(d.auditor_cargo || 'Auditor responsable')}</p>
              <p style="margin:0;font-size:8pt;color:#6B7280;">DNI: ${esc(d.auditor_dni || '_______________')} &nbsp;&nbsp; Fecha: ${esc(acta.fecha_emision || hoyISO())}</p>
            </div>
          </td>
          <td style="width:4%;"></td>
          <td style="width:48%;text-align:center;vertical-align:bottom;padding:0 15pt;">
            <div style="border-top:1pt solid #1F3A5F;padding-top:6pt;">
              <p style="margin:0;font-weight:bold;font-size:9.5pt;color:#1F3A5F;">${esc(d.responsable_proyecto || 'Responsable del proyecto')}</p>
              <p style="margin:2pt 0;font-size:8.5pt;color:#4B5563;">${esc(d.responsable_cargo || 'Líder de Proyecto / Cliente')}</p>
              <p style="margin:0;font-size:8pt;color:#6B7280;">DNI: ${esc(d.responsable_dni || '_______________')} &nbsp;&nbsp; Fecha: ${esc(acta.fecha_emision || hoyISO())}</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- PIE DE PÁGINA DEL DOCUMENTO -->
    <div style="border-top:0.5pt solid #C9D3DF;padding-top:5pt;margin-top:25pt;display:flex;justify-content:space-between;align-items:center;">
      <span style="color:#6B7280;font-size:7.5pt;font-family:'Calibri', Arial, sans-serif;">
        Documento confidencial — uso interno
      </span>
      <span style="color:#6B7280;font-size:7.5pt;font-family:'Calibri', Arial, sans-serif;">
        QUBIRA S.A.C. &nbsp;·&nbsp; ${esc(acta.codigo)}
      </span>
    </div>
  `;
}

function renderTarjetaHallazgoDetallada(h, colorBorde, tagSeveridad) {
  return `
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 10pt 0;">
      <colgroup>
        <col style="width:24%">
        <col style="width:76%">
      </colgroup>
      <tbody>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#FFFFFF;font-size:9.5pt;">Hallazgo ${esc(h.id)}</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;vertical-align:middle;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:bold;color:#FFFFFF;font-size:9.5pt;">${esc(h.titulo)}</span>
            <span style="font-weight:bold;color:#FFFFFF;background:${colorBorde};padding:1pt 6pt;border-radius:2pt;font-size:8.5pt;">${tagSeveridad}</span>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9pt;">Severidad</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:${colorBorde};font-size:9pt;">${tagSeveridad}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9pt;">Evidencia</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;line-height:1.35;"><span style="color:#1F2937;font-size:9pt;">${esc(h.evidencia || '—')}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9pt;">Impacto</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;line-height:1.35;"><span style="color:#1F2937;font-size:9pt;">${esc(h.impacto || '—')}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9pt;">Ubicación</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="color:#1F2937;font-size:9pt;font-family:Consolas, monospace;">${esc(h.ubicacion || '—')}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9pt;">Corrección</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;line-height:1.35;"><span style="color:#1F2937;font-size:9pt;">${esc(h.correccion || '—')}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9pt;">Responsable / Plazo</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F2937;font-size:9pt;">${esc(h.responsable || '—')}</span> &nbsp;·&nbsp; <span style="color:#6B7280;font-size:9pt;">${esc(h.fecha_limite || '—')}</span></p>
          </td>
        </tr>
        <tr>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9pt;">Estado</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:top;">
            <p style="margin:1pt;"><span style="font-weight:bold;color:#1F3A5F;font-size:9pt;text-transform:capitalize;">${esc((h.estado || 'pendiente').replace('_', ' '))}</span></p>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

// ─── EDITOR COMPLETO DE ACTA ──────────────────────────────────────────────────
async function editarActa(id) {
  const c = document.getElementById('calidad-container');
  if (!c) return;

  c.innerHTML = spinner();

  try {
    asegurarEstilosLuzAmarilla();
    const acta = await api.get(`/calidad/actas/${id}`);
    _currentActa = acta;
    _mode = 'edit';

    const cfg = TIPOS_CONFIG[acta.tipo] || TIPOS_CONFIG.seguridad;
    const d = JSON.parse(JSON.stringify(acta.datos || {}));

    if (!Array.isArray(d.hallazgos)) d.hallazgos = [];
    if (!Array.isArray(d.controles)) d.controles = [];
    if (!Array.isArray(d.herramientas)) d.herramientas = [];
    if (!Array.isArray(d.plan_remediacion)) d.plan_remediacion = [];

    const projOpts = _projects.map(p => `
      <option value="${p.id}" ${acta.project_id === p.id ? 'selected' : ''}>
        ${esc(p.name)} (${esc(p.code || 'S/C')})
      </option>
    `).join('');

    c.innerHTML = `
      <!-- Toolbar superior de edición (Fijo / Sticky al hacer scroll) -->
      <div class="sticky top-0 z-30 pt-1 pb-3 bg-gray-50/95 backdrop-blur-md mb-4 print:hidden" style="position: -webkit-sticky; position: sticky; top: 0;">
        <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-md">
          <div class="flex items-center gap-2">
            <button id="btn-volver-lista-edicion" class="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-3 text-gray-700 hover:text-gray-900" title="Regresar a la bandeja de actas">
              ${icon('arrow_back', 18)} Volver a la lista
            </button>
            <button id="btn-cancelar-edicion" class="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-3 text-gray-600 hover:text-gray-800" title="Ver documento en modo oficial">
              ${icon('visibility', 18)} Ver Acta
            </button>
            <div class="h-6 w-px bg-gray-200 mx-1"></div>
            <div>
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Editando Acta:</span>
              <span class="font-mono font-bold text-gray-900 text-sm ml-1">${esc(acta.codigo)}</span>
              <span class="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badgeCls}">
                ${cfg.label}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" id="btn-rellenar-plantilla" class="btn-secondary inline-flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3.5 text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 hover:border-amber-400 font-semibold shadow-sm transition-all rounded-lg cursor-pointer" title="Completar únicamente los campos vacíos con los datos oficiales de la plantilla">
              <span class="material-icons text-amber-600 text-base sm:text-lg">auto_fix_high</span> Llenar datos de plantilla
            </button>
            <button id="btn-guardar-acta" class="btn-primary inline-flex items-center gap-1.5 text-sm py-2 px-4 shadow-sm">
              ${icon('save', 18)} Guardar Cambios
            </button>
          </div>
        </div>
      </div>

      <!-- Formulario modular con secciones colapsables -->
      <div class="space-y-6 max-w-5xl mx-auto pb-12">
        <!-- SECCIÓN 1: DATOS GENERALES -->
        <div class="card p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
          <h3 class="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
            ${icon('info', 20)} 1. Datos Generales de la Auditoría
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Proyecto</label>
              <select id="edit-project_id" class="input w-full text-sm">
                <option value="">-- Sin proyecto vinculado --</option>
                ${projOpts}
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Versión del Acta</label>
              <input type="text" id="edit-version" class="input w-full text-sm" value="${esc(acta.version || '1.0')}">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Fecha de Emisión</label>
              <input type="date" id="edit-fecha_emision" class="input w-full text-sm" value="${esc(acta.fecha_emision || hoyISO())}">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Auditor Responsable</label>
              <input type="text" id="edit-auditor" class="input w-full text-sm" value="${esc(d.auditor || acta.auditor || '')}" placeholder="Nombre del auditor">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Periodo Desde</label>
              <input type="date" id="edit-periodo_desde" class="input w-full text-sm" value="${esc(d.periodo_desde || '')}">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Periodo Hasta</label>
              <input type="date" id="edit-periodo_hasta" class="input w-full text-sm" value="${esc(d.periodo_hasta || '')}">
            </div>
            <div class="sm:col-span-3">
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Entorno Auditado</label>
              <input type="text" id="edit-entorno" class="input w-full text-sm" value="${esc(d.entorno || '')}" placeholder="Servidores, hosting, URLs del sistema">
            </div>
            <div class="sm:col-span-3">
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Repositorios y Fuentes</label>
              <input type="text" id="edit-repositorios" class="input w-full text-sm" value="${esc(d.repositorios || '')}" placeholder="URL del repo, ramas revisadas">
            </div>
            <div class="sm:col-span-3">
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Alcance</label>
              <textarea id="edit-alcance" rows="2" class="input w-full text-sm" placeholder="Sistemas, APIs y módulos cubiertos">${esc(d.alcance || '')}</textarea>
            </div>
            <div class="sm:col-span-3">
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Metodología</label>
              <textarea id="edit-metodologia" rows="2" class="input w-full text-sm" placeholder="Técnicas aplicadas (SAST, DAST, revisión de dependencias)">${esc(d.metodologia || '')}</textarea>
            </div>
          </div>
        </div>

        <!-- SECCIÓN 2: RESUMEN EJECUTIVO -->
        <div class="card p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
          <h3 class="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
            ${icon('summarize', 20)} 2. Resumen Ejecutivo
          </h3>
          <div>
            <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Conclusión del Auditor</label>
            <textarea id="edit-conclusion" rows="3" class="input w-full text-sm" placeholder="Resumen conciso: ¿existen riesgos en producción? ¿qué debe corregirse primero?">${esc(d.conclusion || '')}</textarea>
          </div>
        </div>

        <!-- SECCIÓN 3: HALLAZGOS (DINÁMICOS) -->
        <div class="card p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
          <div class="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
            <h3 class="text-base font-bold text-gray-900 flex items-center gap-2">
              ${icon('bug_report', 20)} 3. Hallazgos Identificados
            </h3>
            <button type="button" id="btn-agregar-hallazgo" class="btn-secondary text-xs inline-flex items-center gap-1.5 py-1.5 px-3 text-primary-700 border-primary-200 hover:bg-primary-50">
              ${icon('add', 16)} Agregar Hallazgo
            </button>
          </div>

          <div id="lista-hallazgos" class="space-y-4">
            <!-- Rellenado dinámico -->
          </div>
        </div>

        <!-- SECCIÓN 4: CONTROLES REVISADOS -->
        <div class="card p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
          <h3 class="text-base font-bold text-gray-900 mb-2 flex items-center gap-2 border-b border-gray-100 pb-2">
            ${icon('checklist', 20)} 4. Controles Revisados por Dominio
          </h3>
          <p class="text-xs text-gray-500 mb-4">Marca la conformidad de cada control según la auditoría realizada.</p>
          <div id="lista-controles-editor" class="space-y-4">
            <!-- Controles agrupados -->
          </div>
        </div>

        <!-- SECCIÓN 5: HERRAMIENTAS RECOMENDADAS -->
        <div class="card p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
          <div class="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
            <h3 class="text-base font-bold text-gray-900 flex items-center gap-2">
              ${icon('build', 20)} 5. Herramientas Recomendadas
            </h3>
            <button type="button" id="btn-agregar-herramienta" class="btn-secondary text-xs inline-flex items-center gap-1.5 py-1.5 px-3">
              ${icon('add', 16)} Agregar Herramienta
            </button>
          </div>
          <div id="lista-herramientas-editor" class="space-y-3">
            <!-- Herramientas -->
          </div>
        </div>

        <!-- SECCIÓN 6: CONFORMIDAD Y FIRMAS -->
        <div class="card p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
          <h3 class="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
            ${icon('draw', 20)} 6. Datos para Conformidad y Firmas
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <!-- Auditor -->
            <div class="p-4 bg-gray-50 rounded-xl border border-gray-200/60">
              <p class="font-bold text-sm text-gray-900 mb-3 flex items-center gap-1.5">
                ${icon('badge', 18)} Auditor Responsable
              </p>
              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1">Nombre Completo</label>
                  <input type="text" id="edit-firmante-aud-nombre" class="input w-full text-sm bg-white" value="${esc(d.auditor || acta.auditor || '')}" placeholder="Nombre del auditor">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1">Cargo / Especialidad</label>
                  <input type="text" id="edit-firmante-aud-cargo" class="input w-full text-sm bg-white" value="${esc(d.auditor_cargo || '')}" placeholder="Ej. Auditor de Seguridad y Calidad">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1">DNI / Identificación</label>
                  <input type="text" id="edit-firmante-aud-dni" class="input w-full text-sm bg-white" value="${esc(d.auditor_dni || '')}" placeholder="Número de documento">
                </div>
              </div>
            </div>

            <!-- Contraparte -->
            <div class="p-4 bg-gray-50 rounded-xl border border-gray-200/60">
              <p class="font-bold text-sm text-gray-900 mb-3 flex items-center gap-1.5">
                ${icon('person', 18)} Responsable del Proyecto / Cliente
              </p>
              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1">Nombre Completo</label>
                  <input type="text" id="edit-firmante-resp-nombre" class="input w-full text-sm bg-white" value="${esc(d.responsable_proyecto || '')}" placeholder="Nombre del responsable">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1">Cargo / Empresa</label>
                  <input type="text" id="edit-firmante-resp-cargo" class="input w-full text-sm bg-white" value="${esc(d.responsable_cargo || '')}" placeholder="Ej. Líder Técnico / QUBIRA">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1">DNI / Identificación</label>
                  <input type="text" id="edit-firmante-resp-dni" class="input w-full text-sm bg-white" value="${esc(d.responsable_dni || '')}" placeholder="Número de documento">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Renderizar sub-bloques del editor
    let hallazgosLocales = JSON.parse(JSON.stringify(d.hallazgos || []));
    let controlesLocales = JSON.parse(JSON.stringify(d.controles || []));
    let herramientasLocales = JSON.parse(JSON.stringify(d.herramientas || []));

    function renderHallazgosInputs() {
      const cont = document.getElementById('lista-hallazgos');
      if (!cont) return;

      if (hallazgosLocales.length === 0) {
        cont.innerHTML = `
          <div class="p-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p class="text-sm font-medium text-gray-600 mb-1">No hay hallazgos registrados</p>
            <p class="text-xs text-gray-400">Presiona <b>Agregar Hallazgo</b> o utiliza el botón <b>Llenar datos de plantilla</b> superior.</p>
          </div>`;
        return;
      }

      cont.innerHTML = hallazgosLocales.map((h, idx) => `
        <div class="p-4 rounded-xl border transition-all ${h._dePlantilla ? 'tarjeta-plantilla-luz-amarilla' : 'border-gray-200 bg-gray-50/50'} space-y-3 hallazgo-card" data-idx="${idx}">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-1">
              <input type="text" class="input text-xs font-mono font-bold w-20 py-1 ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" value="${esc(h.id || `H-${String(idx+1).padStart(2,'0')}`)}" placeholder="ID" data-f="id">
              <input type="text" class="input text-sm font-semibold flex-1 py-1 ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" value="${esc(h.titulo)}" placeholder="Título corto del hallazgo" data-f="titulo">
              ${h._dePlantilla ? `
                <span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full shrink-0 shadow-sm" title="Dato sugerido por la plantilla oficial">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Plantilla
                </span>` : ''}
            </div>
            <div class="flex items-center gap-2">
              <select class="input text-xs py-1 w-28 font-semibold ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" data-f="severidad">
                <option value="critico" ${h.severidad === 'critico' ? 'selected' : ''}>🔴 Crítico</option>
                <option value="alto" ${h.severidad === 'alto' ? 'selected' : ''}>🟠 Alto</option>
                <option value="medio" ${h.severidad === 'medio' ? 'selected' : ''}>🟡 Medio</option>
                <option value="bajo" ${h.severidad === 'bajo' ? 'selected' : ''}>🟢 Bajo</option>
              </select>
              <select class="input text-xs py-1 w-28 ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" data-f="estado">
                <option value="pendiente" ${h.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                <option value="en_progreso" ${h.estado === 'en_progreso' ? 'selected' : ''}>En progreso</option>
                <option value="corregido" ${h.estado === 'corregido' ? 'selected' : ''}>Corregido</option>
                <option value="verificado" ${h.estado === 'verificado' ? 'selected' : ''}>Verificado</option>
              </select>
              <button type="button" class="btn-eliminar-h p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" data-idx="${idx}">
                ${icon('delete', 18)}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label class="block font-semibold text-gray-600 mb-0.5">Evidencia (qué se probó / qué respondió)</label>
              <textarea rows="2" class="input w-full text-xs ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" data-f="evidencia">${esc(h.evidencia || '')}</textarea>
            </div>
            <div>
              <label class="block font-semibold text-gray-600 mb-0.5">Impacto (riesgo sobre negocio o datos)</label>
              <textarea rows="2" class="input w-full text-xs ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" data-f="impacto">${esc(h.impacto || '')}</textarea>
            </div>
            <div>
              <label class="block font-semibold text-gray-600 mb-0.5">Ubicación (archivo, línea, endpoint o variable)</label>
              <input type="text" class="input w-full text-xs font-mono ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" value="${esc(h.ubicacion || '')}" data-f="ubicacion">
            </div>
            <div>
              <label class="block font-semibold text-gray-600 mb-0.5">Acción Correctiva Recomendada</label>
              <input type="text" class="input w-full text-xs ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" value="${esc(h.correccion || '')}" data-f="correccion">
            </div>
            <div>
              <label class="block font-semibold text-gray-600 mb-0.5">Responsable de Remediación</label>
              <input type="text" class="input w-full text-xs ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" value="${esc(h.responsable || '')}" data-f="responsable">
            </div>
            <div>
              <label class="block font-semibold text-gray-600 mb-0.5">Fecha Límite</label>
              <input type="date" class="input w-full text-xs ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" value="${esc(h.fecha_limite || '')}" data-f="fecha_limite">
            </div>
          </div>
        </div>
      `).join('');

      // Listeners de inputs de hallazgos
      cont.querySelectorAll('.hallazgo-card').forEach(card => {
        const i = Number(card.dataset.idx);
        card.querySelectorAll('input, select, textarea').forEach(inp => {
          inp.addEventListener('input', () => {
            const f = inp.dataset.f;
            if (f && hallazgosLocales[i]) hallazgosLocales[i][f] = inp.value;
          });
        });
      });

      cont.querySelectorAll('.btn-eliminar-h').forEach(btn => {
        btn.addEventListener('click', () => {
          hallazgosLocales.splice(Number(btn.dataset.idx), 1);
          renderHallazgosInputs();
        });
      });
    }

    function renderControlesInputs() {
      const cont = document.getElementById('lista-controles-editor');
      if (!cont) return;

      if (controlesLocales.length === 0) {
        cont.innerHTML = `
          <div class="p-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p class="text-sm font-medium text-gray-600 mb-1">No hay controles evaluados en esta acta</p>
            <p class="text-xs text-gray-400">Utiliza el botón <b>Llenar datos de plantilla</b> superior para cargar la lista oficial de controles.</p>
          </div>`;
        return;
      }

      cont.innerHTML = controlesLocales.map((dom, dIdx) => `
        <div class="border rounded-xl overflow-hidden transition-all ${dom._dePlantilla ? 'border-amber-400 bg-amber-50/10 shadow-[0_0_12px_rgba(245,158,11,0.2)] ring-1 ring-amber-300' : 'border-gray-200 bg-white'}">
          <div class="px-4 py-2 font-bold text-xs uppercase tracking-wide flex justify-between items-center ${dom._dePlantilla ? 'bg-amber-100/70 text-amber-900 border-b border-amber-200' : 'bg-gray-100/80 text-gray-700'}">
            <div class="flex items-center gap-2">
              <span>${esc(dom.dominio)}</span>
              ${dom._dePlantilla ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-200/80 px-1.5 py-0.5 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-amber-600"></span> Plantilla</span>` : ''}
            </div>
            <span class="text-gray-500 font-normal lowercase text-[11px]">${dom.items.length} controles</span>
          </div>
          <div class="divide-y divide-gray-100 p-2">
            ${dom.items.map((it, iIdx) => `
              <div class="py-2.5 px-3 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-gray-50/60">
                <div class="flex-1 min-w-[280px]">
                  <span class="font-medium text-gray-800">${esc(it.control)}</span>
                  ${it.ref ? `<span class="ml-2 text-gray-400 font-mono text-[11px]">[${esc(it.ref)}]</span>` : ''}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <label class="inline-flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="ctrl_${dIdx}_${iIdx}" value="si" ${it.cumple === 'si' ? 'checked' : ''} class="text-green-600 focus:ring-green-500" data-d="${dIdx}" data-i="${iIdx}">
                    <span class="font-semibold text-green-700">Sí</span>
                  </label>
                  <label class="inline-flex items-center gap-1 cursor-pointer ml-2">
                    <input type="radio" name="ctrl_${dIdx}_${iIdx}" value="no" ${it.cumple === 'no' ? 'checked' : ''} class="text-red-600 focus:ring-red-500" data-d="${dIdx}" data-i="${iIdx}">
                    <span class="font-semibold text-red-700">No</span>
                  </label>
                  <label class="inline-flex items-center gap-1 cursor-pointer ml-2">
                    <input type="radio" name="ctrl_${dIdx}_${iIdx}" value="na" ${it.cumple === 'na' ? 'checked' : ''} class="text-gray-600 focus:ring-gray-500" data-d="${dIdx}" data-i="${iIdx}">
                    <span class="text-gray-600">N.A.</span>
                  </label>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');

      cont.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
          const dIdx = Number(radio.dataset.d);
          const iIdx = Number(radio.dataset.i);
          if (controlesLocales[dIdx]?.items[iIdx]) {
            controlesLocales[dIdx].items[iIdx].cumple = radio.value;
          }
        });
      });
    }

    function renderHerramientasInputs() {
      const cont = document.getElementById('lista-herramientas-editor');
      if (!cont) return;

      if (herramientasLocales.length === 0) {
        cont.innerHTML = `
          <div class="p-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p class="text-sm font-medium text-gray-600 mb-1">No hay herramientas registradas</p>
            <p class="text-xs text-gray-400">Presiona <b>Agregar Herramienta</b> o utiliza <b>Llenar datos de plantilla</b> superior.</p>
          </div>`;
        return;
      }

      cont.innerHTML = herramientasLocales.map((t, idx) => `
        <div class="flex items-center gap-2 p-2 rounded-lg border transition-all tool-row ${t._dePlantilla ? 'bg-amber-50/80 border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]' : 'bg-gray-50 border-gray-200'}" data-idx="${idx}">
          <input type="text" class="input text-xs font-semibold flex-1 py-1 ${t._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" value="${esc(t.herramienta)}" placeholder="Nombre de herramienta" data-f="herramienta">
          <select class="input text-xs py-1 w-24 ${t._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" data-f="prioridad">
            <option value="Alta" ${t.prioridad === 'Alta' ? 'selected' : ''}>Alta</option>
            <option value="Media" ${t.prioridad === 'Media' ? 'selected' : ''}>Media</option>
            <option value="Baja" ${t.prioridad === 'Baja' ? 'selected' : ''}>Baja</option>
          </select>
          <input type="text" class="input text-xs flex-2 py-1 ${t._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" value="${esc(t.justificacion)}" placeholder="Justificación técnica" data-f="justificacion" style="flex:2">
          ${t._dePlantilla ? `<span class="inline-flex items-center text-[10px] font-bold text-amber-900 bg-amber-200 px-1.5 py-0.5 rounded shrink-0">Plantilla</span>` : ''}
          <button type="button" class="btn-eliminar-t p-1 text-gray-400 hover:text-red-600" data-idx="${idx}">
            ${icon('delete', 16)}
          </button>
        </div>
      `).join('');

      cont.querySelectorAll('.tool-row').forEach(row => {
        const i = Number(row.dataset.idx);
        row.querySelectorAll('input, select').forEach(inp => {
          inp.addEventListener('input', () => {
            const f = inp.dataset.f;
            if (f && herramientasLocales[i]) herramientasLocales[i][f] = inp.value;
          });
        });
      });

      cont.querySelectorAll('.btn-eliminar-t').forEach(btn => {
        btn.addEventListener('click', () => {
          herramientasLocales.splice(Number(btn.dataset.idx), 1);
          renderHerramientasInputs();
        });
      });
    }

    renderHallazgosInputs();
    renderControlesInputs();
    renderHerramientasInputs();

    // ─── LÓGICA DE BOTÓN «LLENAR DATOS DE PLANTILLA» (Solo campos vacíos con luz amarilla) ───
    document.getElementById('btn-rellenar-plantilla')?.addEventListener('click', () => {
      asegurarEstilosLuzAmarilla();

      const selectedProjectId = document.getElementById('edit-project_id')?.value;
      const selectedProj = _projects.find(p => p.id === selectedProjectId) || _projects.find(p => p.id === acta.project_id);
      const cfgTipo = TIPOS_CONFIG[acta.tipo] || TIPOS_CONFIG.seguridad;

      let llenadosCount = 0;

      // Helper: SOLO llena el input si su valor actual está completamente vacío
      function llenarSiVacio(elementId, valorPlantilla) {
        const inp = document.getElementById(elementId);
        if (!inp) return;
        if (!inp.value || inp.value.trim() === '') {
          inp.value = valorPlantilla || '';
          inp.classList.add('campo-plantilla-luz-amarilla');
          llenadosCount++;
        }
      }

      // 1. Datos generales según el tipo de acta
      const entornoDefault = selectedProj?.website_url
        ? `Producción (${selectedProj.website_url}) — [Hosting Frontend · Backend Render · Neon PostgreSQL]`
        : (selectedProj?.project_type ? `Entorno ${selectedProj.project_type.toUpperCase()} · PostgreSQL Neon` : 'Producción — [Hosting Backend · Hosting Frontend · PostgreSQL Neon]');
      llenarSiVacio('edit-entorno', entornoDefault);

      const repoDefault = selectedProj?.github_url
        ? `${selectedProj.github_url} (Rama principal e historial de Git)`
        : 'Repositorio principal de código fuente e historial de Git';
      llenarSiVacio('edit-repositorios', repoDefault);

      llenarSiVacio('edit-alcance', cfgTipo.alcanceDef);
      llenarSiVacio('edit-metodologia', cfgTipo.metodologiaDef);
      llenarSiVacio('edit-periodo_desde', acta.fecha_emision || hoyISO());
      llenarSiVacio('edit-periodo_hasta', acta.fecha_emision || hoyISO());

      const conclusionDefault = acta.tipo === 'seguridad'
        ? 'La auditoría determinó la conformidad general de la arquitectura, requiriéndose subsanar los hallazgos críticos y altos en los plazos normativos.'
        : acta.tipo === 'calidad'
        ? 'Se validó la estructura modular y buenas prácticas de codificación, recomendándose optimizar consultas e incrementar cobertura de pruebas automatizadas.'
        : 'Los flujos transaccionales y de cálculo de precios son consistentes; se requiere reforzar el control de concurrencia y validación de idempotencia.';
      llenarSiVacio('edit-conclusion', conclusionDefault);

      // 2. Firmantes
      const user = getUser();
      const auditorNombre = document.getElementById('edit-auditor')?.value.trim() || user?.name || 'Auditor QUBIRA';
      llenarSiVacio('edit-auditor', auditorNombre);
      llenarSiVacio('edit-firmante-aud-nombre', auditorNombre);
      llenarSiVacio('edit-firmante-aud-cargo', 'Auditor de Seguridad y Calidad');
      llenarSiVacio('edit-firmante-aud-dni', '45892147');

      const responsableNombre = selectedProj?.responsible_name || 'Líder Técnico de Desarrollo';
      llenarSiVacio('edit-firmante-resp-nombre', responsableNombre);
      llenarSiVacio('edit-firmante-resp-cargo', 'Líder de Proyecto / Contraparte Técnica');
      llenarSiVacio('edit-firmante-resp-dni', '72458912');

      // 3. Hallazgos (solo llena si la lista está completamente vacía)
      if (hallazgosLocales.length === 0) {
        hallazgosLocales.push({
          id: 'H-01',
          titulo: acta.tipo === 'seguridad' ? 'Autenticación en endpoints administrativos' : acta.tipo === 'calidad' ? 'Optimización de consultas en base de datos' : 'Validación de idempotencia en pasarela',
          severidad: 'medio',
          estado: 'pendiente',
          evidencia: 'Se ejecutaron pruebas controladas y se verificó la respuesta del sistema.',
          impacto: 'Podría generar inconsistencias si aumenta el volumen de operaciones.',
          ubicacion: 'src/routes/',
          correccion: 'Implementar validación estricta y control de excepciones.',
          responsable: document.getElementById('edit-firmante-resp-nombre')?.value || responsableNombre,
          fecha_limite: sumarDias(acta.fecha_emision || hoyISO(), 14),
          _dePlantilla: true,
        });
        renderHallazgosInputs();
        llenadosCount++;
      }

      // 4. Controles (solo llena si la lista está completamente vacía)
      if (controlesLocales.length === 0) {
        controlesLocales = JSON.parse(JSON.stringify(DEFAULT_CONTROLES[acta.tipo] || DEFAULT_CONTROLES.seguridad)).map(dom => ({
          ...dom,
          _dePlantilla: true,
        }));
        renderControlesInputs();
        llenadosCount++;
      }

      // 5. Herramientas (solo llena si la lista está completamente vacía)
      if (herramientasLocales.length === 0) {
        herramientasLocales = JSON.parse(JSON.stringify(DEFAULT_TOOLS[acta.tipo] || DEFAULT_TOOLS.seguridad)).map(tool => ({
          ...tool,
          _dePlantilla: true,
        }));
        renderHerramientasInputs();
        llenadosCount++;
      }

      if (llenadosCount > 0) {
        toast(`Se autocompletaron ${llenadosCount} campo(s) vacíos con datos de plantilla (resaltados con luz amarilla).`);
      } else {
        toast('Todos los campos ya contenían información. No se sobreescribió ningún dato ingresado.');
      }
    });

    // Agregar nuevo hallazgo manual
    document.getElementById('btn-agregar-hallazgo')?.addEventListener('click', () => {
      const nextNum = hallazgosLocales.length + 1;
      hallazgosLocales.push({
        id: `H-${String(nextNum).padStart(2, '0')}`,
        titulo: 'Nuevo hallazgo identificado',
        severidad: 'medio',
        estado: 'pendiente',
        evidencia: '',
        impacto: '',
        ubicacion: '',
        correccion: '',
        responsable: document.getElementById('edit-firmante-resp-nombre')?.value || d.auditor || '',
        fecha_limite: sumarDias(hoyISO(), 14),
      });
      renderHallazgosInputs();
    });

    // Agregar nueva herramienta manual
    document.getElementById('btn-agregar-herramienta')?.addEventListener('click', () => {
      herramientasLocales.push({
        herramienta: '',
        prioridad: 'Media',
        justificacion: '',
      });
      renderHerramientasInputs();
    });

    document.getElementById('btn-volver-lista-edicion')?.addEventListener('click', async () => {
      _mode = 'list';
      await recargarActas();
      renderBandeja();
    });

    document.getElementById('btn-cancelar-edicion')?.addEventListener('click', () => {
      verActa(acta.id);
    });

    // Guardar cambios
    document.getElementById('btn-guardar-acta')?.addEventListener('click', async () => {
      const saveBtn = document.getElementById('btn-guardar-acta');
      saveBtn.disabled = true;
      saveBtn.innerHTML = `${icon('hourglass_empty', 18)} Guardando...`;

      // Recopilar datos generales
      d.entorno = document.getElementById('edit-entorno').value;
      d.repositorios = document.getElementById('edit-repositorios').value;
      d.alcance = document.getElementById('edit-alcance').value;
      d.metodologia = document.getElementById('edit-metodologia').value;
      d.periodo_desde = document.getElementById('edit-periodo_desde').value;
      d.periodo_hasta = document.getElementById('edit-periodo_hasta').value;
      d.auditor = document.getElementById('edit-auditor').value;
      d.conclusion = document.getElementById('edit-conclusion').value;

      // Firmantes
      d.auditor_cargo = document.getElementById('edit-firmante-aud-cargo').value;
      d.auditor_dni = document.getElementById('edit-firmante-aud-dni').value;
      d.responsable_proyecto = document.getElementById('edit-firmante-resp-nombre').value;
      d.responsable_cargo = document.getElementById('edit-firmante-resp-cargo').value;
      d.responsable_dni = document.getElementById('edit-firmante-resp-dni').value;

      // Sub-listas limpias (eliminar marcadores internos _dePlantilla antes de persistir)
      d.hallazgos = hallazgosLocales.map(({ _dePlantilla, ...resto }) => resto);
      d.controles = controlesLocales.map(({ _dePlantilla, ...resto }) => ({
        ...resto,
        items: (resto.items || []).map(({ _dePlantilla: _dp, ...itResto }) => itResto),
      }));
      d.herramientas = herramientasLocales.map(({ _dePlantilla, ...resto }) => resto);

      // Sincronizar automáticamente el Plan de Remediación con los hallazgos (si existen)
      if (d.hallazgos.length > 0) {
        d.plan_remediacion = d.hallazgos.map(h => ({
          accion: `Corregir ${h.id}: ${h.titulo}`,
          ref: h.id,
          prioridad: h.severidad === 'critico' ? 'Crítico' : h.severidad === 'alto' ? 'Alto' : h.severidad === 'medio' ? 'Medio' : 'Bajo',
          responsable: h.responsable || d.responsable_proyecto || 'Equipo de desarrollo',
          fecha: h.fecha_limite || sumarDias(hoyISO(), 14),
          hecho: ['corregido', 'verificado'].includes(h.estado),
        }));

        d.plan_remediacion.push({
          accion: 'Repetir pruebas sobre hallazgos y verificar remediación técnica',
          ref: 'Todos',
          prioridad: 'Alto',
          responsable: d.auditor || 'Auditor',
          fecha: sumarDias(hoyISO(), 20),
          hecho: false,
        });
      } else {
        d.plan_remediacion = [];
      }

      const projectId = document.getElementById('edit-project_id').value || null;
      const version = document.getElementById('edit-version').value || '1.0';
      const fechaEmision = document.getElementById('edit-fecha_emision').value || hoyISO();

      try {
        await api.put(`/calidad/actas/${acta.id}`, {
          project_id: projectId,
          version,
          fecha_emision: fechaEmision,
          datos: d,
        });
        await recargarActas(); // <-- Sincronizar reactivamente la lista de actas en memoria
        toast('Acta actualizada con éxito');
        await verActa(acta.id);
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `${icon('save', 18)} Guardar Cambios`;
        toast(err.message || 'Error al guardar el acta', 'error');
      }
    });

  } catch (err) {
    toast(err.message || 'Error al cargar formulario de edición', 'error');
    verActa(id);
  }
}

// ─── DESCARGAR ARCHIVO WORD (.doc / .docx compatible) ─────────────────────────
function descargarWord(acta) {
  const cfg = TIPOS_CONFIG[acta.tipo] || TIPOS_CONFIG.seguridad;
  const contenidoHtml = generarHtmlDocumentoWord(acta);

  // Plantilla oficial XML / Word HTML con estilos de página A4 y márgenes
  const docHtml = `
    <!DOCTYPE html>
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${esc(acta.codigo)} - ${cfg.titulo}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page {
          size: 210mm 297mm; /* A4 */
          margin: 15mm 20mm 15mm 20mm;
          mso-header-margin: 10mm;
          mso-footer-margin: 10mm;
        }
        body {
          font-family: 'Calibri', Arial, sans-serif;
          font-size: 10pt;
          color: #1F2937;
          line-height: 1.25;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        td, th {
          font-family: 'Calibri', Arial, sans-serif;
        }
      </style>
    </head>
    <body>
      ${contenidoHtml}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${acta.codigo} - ${cfg.titulo} - QUBIRA.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`Documento Word descargado: ${acta.codigo}.doc`);
}

async function descargarWordPorId(id) {
  try {
    const acta = await api.get(`/calidad/actas/${id}`);
    descargarWord(acta);
  } catch (e) {
    toast('Error al descargar documento Word', 'error');
  }
}

async function imprimirPorId(id) {
  await verActa(id);
  setTimeout(() => window.print(), 300);
}

// ─── ELIMINAR ACTA ────────────────────────────────────────────────────────────
async function eliminarActa(id, codigo) {
  if (!(await confirmModal(`¿Estás seguro de eliminar el acta ${codigo}? Esta acción no se puede deshacer.`, {
    title: 'Eliminar Acta de Auditoría',
    confirmLabel: 'Eliminar definitivamente',
    danger: true,
  }))) return;

  try {
    await api.delete(`/calidad/actas/${id}`);
    toast(`Acta ${codigo} eliminada`);
    await recargarActas();
    renderBandeja();
  } catch (err) {
    toast(err.message || 'Error al eliminar el acta', 'error');
  }
}
