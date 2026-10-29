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

// ─── PLANTILLAS DE SOLUCIONARIO / RESUMEN DE CORRECCIONES ──────────────────
export const PLANTILLAS_SOLUCIONARIO = {
  seguridad: {
    id: 'seguridad',
    nombre: 'Seguridad Fullstack (Web + API — Caso Express / Neon / Vercel)',
    subtitulo: 'Correcciones de endpoints, rate-limit, CORS, sesiones y hardening de base de datos',
    badgeCls: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    descripcionIntroductoria: 'He trabajado directamente sobre el código de WEB y API y verifiqué cada cambio (conexión real a Neon, servidor levantado localmente, pruebas de login/CORS/rate-limit). Esto es lo que quedó:',
    secciones: [
      {
        severidad: 'critico',
        label: '🔴 Críticos',
        colorBadge: '#C0392B',
        items: [
          { ref: 'H-02', hallazgo: 'Admin con contraseña débil', accion: 'Contraseña cambiada en producción (ver credencial abajo) y cerré las 4 sesiones admin activas con la contraseña vieja — quien estuviera conectado tendrá que volver a entrar.' },
          { ref: 'H-03', hallazgo: 'CORS abierto a cualquier origen', accion: 'Código corregido: ya falla cerrado si CORS_ORIGIN no está definida. ⚠️ Esto es lo primero que debes revisar — ver "Acción urgente" abajo.' },
          { ref: 'H-04', hallazgo: 'Sin rate limiting', accion: 'Instalé express-rate-limit: límite global (300/15min) + límite estricto en los 5 logins (10/15min) + PIN de entrega (15/15min) + consultas DNI/CE (20/15min). Probado: al 10.º intento de login ya responde 429.' },
          { ref: 'H-05', hallazgo: 'proxy-addr vulnerable', accion: 'npm audit fix ejecutado → 0 vulnerabilidades.' },
          { ref: 'H-01, H-06, H-07', hallazgo: 'Repos públicos / XSS / fallbacks simulados', accion: 'Ya estaban cubiertos de sesiones anteriores (o requieren acción tuya, ver abajo).' },
        ],
      },
      {
        severidad: 'alto',
        label: '🟠 Altos',
        colorBadge: '#E67E22',
        items: [
          { ref: 'H-08 / H-09', hallazgo: 'Pedidos sin autenticación adecuada', accion: 'Ahora, si el pedido pertenece a un cliente con cuenta, GET /pedidos/:id y POST /pedidos/:id/pago exigen el token de ese cliente. Los pedidos de invitado (sin cuenta) siguen funcionando por enlace/UUID, que es el diseño actual de checkout sin registro — no lo rompí. Ajusté también js/api.js en WEB para que esas dos llamadas manden el token cuando existe.' },
          { ref: 'H-10', hallazgo: '2FA / Doble Factor pendiente', accion: 'No lo puedo activar yo — necesita tu sesión en cada plataforma (GitHub, Vercel, Neon). Procedimiento detallado en guía de hardening.' },
        ],
      },
      {
        severidad: 'medio',
        label: '🟡 Medios',
        colorBadge: '#F1C40F',
        items: [
          { ref: 'H-12', hallazgo: 'Precio / stock negativos en transacciones', accion: 'Agregué validación en la API con mensaje claro. (Dato: la base de datos ya tenía CHECK (precio >= 0) y CHECK (stock >= 0), así que nunca se pudo insertar un valor negativo — solo se veía un error 500 feo en vez de un 400 claro. Ya corregido.)' },
          { ref: 'H-13', hallazgo: 'TLS sin validar hacia Neon', accion: 'Cambié rejectUnauthorized: false → true y verifiqué la conexión real — sigue funcionando perfecto.' },
          { ref: 'H-14', hallazgo: 'Errores internos expuestos (stack trace)', accion: 'El manejador global de errores ya no filtra err.message en errores 500; además agregué try/catch a las dos rutas de admin.js que no lo tenían.' },
          { ref: 'H-15', hallazgo: 'Cambio de contraseña no cierra otras sesiones', accion: 'Ahora cliente, tienda y repartidor cierran automáticamente todas sus otras sesiones al cambiar su contraseña.' },
          { ref: 'H-16 / H-17', hallazgo: 'Sin CSP ni cabeceras anti-clickjacking', accion: 'Creé vercel.json con Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options, Strict-Transport-Security y Referrer-Policy, cubriendo todo el sitio.' },
          { ref: 'H-18', hallazgo: 'Protección de ramas y secretos en Git', accion: 'Requiere configuración de branch protection rules en la interfaz de GitHub.' },
          { ref: 'H-11', hallazgo: 'Enumeración por mensajes de login', accion: 'Revisé a fondo — decidí no fusionar el mensaje "cuenta inactiva" con el genérico, porque solo se revela después de que ya se acertó la contraseña real (no es explotable por simple adivinanza de email), y perderlo rompe la UX de tiendas/repartidores pendientes de activación. El rate limiting que ya instalé es la mitigación real aquí.' },
        ],
      },
      {
        severidad: 'bajo',
        label: '⚪ Bajos',
        colorBadge: '#27AE60',
        items: [
          { ref: 'H-19', hallazgo: 'Enlaces externos sin rel seguro', accion: 'Los 3 target="_blank" ahora tienen rel="noopener noreferrer".' },
          { ref: 'H-20', hallazgo: 'UPDATE de productos vulnerable a sobreescritura', accion: 'El UPDATE de productos en tienda.js ahora incluye AND tienda_id = $14 en el propio WHERE, no solo en el SELECT previo.' },
          { ref: 'H-21', hallazgo: 'Falta de autocompletado semántico en contraseñas', accion: 'Agregué autocomplete="current-password" / "new-password" a los 3 campos de mi-cuenta.html.' },
        ],
      },
    ],
    credenciales: {
      titulo: '🔑 Nueva contraseña admin (guárdala ahora, no la volveré a mostrar)',
      usuario: 'admin@express-ancon.pe',
      password: '7BCX@QipRqZkSLJVCn',
      nota: 'Guárdala en un gestor de contraseñas. Ya no es texto predecible.',
    },
  },
  calidad: {
    id: 'calidad',
    nombre: 'Calidad de Software & Refactorización Modular',
    subtitulo: 'Optimización de base de datos Neon, arquitectura limpia y pruebas automatizadas',
    badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    descripcionIntroductoria: 'Se intervino el código fuente de los módulos afectados para eliminar deuda técnica, optimizar consultas de latencia en Neon y desacoplar componentes monolíticos:',
    secciones: [
      {
        severidad: 'critico',
        label: '🔴 Críticos',
        colorBadge: '#C0392B',
        items: [
          { ref: 'CAL-01', hallazgo: 'Memory Leak y acumulación de clientes en Pool Postgres', accion: 'Implementado release explícito en bloques try/finally y configuración de client_idle_timeout = 10000ms en Neon.' },
          { ref: 'CAL-02', hallazgo: 'Inyección de consultas por concatenación de cadenas', accion: 'Todas las consultas SQL migradas a Prepared Statements parametrizados ($1, $2) con validación estricta de tipos.' },
          { ref: 'CAL-03', hallazgo: 'Promesas asíncronas no capturadas (Unhandled Rejections)', accion: 'Encapsulación de middleware asyncRoute con captura centralizada de excepciones para evitar caídas del proceso Node.js.' },
        ],
      },
      {
        severidad: 'alto',
        label: '🟠 Altos',
        colorBadge: '#E67E22',
        items: [
          { ref: 'CAL-04', hallazgo: 'Acoplamiento excesivo y controladores de más de 800 líneas', accion: 'Separación arquitectónica de responsabilidades en Servicios de Negocio puros y Controladores HTTP delgados.' },
          { ref: 'CAL-05', hallazgo: 'Cero cobertura de pruebas automatizadas', accion: 'Configurado framework Jest + Supertest con 28 pruebas unitarias de endpoints de pagos, stock y autenticación.' },
        ],
      },
      {
        severidad: 'medio',
        label: '🟡 Medios',
        colorBadge: '#F1C40F',
        items: [
          { ref: 'CAL-06', hallazgo: 'Logs con console.log en producción sin nivel ni timestamp', accion: 'Implementado logger Winston en formato JSON estructurado con correlación por request-id.' },
          { ref: 'CAL-07', hallazgo: 'Bundle frontend sin minificación ni lazy loading', accion: 'Implementada carga modular dinámica de scripts pesados, reduciendo el First Contentful Paint de 3.2s a 0.9s.' },
          { ref: 'CAL-08', hallazgo: 'Falta de validación de payloads de entrada', accion: 'Integrado validador Zod en todas las rutas POST/PUT para asegurar esquemas y evitar entradas malformadas.' },
        ],
      },
      {
        severidad: 'bajo',
        label: '⚪ Bajos',
        colorBadge: '#27AE60',
        items: [
          { ref: 'CAL-09', hallazgo: 'Clases CSS redundantes y fuentes duplicadas', accion: 'Limpieza de reglas CSS obsoletas y normalización de variables de diseño corporativo.' },
          { ref: 'CAL-10', hallazgo: 'Funciones públicas sin documentación técnica', accion: 'Añadidos bloques JSDoc exhaustivos con declaración de tipos, parámetros y tipos de retorno.' },
        ],
      },
    ],
    credenciales: null,
  },
  reglas: {
    id: 'reglas',
    nombre: 'Reglas de Negocio & Control Transaccional',
    subtitulo: 'Consistencia contable, idempotencia en pasarelas de pago y auditoría inmutable',
    badgeCls: 'bg-purple-100 text-purple-800 border-purple-200',
    descripcionIntroductoria: 'Se blindaron las reglas comerciales y financieras contra condiciones de carrera, alteración de precios por clientes y desincronización de pedidos:',
    secciones: [
      {
        severidad: 'critico',
        label: '🔴 Críticos',
        colorBadge: '#C0392B',
        items: [
          { ref: 'RN-01', hallazgo: 'Doble gasto / duplicidad de pagos ante reintentos de cliente', accion: 'Implementado header obligatorio Idempotency-Key con bloqueo Redis/Postgres y expiración a 24 horas.' },
          { ref: 'RN-02', hallazgo: 'Sobreventa de inventario bajo concurrencia pico', accion: 'Bloqueo a nivel de fila SELECT ... FOR UPDATE en la tabla de productos durante la transacción de checkout.' },
          { ref: 'RN-03', hallazgo: 'Alteración de total y descuentos manipulando el cliente', accion: 'El backend ignora cualquier precio o total enviado por el frontend y recalcula desde la base de datos de precios vigentes.' },
        ],
      },
      {
        severidad: 'alto',
        label: '🟠 Altos',
        colorBadge: '#E67E22',
        items: [
          { ref: 'RN-04', hallazgo: 'Anulación de transacciones sin registro de auditoría', accion: 'Trigger inmutable en tabla pedidos_historial que registra fecha, usuario, motivo y estado previo en cada anulación.' },
          { ref: 'RN-05', hallazgo: 'Transiciones de estado ilegales en pedidos', accion: 'Máquina de estados finita validada: pedidos entregados o cancelados no pueden ser reabiertos ni modificados.' },
        ],
      },
      {
        severidad: 'medio',
        label: '🟡 Medios',
        colorBadge: '#F1C40F',
        items: [
          { ref: 'RN-06', hallazgo: 'Discrepancias centesimales en cálculo de IGV (18%)', accion: 'Estandarizado cálculo con Math.round a 2 decimales según normativa tributaria SUNAT.' },
          { ref: 'RN-07', hallazgo: 'Cupones de descuento redimibles múltiples veces en paralelo', accion: 'Incremento atómico del contador de canjes dentro de la transacción de pago.' },
          { ref: 'RN-08', hallazgo: 'Comisiones de repartidor sin tope ni trazabilidad', accion: 'Validada fórmula de comisiones por distancia con tarifa base fija y tope por zona.' },
        ],
      },
      {
        severidad: 'bajo',
        label: '⚪ Bajos',
        colorBadge: '#27AE60',
        items: [
          { ref: 'RN-09', hallazgo: 'Formateo inconsistente de símbolos de moneda', accion: 'Estandarizado a "S/ #,##0.00" en todos los comprobantes, reportes y vistas de clientes.' },
          { ref: 'RN-10', hallazgo: 'Mensajes de rechazo de pago confusos para el comprador', accion: 'Mapeo amigable de códigos de error de pasarela (fondos insuficientes, tarjeta expirada, etc.).' },
        ],
      },
    ],
    credenciales: null,
  },
};

// ─── Estado local del módulo ──────────────────────────────────────────────────
let _actas = [];
let _projects = [];
let _filters = { tipo: '', estado: '', project_id: '', q: '' };
let _currentActa = null;
let _mode = 'list'; // 'list' | 'view' | 'edit'
let _solucionariosAbiertos = new Set();
let _actaRecienCreadaId = null;

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hoyHoraFormateada() {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${anio} ${hora}:${min}`;
}

function obtenerSolucionarioActa(acta) {
  if (acta.datos?.solucionario?.contenido) {
    return acta.datos.solucionario;
  }
  const key = acta.tipo && PLANTILLAS_SOLUCIONARIO[acta.tipo] ? acta.tipo : 'seguridad';
  const plantilla = PLANTILLAS_SOLUCIONARIO[key];
  return {
    plantilla_id: key,
    fecha_publicacion: fmtDate(acta.fecha_emision),
    contenido: JSON.parse(JSON.stringify(plantilla)),
  };
}

function generarTextoPlanoSolucionario(sol, acta) {
  const cont = sol.contenido || sol;
  let txt = `Resumen de lo corregido — ${acta.codigo}\n`;
  txt += `${cont.descripcionIntroductoria || ''}\n\n`;
  (cont.secciones || []).forEach(sec => {
    txt += `${sec.label}\n#\tHallazgo\tAcción\n`;
    (sec.items || []).forEach(it => {
      txt += `${it.ref}\t${it.hallazgo}\t${it.accion}\n`;
    });
    txt += `\n`;
  });
  if (cont.credenciales) {
    txt += `${cont.credenciales.titulo}\nUsuario: ${cont.credenciales.usuario}\nContraseña: ${cont.credenciales.password}\n${cont.credenciales.nota}\n\n`;
  }
  txt += `Fecha de publicación: ${sol.fecha_publicacion || fmtDate(acta.fecha_emision)}`;
  return txt;
}

function renderPanelSolucionario(a) {
  const sol = obtenerSolucionarioActa(a);
  const cont = sol.contenido || sol;
  const fechaPub = sol.fecha_publicacion || fmtDate(a.fecha_emision);
  const cfg = TIPOS_CONFIG[a.tipo] || TIPOS_CONFIG.seguridad;

  return `
    <div class="p-4 sm:p-6 bg-white rounded-2xl border border-gray-200/90 shadow-lg space-y-4 my-2 mx-2">
      <!-- Encabezado del Solucionario -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <span class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-sm">
            ${icon('task_alt', 22)}
          </span>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="font-bold text-gray-900 text-base">Resumen de lo Corregido</h4>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badgeCls}">${cfg.label}</span>
              <span class="font-mono text-xs text-gray-500 font-semibold">#${esc(a.codigo)}</span>
            </div>
            <p class="text-xs text-gray-500 mt-0.5">Solucionario de auditoría técnica verificado directamente sobre el código fuente</p>
          </div>
        </div>

        <!-- Al costado de la visualización: Selector de plantillas y Fecha de Publicación -->
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <!-- Selector de Plantillas -->
          <div class="flex items-center gap-1 bg-gray-100/90 p-1 rounded-xl text-xs font-medium border border-gray-200/60">
            <span class="text-gray-500 px-2 flex items-center gap-1 font-semibold text-[11px]">
              ${icon('style', 14)} Plantilla:
            </span>
            <button
              type="button"
              data-action="cambiar-plantilla-sol"
              data-id="${a.id}"
              data-plantilla="seguridad"
              class="px-2.5 py-1 rounded-lg transition-all ${sol.plantilla_id === 'seguridad' || (!sol.plantilla_id && a.tipo === 'seguridad') ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'}"
              title="Cargar plantilla de Seguridad Web + API"
            >
              Seguridad
            </button>
            <button
              type="button"
              data-action="cambiar-plantilla-sol"
              data-id="${a.id}"
              data-plantilla="calidad"
              class="px-2.5 py-1 rounded-lg transition-all ${sol.plantilla_id === 'calidad' || (!sol.plantilla_id && a.tipo === 'calidad') ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'}"
              title="Cargar plantilla de Calidad & Refactorización"
            >
              Calidad
            </button>
            <button
              type="button"
              data-action="cambiar-plantilla-sol"
              data-id="${a.id}"
              data-plantilla="reglas"
              class="px-2.5 py-1 rounded-lg transition-all ${sol.plantilla_id === 'reglas' || (!sol.plantilla_id && a.tipo === 'reglas') ? 'bg-white text-purple-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'}"
              title="Cargar plantilla de Reglas de Negocio"
            >
              Reglas
            </button>
          </div>

          <!-- FECHA DE PUBLICACIÓN AL COSTADO DE LA VISUALIZACIÓN -->
          <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-900 text-xs font-semibold shadow-sm">
            <span class="material-icons text-blue-600 text-sm">event</span>
            <span>Publicado: <span class="font-bold font-mono">${esc(fechaPub)}</span></span>
          </div>

          <!-- Botón de Copiar -->
          <button
            type="button"
            data-action="copiar-solucionario"
            data-id="${a.id}"
            class="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 text-gray-700 hover:text-gray-900 shadow-sm"
            title="Copiar resumen estructurado al portapapeles"
          >
            ${icon('content_copy', 14)} Copiar
          </button>
        </div>
      </div>

      <!-- Texto introductorio -->
      <div class="p-3 bg-gray-50/90 rounded-xl border border-gray-100 text-xs sm:text-sm text-gray-700 leading-relaxed font-normal flex items-start gap-2.5">
        <span class="material-icons text-emerald-600 text-lg mt-0.5 shrink-0">check_circle</span>
        <div>
          <p class="font-bold text-gray-900 mb-0.5">${esc(cont.nombre || 'Resumen de lo corregido')}</p>
          <p class="text-gray-600">${esc(cont.descripcionIntroductoria || '')}</p>
        </div>
      </div>

      <!-- Tarjetas por severidad -->
      <div class="grid grid-cols-1 gap-3.5">
        ${(cont.secciones || []).map(sec => `
          <div class="rounded-xl border p-3.5 transition-all shadow-sm ${
            sec.severidad === 'critico' ? 'bg-red-50/20 border-red-200' :
            sec.severidad === 'alto' ? 'bg-amber-50/20 border-amber-200' :
            sec.severidad === 'medio' ? 'bg-yellow-50/20 border-yellow-200' :
            'bg-slate-50/40 border-slate-200'
          }">
            <div class="flex items-center justify-between mb-2.5 border-b pb-1.5 ${
              sec.severidad === 'critico' ? 'border-red-200/60' :
              sec.severidad === 'alto' ? 'border-amber-200/60' :
              sec.severidad === 'medio' ? 'border-yellow-200/60' :
              'border-slate-200/60'
            }">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold ${
                  sec.severidad === 'critico' ? 'text-red-800' :
                  sec.severidad === 'alto' ? 'text-amber-800' :
                  sec.severidad === 'medio' ? 'text-yellow-900' :
                  'text-slate-700'
                }">${sec.label}</span>
                <span class="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white border ${
                  sec.severidad === 'critico' ? 'text-red-700 border-red-200' :
                  sec.severidad === 'alto' ? 'text-amber-700 border-amber-200' :
                  sec.severidad === 'medio' ? 'text-yellow-800 border-yellow-300' :
                  'text-slate-600 border-slate-200'
                }">${sec.items?.length || 0} acciones</span>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead>
                  <tr class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200/40">
                    <th class="py-1.5 px-2 w-24">#</th>
                    <th class="py-1.5 px-2 w-1/4">Hallazgo</th>
                    <th class="py-1.5 px-2">Acción / Solución Aplicada</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  ${(sec.items || []).map(it => `
                    <tr class="hover:bg-white/80 transition-colors">
                      <td class="py-2 px-2 font-mono font-bold text-gray-900 whitespace-nowrap align-top">${esc(it.ref)}</td>
                      <td class="py-2 px-2 font-semibold text-gray-800 align-top">${esc(it.hallazgo)}</td>
                      <td class="py-2 px-2 text-gray-600 leading-relaxed align-top">${esc(it.accion)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Bloque de Credenciales Seguras (si aplica) -->
      ${cont.credenciales ? `
        <div class="rounded-xl p-4 bg-slate-900 text-white border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2 font-bold text-sm text-amber-400">
              <span class="material-icons text-amber-400 text-base">key</span>
              ${esc(cont.credenciales.titulo)}
            </div>
            <div class="flex flex-wrap items-center gap-3 text-xs pt-1 font-mono">
              <span class="text-slate-300">Usuario: <strong class="text-white">${esc(cont.credenciales.usuario)}</strong></span>
              <span class="text-slate-500">•</span>
              <span class="text-slate-300">Contraseña: <strong class="text-emerald-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">${esc(cont.credenciales.password)}</strong></span>
            </div>
            <p class="text-[11px] text-slate-400 italic pt-0.5">${esc(cont.credenciales.nota)}</p>
          </div>
          <button
            type="button"
            data-action="copiar-pwd"
            data-pwd="${esc(cont.credenciales.password)}"
            class="btn-secondary text-xs py-2 px-3.5 bg-slate-800 hover:bg-slate-700 text-white border-slate-700 shrink-0 inline-flex items-center gap-1.5 transition-colors"
            title="Copiar contraseña al portapapeles"
          >
            ${icon('content_copy', 14)} Copiar Credencial
          </button>
        </div>
      ` : ''}
    </div>
  `;
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
  c.querySelectorAll('[data-action="txt"]').forEach(btn => {
    btn.addEventListener('click', () => descargarTxtPorId(btn.dataset.id));
  });
  c.querySelectorAll('[data-action="pdf"]').forEach(btn => {
    btn.addEventListener('click', () => imprimirPorId(btn.dataset.id));
  });
  c.querySelectorAll('[data-action="eliminar"]').forEach(btn => {
    btn.addEventListener('click', () => eliminarActa(btn.dataset.id, btn.dataset.codigo));
  });

  // Listeners del Solucionario desplegable
  c.querySelectorAll('[data-action="toggle-solucionario"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const row = document.getElementById(`fila-solucionario-${id}`);
      if (!row) return;
      if (row.classList.contains('hidden')) {
        row.classList.remove('hidden');
        _solucionariosAbiertos.add(id);
      } else {
        row.classList.add('hidden');
        _solucionariosAbiertos.delete(id);
      }
    });
  });

  c.querySelectorAll('[data-action="cambiar-plantilla-sol"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const plantillaKey = btn.dataset.plantilla;
      const acta = _actas.find(x => x.id === id);
      if (!acta) return;

      const nuevaPlantilla = PLANTILLAS_SOLUCIONARIO[plantillaKey];
      if (!nuevaPlantilla) return;

      const datosActualizados = JSON.parse(JSON.stringify(acta.datos || {}));
      datosActualizados.solucionario = {
        plantilla_id: plantillaKey,
        fecha_publicacion: hoyHoraFormateada(),
        contenido: JSON.parse(JSON.stringify(nuevaPlantilla)),
      };

      try {
        await api.put(`/calidad/actas/${id}`, {
          datos: datosActualizados,
        });
        toast(`Plantilla de solucionario cambiada a ${nuevaPlantilla.nombre}`);
        await recargarActas();
        _solucionariosAbiertos.add(id);
        renderBandeja();
      } catch (e) {
        toast(e.message || 'Error al cambiar plantilla', 'error');
      }
    });
  });

  c.querySelectorAll('[data-action="copiar-solucionario"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const acta = _actas.find(x => x.id === id);
      if (!acta) return;
      const sol = obtenerSolucionarioActa(acta);
      const texto = generarTextoPlanoSolucionario(sol, acta);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(texto).then(() => {
          toast('Resumen de lo corregido copiado al portapapeles');
        }).catch(() => {
          toast('No se pudo copiar automáticamente', 'error');
        });
      }
    });
  });

  c.querySelectorAll('[data-action="copiar-pwd"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pwd = btn.dataset.pwd;
      if (!pwd) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(pwd).then(() => {
          toast('Contraseña copiada al portapapeles');
        });
      }
    });
  });
}

function renderFilaActa(a) {
  const cfg = TIPOS_CONFIG[a.tipo] || TIPOS_CONFIG.seguridad;
  const est = ESTADOS_CONFIG[a.estado] || ESTADOS_CONFIG.borrador;
  const res = a.resumen || { severidad: { critico: 0, alto: 0, medio: 0, bajo: 0 } };
  const s = res.severidad || {};
  const estaAbierto = _solucionariosAbiertos.has(a.id) || a.id === _actaRecienCreadaId;

  return `
    <tr class="hover:bg-blue-50/40 transition-colors ${estaAbierto ? 'bg-emerald-50/20' : ''}">
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
        ${Array.isArray(a.datos?.proyectos) && a.datos.proyectos.length > 1 ? `
          <div class="space-y-1">
            <div class="flex flex-wrap gap-1 items-center">
              ${a.datos.proyectos.map(p => `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 text-xs font-semibold" title="${esc(p.name)} (${esc(p.code || 'S/C')})">
                  ${esc(p.name)} <span class="font-mono text-[10px] text-blue-500 font-normal">(${esc(p.code || 'S/C')})</span>
                </span>
              `).join('')}
            </div>
            <div class="text-xs text-gray-500">${esc(a.project_client || a.datos?.proyectos[0]?.client || 'QUBIRA interno')}</div>
          </div>
        ` : `
          <div class="font-medium text-gray-900">${esc(a.project_name || 'Sin proyecto vinculado')}</div>
          <div class="text-xs text-gray-500">${esc(a.project_client || a.project_code || 'QUBIRA interno')}</div>
        `}
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
          <button data-action="toggle-solucionario" data-id="${a.id}" class="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" title="Ver / Ocultar Resumen de lo Corregido (Solucionario)">
            ${icon('task_alt', 18)}
          </button>
          <button data-action="ver" data-id="${a.id}" class="p-1.5 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-100" title="Ver documento fiel">
            ${icon('visibility', 18)}
          </button>
          <button data-action="editar" data-id="${a.id}" class="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-gray-100" title="Editar acta">
            ${icon('edit', 18)}
          </button>
          <button data-action="word" data-id="${a.id}" class="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-100" title="Descargar Word (.doc)">
            ${icon('article', 18)}
          </button>
          <button data-action="txt" data-id="${a.id}" class="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100" title="Descargar Bloc de notas (.txt)">
            ${icon('description', 18)}
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
    <!-- Fila desplegable del Resumen de lo Corregido (Solucionario) -->
    <tr id="fila-solucionario-${a.id}" class="fila-solucionario ${estaAbierto ? '' : 'hidden'} bg-gradient-to-b from-gray-50/70 to-white border-b-2 border-emerald-200">
      <td colspan="9" class="p-0">
        ${renderPanelSolucionario(a)}
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
          <span>Proyectos a Auditar (Permite 1 o más proyectos)</span>
          <span id="label-proyectos-seleccionados-count" class="text-[11px] font-semibold text-primary-700 font-mono">0 seleccionados</span>
        </label>

        <!-- Contenedor interactivo de Chips / Etiquetas de proyectos -->
        <div id="contenedor-chips-proyectos" class="flex flex-wrap gap-1.5 p-2 bg-gray-50 border border-gray-200 rounded-xl min-h-[44px] mb-2 items-center transition-all">
          <span id="chips-placeholder" class="text-xs text-gray-400 italic">Escribe abajo para buscar y seleccionar proyectos (ej. WEB + API)...</span>
        </div>

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
              placeholder="Escribe para buscar proyecto por nombre, código o cliente para agregar..."
              autocomplete="off"
              spellcheck="false"
            >
            <button
              type="button"
              id="btn-limpiar-proyecto-search"
              class="absolute right-2.5 text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 hidden transition-colors"
              title="Borrar texto"
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
        <p class="text-xs text-gray-400 mt-1">Permite seleccionar 2 o más partes si el sistema está modularizado (ej. WEB y API). Se extraerán repositorios y entornos combinados.</p>
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

  // Buscador y selección múltiple de proyectos
  const inputSearch = document.getElementById('new-project-search');
  const hiddenId = document.getElementById('new-project_id');
  const dropdown = document.getElementById('new-project-dropdown');
  const btnLimpiar = document.getElementById('btn-limpiar-proyecto-search');

  let proyectosSeleccionados = [];

  function actualizarChipsProyectos() {
    const cont = document.getElementById('contenedor-chips-proyectos');
    const countLabel = document.getElementById('label-proyectos-seleccionados-count');
    if (!cont) return;

    if (proyectosSeleccionados.length === 0) {
      cont.innerHTML = `<span id="chips-placeholder" class="text-xs text-gray-400 italic">Escribe abajo para buscar y seleccionar proyectos (ej. WEB + API)...</span>`;
      if (countLabel) countLabel.textContent = '0 seleccionados';
      if (hiddenId) hiddenId.value = '';
      return;
    }

    if (countLabel) {
      countLabel.textContent = `${proyectosSeleccionados.length} seleccionado${proyectosSeleccionados.length > 1 ? 's' : ''}`;
    }
    if (hiddenId) {
      hiddenId.value = proyectosSeleccionados[0].id;
    }

    cont.innerHTML = proyectosSeleccionados.map((p, idx) => `
      <span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-primary-100/90 text-primary-900 border border-primary-200 text-xs font-medium shadow-xs">
        <span class="font-bold">${esc(p.name)}</span>
        <span class="font-mono text-[10px] text-primary-600 font-semibold bg-white/80 px-1 py-0.5 rounded">(${esc(p.code || 'S/C')})</span>
        <button type="button" data-remove-idx="${idx}" class="btn-quitar-chip text-primary-400 hover:text-red-600 hover:bg-red-50 rounded p-0.5 ml-0.5 transition-colors" title="Quitar proyecto">
          ${icon('close', 14)}
        </button>
      </span>
    `).join('');

    cont.querySelectorAll('.btn-quitar-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.removeIdx, 10);
        proyectosSeleccionados.splice(idx, 1);
        actualizarChipsProyectos();
        renderOpcionesProyecto(inputSearch.value);
      });
    });
  }

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
      const isSelected = proyectosSeleccionados.some(x => x.id === p.id);
      return `
        <div
          class="p-2.5 hover:bg-primary-50 cursor-pointer flex items-center justify-between transition-colors option-proj-item ${isSelected ? 'bg-primary-50/90 border-l-4 border-primary-600' : ''}"
          data-id="${p.id}"
        >
          <div class="min-w-0 pr-2">
            <div class="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
              ${isSelected ? `<span class="text-primary-600 font-bold text-xs">✓</span>` : ''}
              <span>${esc(p.name)}</span>
            </div>
            <div class="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
              <span class="font-medium text-gray-700">${esc(p.client || 'Interno')}</span>
              ${p.code ? `<span class="text-gray-300">•</span><span class="font-mono text-gray-400">Código: ${esc(p.code)}</span>` : ''}
            </div>
          </div>
          <div class="shrink-0 flex items-center gap-1.5">
            ${p.code ? `<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-gray-100 text-gray-700 font-semibold">${esc(p.code)}</span>` : ''}
            <span class="text-xs ${isSelected ? 'text-primary-700 font-semibold' : 'text-gray-400'}">${isSelected ? 'Agregado' : '+ Agregar'}</span>
          </div>
        </div>
      `;
    }).join('');

    dropdown.querySelectorAll('.option-proj-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const targetProj = _projects.find(x => x.id === id);
        if (!targetProj) return;

        const yaEsta = proyectosSeleccionados.some(x => x.id === id);
        if (yaEsta) {
          proyectosSeleccionados = proyectosSeleccionados.filter(x => x.id !== id);
        } else {
          proyectosSeleccionados.push(targetProj);
        }

        actualizarChipsProyectos();
        inputSearch.value = '';
        btnLimpiar?.classList.add('hidden');
        inputSearch.focus();
        renderOpcionesProyecto('');
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
    renderOpcionesProyecto(inputSearch.value);
  });

  inputSearch?.addEventListener('input', (e) => {
    activeIndex = -1;
    const val = e.target.value;
    if (!val) {
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
    inputSearch.value = '';
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
    const projectId = proyectosSeleccionados.length > 0 ? proyectosSeleccionados[0].id : null;
    const auditor = document.getElementById('new-auditor').value.trim() || user?.name || 'Abraham Aranda Cerna';
    const fechaEmision = document.getElementById('new-fecha_emision').value || hoyISO();

    const cfg = TIPOS_CONFIG[tipo];

    // Combinar repositorios y entornos de todos los proyectos seleccionados
    const reposList = proyectosSeleccionados
      .map(p => p.github_url ? `${p.name}: ${p.github_url}` : null)
      .filter(Boolean)
      .join(' · ');

    const entornosList = proyectosSeleccionados
      .map(p => p.website_url ? `${p.name}: ${p.website_url}` : (p.name ? `${p.name}: Producción` : null))
      .filter(Boolean)
      .join(' · ');

    const respNombres = proyectosSeleccionados
      .map(p => p.responsible_name)
      .filter(Boolean)
      .join(' / ');

    const plantillaSel = PLANTILLAS_SOLUCIONARIO[tipo] || PLANTILLAS_SOLUCIONARIO.seguridad;

    // Estructura inicial del acta con campos en blanco y plantilla de solucionario desplegada
    const datosIniciales = {
      tipo,
      fecha_emision: fechaEmision,
      version: '1.0',
      clasificacion: 'Confidencial',
      auditor,
      auditor_dni: '',
      auditor_cargo: '',
      responsable_proyecto: respNombres || (proyectosSeleccionados[0]?.responsible_name || ''),
      responsable_dni: '',
      responsable_cargo: '',
      entorno: entornosList || '',
      repositorios: reposList || '',
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
      proyectos_ids: proyectosSeleccionados.map(p => p.id),
      proyectos: proyectosSeleccionados.map(p => ({
        id: p.id,
        name: p.name,
        code: p.code || 'S/C',
        client: p.client || 'Interno',
        github_url: p.github_url || '',
        website_url: p.website_url || '',
        responsible_name: p.responsible_name || '',
      })),
      solucionario: {
        plantilla_id: tipo,
        fecha_publicacion: hoyHoraFormateada(),
        contenido: JSON.parse(JSON.stringify(plantillaSel)),
      },
    };

    try {
      const resp = await api.post('/calidad/actas', {
        tipo,
        project_id: projectId,
        datos: datosIniciales,
      });
      closeModal();
      _solucionariosAbiertos.add(resp.id);
      _actaRecienCreadaId = resp.id;
      _mode = 'list';
      await recargarActas();
      renderBandeja();
      toast(`Acta ${resp.codigo} creada con solucionario desplegado exitosamente`);
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

            <button id="btn-descargar-txt" class="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-3 text-gray-700 border-gray-300 hover:bg-gray-50" title="Descargar como texto plano para el Bloc de notas">
              ${icon('description', 18)} Bloc de notas (.txt)
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
    document.getElementById('btn-descargar-txt')?.addEventListener('click', () => descargarTxt(acta));
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
  const conformes = Array.isArray(d.conformes) ? d.conformes : [];

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
            <p style="margin:1pt;line-height:1.15;"><span style="font-weight:bold;color:#1F2937;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">${esc(d.proyecto_nombre || acta.project_name || 'Proyecto QUBIRA')}</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;background:#EAF1F8;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="font-weight:bold;color:#1F3A5F;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">Cliente</span></p>
          </td>
          <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;vertical-align:middle;">
            <p style="margin:1pt;line-height:1.15;"><span style="color:#1F2937;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">${esc(d.cliente || acta.project_client || 'QUBIRA interno')}</span></p>
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
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;color:#1F2937;">${esc(h.detalle || h.titulo)}</td>
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
    ${bajos.length ? `
    <p style="margin:2pt 0 3pt;"><span style="font-weight:bold;color:#1F2937;font-size:9.5pt;font-family:'Calibri', Arial, sans-serif;">Bajos:</span></p>
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 8pt 0;">
      <colgroup><col style="width:12%"><col style="width:38%"><col style="width:25%"><col style="width:25%"></colgroup>
      <thead><tr>
        <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">N.º</span></th>
        <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Hallazgo</span></th>
        <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Ubicación</span></th>
        <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Corrección</span></th>
      </tr></thead>
      <tbody>${bajos.map(h => `<tr>
        <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-weight:bold;color:#1F3A5F;font-size:9pt;">${esc(h.id)}</td>
        <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;color:#1F2937;">${esc(h.detalle || h.titulo)}</td>
        <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#4B5563;">${esc(h.ubicacion || '—')}</td>
        <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#1F2937;">${esc(h.correccion || '—')}</td>
      </tr>`).join('')}</tbody>
    </table>` : ''}
    ${conformes.length || !bajos.length ? `
    ${bajos.length ? '<p style="margin:2pt 0 3pt;"><span style="font-weight:bold;color:#1F2937;font-size:9.5pt;font-family:\'Calibri\', Arial, sans-serif;">Controles conformes:</span></p>' : ''}
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 12pt 0;">
      <colgroup><col style="width:25%"><col style="width:20%"><col style="width:55%"></colgroup>
      <thead><tr>
        <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Área / Dominio</span></th>
        <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Resultado</span></th>
        <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;padding:3.5pt 5.5pt;text-align:left;"><span style="font-weight:bold;color:#FFFFFF;font-size:9pt;">Observación</span></th>
      </tr></thead>
      <tbody>${(conformes.length ? conformes : [{ area: 'Arquitectura y Código', resultado: 'Conforme', observacion: 'Cumple con la estructura base de seguridad y calidad del proyecto.' }]).map(c => `<tr>
        <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;font-weight:bold;color:#1F3A5F;">${esc(c.area)}</td>
        <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:9pt;font-weight:bold;color:${/no conforme/i.test(c.resultado) ? '#C0392B' : /riesgo/i.test(c.resultado) ? '#E67E22' : '#27AE60'};">${esc(c.resultado || 'Conforme')}</td>
        <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;font-size:8.5pt;color:#4B5563;">${esc(c.observacion || '')}</td>
      </tr>`).join('')}</tbody>
    </table>` : ''}

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
                  ${it.codigo ? `<span style="font-weight:bold;color:#2E6DA4;">${esc(it.codigo)}</span> &nbsp;` : ''}${esc(it.control)}
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
            <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5.5pt;text-align:center;font-size:8.5pt;font-weight:bold;color:${p.prioridad === 'Crítico' ? '#C0392B' : p.prioridad === 'Alto' ? '#E67E22' : p.prioridad === 'Medio' ? '#B7950B' : p.prioridad === 'Bajo' ? '#27AE60' : '#1F3A5F'};">${esc(p.prioridad || 'Medio')}</td>
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
              <p style="margin:0;font-size:8pt;color:#6B7280;">DNI: ${esc(d.auditor_dni || '_______________')} &nbsp;&nbsp; Fecha: ${esc(d.auditor_fecha || acta.fecha_emision || hoyISO())}</p>
            </div>
          </td>
          <td style="width:4%;"></td>
          <td style="width:48%;text-align:center;vertical-align:bottom;padding:0 15pt;">
            <div style="border-top:1pt solid #1F3A5F;padding-top:6pt;">
              <p style="margin:0;font-weight:bold;font-size:9.5pt;color:#1F3A5F;">${esc(d.responsable_proyecto || 'Responsable del proyecto')}</p>
              <p style="margin:2pt 0;font-size:8.5pt;color:#4B5563;">${esc(d.responsable_cargo || 'Líder de Proyecto / Cliente')}</p>
              <p style="margin:0;font-size:8pt;color:#6B7280;">DNI: ${esc(d.responsable_dni || '_______________')} &nbsp;&nbsp; Fecha: ${esc(d.responsable_fecha || acta.fecha_emision || hoyISO())}</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ANEXO: RESUMEN DE LO CORREGIDO (SOLUCIONARIO) -->
    ${d.solucionario?.contenido ? `
      <div style="page-break-before:always;margin-top:24pt;border-top:1.5pt solid #1F3A5F;padding-top:12pt;">
        <table style="border-collapse:collapse;width:100%;margin-bottom:8pt;">
          <tr>
            <td style="vertical-align:middle;">
              <span style="font-weight:bold;color:#1F3A5F;font-size:13pt;font-family:'Calibri', Arial, sans-serif;">
                ANEXO: RESUMEN DE LO CORREGIDO (SOLUCIONARIO)
              </span>
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <span style="background:#EAF1F8;border:0.5pt solid #2E6DA4;color:#1F3A5F;padding:2.5pt 6pt;border-radius:3pt;font-size:8pt;font-weight:bold;">
                Publicado: ${esc(d.solucionario.fecha_publicacion || fmtDate(acta.fecha_emision))}
              </span>
            </td>
          </tr>
        </table>
        <p style="font-size:9pt;color:#4B5563;margin-top:0;margin-bottom:12pt;line-height:1.35;">
          ${esc(d.solucionario.contenido.descripcionIntroductoria || '')}
        </p>

        ${(d.solucionario.contenido.secciones || []).map(sec => `
          <div style="margin-bottom:12pt;">
            <p style="margin:2pt 0 4pt 0;font-weight:bold;font-size:10pt;color:${sec.colorBadge || '#1F3A5F'};">
              ${sec.label} (${sec.items?.length || 0} acciones)
            </p>
            <table style="border-collapse:collapse;width:100%;margin:0 0 6pt 0;">
              <thead>
                <tr>
                  <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;color:#FFFFFF;padding:3pt 5pt;width:14%;font-size:8.5pt;text-align:left;">#</th>
                  <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;color:#FFFFFF;padding:3pt 5pt;width:28%;font-size:8.5pt;text-align:left;">Hallazgo</th>
                  <th style="border:0.5pt solid #C9D3DF;background:#1F3A5F;color:#FFFFFF;padding:3pt 5pt;width:58%;font-size:8.5pt;text-align:left;">Acción / Solución Aplicada</th>
                </tr>
              </thead>
              <tbody>
                ${(sec.items || []).map(it => `
                  <tr>
                    <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5pt;font-size:8.5pt;font-weight:bold;color:#1F3A5F;vertical-align:top;">${esc(it.ref)}</td>
                    <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5pt;font-size:8.5pt;font-weight:bold;color:#1F2937;vertical-align:top;">${esc(it.hallazgo)}</td>
                    <td style="border:0.5pt solid #C9D3DF;padding:3.5pt 5pt;font-size:8.5pt;color:#374151;line-height:1.3;vertical-align:top;">${esc(it.accion)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}

        ${d.solucionario.contenido.credenciales ? `
          <div style="background:#F3F4F6;border:1pt solid #D1D5DB;border-radius:4pt;padding:8pt;margin-top:10pt;">
            <p style="margin:0 0 4pt 0;font-weight:bold;font-size:9.5pt;color:#111827;">${esc(d.solucionario.contenido.credenciales.titulo)}</p>
            <p style="margin:2pt 0;font-size:8.5pt;color:#374151;"><b>Usuario:</b> ${esc(d.solucionario.contenido.credenciales.usuario)} &nbsp;·&nbsp; <b>Contraseña:</b> <span style="font-family:monospace;background:#E5E7EB;padding:1pt 4pt;">${esc(d.solucionario.contenido.credenciales.password)}</span></p>
            <p style="margin:2pt 0 0 0;font-size:8pt;color:#6B7280;font-style:italic;">${esc(d.solucionario.contenido.credenciales.nota)}</p>
          </div>
        ` : ''}
      </div>
    ` : ''}

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

    const projsVinc = Array.isArray(d.proyectos) && d.proyectos.length > 0
      ? d.proyectos
      : (_projects.filter(p => p.id === acta.project_id));
    const projLabel = projsVinc.length > 0
      ? projsVinc.map(p => `${p.name} (${p.code || 'S/C'})`).join(' · ')
      : (acta.project_name ? `${acta.project_name} (${acta.project_code || 'S/C'})` : 'Sin proyecto vinculado');

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
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>Proyecto</span>
                <span class="text-[11px] font-normal text-gray-400 flex items-center gap-1">${icon('lock', 12)} Bloqueado</span>
              </label>
              <input type="hidden" id="edit-project_id" value="${esc(acta.project_id || '')}">
              <input
                type="text"
                class="input w-full text-sm bg-gray-100/90 text-gray-700 border-gray-200 cursor-not-allowed select-none font-medium"
                value="${esc(projLabel)}"
                readonly
                tabindex="-1"
                title="El proyecto asignado al acta no se puede modificar"
              >
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>Versión del Acta</span>
                <span class="text-[11px] font-normal text-gray-400 flex items-center gap-1">${icon('lock', 12)} Bloqueado</span>
              </label>
              <input
                type="text"
                id="edit-version"
                class="input w-full text-sm bg-gray-100/90 text-gray-700 border-gray-200 cursor-not-allowed select-none font-medium"
                value="${esc(acta.version || '1.0')}"
                readonly
                tabindex="-1"
                title="La versión no se puede modificar"
              >
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>Fecha de Emisión</span>
                <span class="text-[11px] font-normal text-gray-400 flex items-center gap-1">${icon('lock', 12)} Bloqueado</span>
              </label>
              <input
                type="date"
                id="edit-fecha_emision"
                class="input w-full text-sm bg-gray-100/90 text-gray-700 border-gray-200 cursor-not-allowed select-none font-medium pointer-events-none"
                value="${esc(acta.fecha_emision || hoyISO())}"
                readonly
                tabindex="-1"
                title="La fecha de emisión no se puede modificar"
              >
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>Auditor Responsable</span>
                <span class="text-[11px] font-normal text-gray-400 flex items-center gap-1">${icon('lock', 12)} Bloqueado</span>
              </label>
              <input
                type="text"
                id="edit-auditor"
                class="input w-full text-sm bg-gray-100/90 text-gray-700 border-gray-200 cursor-not-allowed select-none font-medium"
                value="${esc(d.auditor || acta.auditor || 'Abraham Aranda Cerna')}"
                readonly
                tabindex="-1"
                title="El auditor responsable no se puede modificar"
              >
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

        <!-- SECCIÓN: CONTROLES CONFORMES (5.4) -->
        <div class="card p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
          <div class="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
            <h3 class="text-base font-bold text-gray-900 flex items-center gap-2">${icon('verified', 20)} Controles conformes (sección 5.4)</h3>
            <button type="button" id="btn-agregar-conforme" class="btn-secondary text-xs inline-flex items-center gap-1.5 py-1.5 px-3">${icon('add', 16)} Agregar</button>
          </div>
          <div id="lista-conformes-editor" class="space-y-2"></div>
        </div>

        <!-- SECCIÓN: PLAN DE REMEDIACIÓN (8) -->
        <div class="card p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 mb-3">
            <h3 class="text-base font-bold text-gray-900 flex items-center gap-2">${icon('task_alt', 20)} Plan de remediación (sección 8)</h3>
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-600 inline-flex items-center gap-1.5"><input type="checkbox" id="edit-plan-auto" ${d.plan_manual ? '' : 'checked'}> Generar desde los hallazgos al guardar</label>
              <button type="button" id="btn-agregar-accion" class="btn-secondary text-xs inline-flex items-center gap-1.5 py-1.5 px-3">${icon('add', 16)} Agregar acción</button>
            </div>
          </div>
          <div id="lista-plan-editor" class="space-y-2"></div>
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
                  <label class="block text-xs font-semibold text-gray-600 mb-1 flex items-center justify-between">
                    <span>Nombre Completo</span>
                    <span class="text-[10px] text-gray-400 flex items-center gap-0.5">${icon('lock', 10)} Bloqueado</span>
                  </label>
                  <input
                    type="text"
                    id="edit-firmante-aud-nombre"
                    class="input w-full text-sm bg-gray-100/90 text-gray-700 border-gray-200 cursor-not-allowed select-none font-medium"
                    value="${esc(d.auditor || acta.auditor || 'Abraham Aranda Cerna')}"
                    readonly
                    tabindex="-1"
                  >
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
    let conformesLocales = JSON.parse(JSON.stringify(Array.isArray(d.conformes) ? d.conformes : []));
    let planLocal = JSON.parse(JSON.stringify(Array.isArray(d.plan_remediacion) ? d.plan_remediacion : []));

    function renderConformesInputs() {
      const cont = document.getElementById('lista-conformes-editor');
      if (!cont) return;
      cont.innerHTML = conformesLocales.length ? conformesLocales.map((c, idx) => `
        <div class="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50 conf-row" data-idx="${idx}">
          <input type="text" class="input text-xs font-semibold py-1" style="flex:1;min-width:140px" value="${esc(c.area || '')}" placeholder="Área / dominio" data-f="area">
          <select class="input text-xs py-1 w-32" data-f="resultado">
            ${['Conforme', 'Riesgo bajo', 'No conforme'].map(r => `<option ${(c.resultado || 'Conforme') === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
          <input type="text" class="input text-xs py-1" style="flex:3;min-width:200px" value="${esc(c.observacion || '')}" placeholder="Qué se verificó" data-f="observacion">
          <button type="button" class="btn-eliminar-conf p-1 text-gray-400 hover:text-red-600" data-idx="${idx}">${icon('delete', 16)}</button>
        </div>`).join('')
        : '<p class="text-xs text-gray-400 p-3 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">Sin controles conformes registrados.</p>';
      cont.querySelectorAll('.conf-row').forEach(row => {
        const i = Number(row.dataset.idx);
        row.querySelectorAll('input, select').forEach(inp => inp.addEventListener('input', () => { conformesLocales[i][inp.dataset.f] = inp.value; }));
      });
      cont.querySelectorAll('.btn-eliminar-conf').forEach(b => b.addEventListener('click', () => { conformesLocales.splice(Number(b.dataset.idx), 1); renderConformesInputs(); }));
    }

    function renderPlanInputs() {
      const cont = document.getElementById('lista-plan-editor');
      if (!cont) return;
      const auto = document.getElementById('edit-plan-auto')?.checked;
      if (auto) {
        cont.innerHTML = '<p class="text-xs text-gray-500 p-3 bg-blue-50 border border-blue-100 rounded-lg">El plan se arma solo con una acción por hallazgo al guardar. Desmarca la casilla para escribir tus propias acciones (por ejemplo, agrupar varios hallazgos en una sola acción).</p>';
        return;
      }
      cont.innerHTML = planLocal.length ? planLocal.map((a, idx) => `
        <div class="grid grid-cols-12 gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50 plan-row items-center" data-idx="${idx}">
          <input type="text" class="input text-xs py-1 col-span-12 sm:col-span-4" value="${esc(a.accion || '')}" placeholder="Acción correctiva" data-f="accion">
          <input type="text" class="input text-xs py-1 col-span-3 sm:col-span-1 font-mono" value="${esc(a.ref || '')}" placeholder="Ref." data-f="ref">
          <select class="input text-xs py-1 col-span-3 sm:col-span-2" data-f="prioridad">${['Crítico', 'Alto', 'Medio', 'Bajo'].map(pr => `<option ${a.prioridad === pr ? 'selected' : ''}>${pr}</option>`).join('')}</select>
          <input type="text" class="input text-xs py-1 col-span-6 sm:col-span-2" value="${esc(a.responsable || '')}" placeholder="Responsable" data-f="responsable">
          <input type="text" class="input text-xs py-1 col-span-5 sm:col-span-2" value="${esc(a.fecha || '')}" placeholder="AAAA-MM-DD / Backlog" data-f="fecha" list="cal-plazos">
          <label class="col-span-5 sm:col-span-1 text-xs inline-flex items-center gap-1"><input type="checkbox" data-f="hecho" ${a.hecho ? 'checked' : ''}> Hecho</label>
          <button type="button" class="btn-eliminar-acc col-span-2 sm:col-span-12 sm:justify-self-end p-1 text-gray-400 hover:text-red-600" data-idx="${idx}">${icon('delete', 16)}</button>
        </div>`).join('')
        : '<p class="text-xs text-gray-400 p-3 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">Sin acciones. Usa «Agregar acción».</p>';
      cont.querySelectorAll('.plan-row').forEach(row => {
        const i = Number(row.dataset.idx);
        row.querySelectorAll('input, select').forEach(inp => inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', () => {
          planLocal[i][inp.dataset.f] = inp.type === 'checkbox' ? inp.checked : inp.value;
        }));
      });
      cont.querySelectorAll('.btn-eliminar-acc').forEach(b => b.addEventListener('click', () => { planLocal.splice(Number(b.dataset.idx), 1); renderPlanInputs(); }));
    }

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
            <div class="sm:col-span-2">
              <label class="block font-semibold text-gray-600 mb-0.5">Descripción para la tabla de medios / bajos (opcional)</label>
              <input type="text" class="input w-full text-xs" value="${esc(h.detalle || '')}" data-f="detalle" placeholder="Si se deja vacío se usa el título">
            </div>
            <div>
              <label class="block font-semibold text-gray-600 mb-0.5">Responsable de Remediación</label>
              <input type="text" class="input w-full text-xs ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" value="${esc(h.responsable || '')}" data-f="responsable">
            </div>
            <div>
              <label class="block font-semibold text-gray-600 mb-0.5">Fecha Límite</label>
              <input type="text" class="input w-full text-xs ${h._dePlantilla ? 'campo-plantilla-luz-amarilla' : ''}" value="${esc(h.fecha_limite || '')}" data-f="fecha_limite" placeholder="AAAA-MM-DD o Backlog" list="cal-plazos">
              <datalist id="cal-plazos"><option value="Backlog"><option value="Próximo sprint"></datalist>
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
                  ${it.codigo ? `<span class="font-mono font-bold text-primary-700 mr-1">${esc(it.codigo)}</span>` : ''}<span class="font-medium text-gray-800">${esc(it.control)}</span>
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
    renderConformesInputs();
    renderPlanInputs();
    document.getElementById('btn-agregar-conforme')?.addEventListener('click', () => { conformesLocales.push({ area: '', resultado: 'Conforme', observacion: '' }); renderConformesInputs(); });
    document.getElementById('btn-agregar-accion')?.addEventListener('click', () => {
      planLocal.push({ accion: '', ref: '', prioridad: 'Medio', responsable: d.responsable_proyecto || '', fecha: '', hecho: false });
      renderPlanInputs();
    });
    document.getElementById('edit-plan-auto')?.addEventListener('change', e => {
      // Al pasar a manual se parte del plan actual (o del generado por los hallazgos)
      if (!e.target.checked && !planLocal.length) {
        planLocal = hallazgosLocales.map(h => ({ accion: h.correccion || `Corregir ${h.id}: ${h.titulo}`, ref: h.id,
          prioridad: { critico: 'Crítico', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }[h.severidad] || 'Medio',
          responsable: h.responsable || '', fecha: h.fecha_limite || '', hecho: ['corregido', 'verificado'].includes(h.estado) }));
      }
      renderPlanInputs();
    });

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

      d.conformes = conformesLocales.filter(c => (c.area || '').trim() || (c.observacion || '').trim());
      d.plan_manual = !document.getElementById('edit-plan-auto')?.checked;

      // Plan propio: se guarda tal cual. Si no, se arma desde los hallazgos.
      if (d.plan_manual) {
        d.plan_remediacion = planLocal.filter(a => (a.accion || '').trim());
      } else if (d.hallazgos.length > 0) {
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

// ─── DESCARGAR BLOC DE NOTAS (.txt) ───────────────────────────────────────────
// Mismo contenido del acta en texto plano: secciones numeradas y tablas
// dibujadas con caracteres (se ven alineadas con fuente de ancho fijo).
const TXT_ANCHO = 100;
function txtPartir(texto, ancho) {
  const lineas = [];
  String(texto ?? '').split(/\r?\n/).forEach(parrafo => {
    let linea = '';
    parrafo.split(/\s+/).filter(Boolean).forEach(palabra => {
      while (palabra.length > ancho) { if (linea) { lineas.push(linea); linea = ''; } lineas.push(palabra.slice(0, ancho)); palabra = palabra.slice(ancho); }
      if (!linea) linea = palabra;
      else if ((linea + ' ' + palabra).length <= ancho) linea += ' ' + palabra;
      else { lineas.push(linea); linea = palabra; }
    });
    lineas.push(linea);
  });
  return lineas.length ? lineas : [''];
}
// Tabla: columnas [{titulo, ancho}] y filas [[...]]
function txtTabla(columnas, filas) {
  const sep = (izq, medio, der) => izq + columnas.map(c => '─'.repeat(c.ancho + 2)).join(medio) + der;
  const fila = celdas => {
    const partes = celdas.map((v, i) => txtPartir(v, columnas[i].ancho));
    const alto = Math.max(...partes.map(x => x.length));
    const out = [];
    for (let k = 0; k < alto; k++) out.push('│' + partes.map((x, i) => ' ' + (x[k] || '').padEnd(columnas[i].ancho) + ' ').join('│') + '│');
    return out.join('\n');
  };
  const cuerpo = filas.length ? filas.map(fila).join('\n' + sep('├', '┼', '┤') + '\n') : fila(columnas.map((c, i) => i === 0 ? '(sin registros)' : ''));
  return [sep('┌', '┬', '┐'), fila(columnas.map(c => c.titulo)), sep('╞', '╪', '╡').replace(/─/g, '═'), cuerpo, sep('└', '┴', '┘')].join('\n');
}
function txtTitulo(texto) { return '\n' + texto + '\n' + '─'.repeat(Math.min(TXT_ANCHO, texto.length)); }

function generarTextoActa(acta) {
  const cfg = TIPOS_CONFIG[acta.tipo] || TIPOS_CONFIG.seguridad;
  const d = acta.datos || {};
  const hs = Array.isArray(d.hallazgos) ? d.hallazgos : [];
  const SEV = { critico: 'Crítico', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };
  const EST = { pendiente: 'Pendiente', en_progreso: 'En progreso', corregido: 'Corregido', verificado: 'Verificado' };
  const por = sev => hs.filter(h => h.severidad === sev);
  const cnt = { critico: por('critico').length, alto: por('alto').length, medio: por('medio').length, bajo: por('bajo').length };
  const L = [];
  const linea = '═'.repeat(TXT_ANCHO);

  L.push(linea);
  L.push('QUBIRA S.A.C.');
  L.push(cfg.titulo);
  L.push(cfg.subtitulo);
  L.push(linea);
  L.push(txtTabla([{ titulo: 'Campo', ancho: 20 }, { titulo: 'Valor', ancho: 73 }], [
    ['N.º de acta', acta.codigo], ['Fecha de emisión', acta.fecha_emision || d.fecha_emision || ''], ['Versión', acta.version || '1.0'],
    ['Clasificación', d.clasificacion || 'Confidencial'], ['Proyecto', d.proyecto_nombre || acta.project_name || ''], ['Cliente', d.cliente || acta.project_client || ''],
  ]));

  L.push(txtTitulo('1. DATOS GENERALES DE LA AUDITORÍA'));
  L.push(txtTabla([{ titulo: 'Campo', ancho: 22 }, { titulo: 'Detalle', ancho: 71 }], [
    ['Entorno auditado', d.entorno || ''], ['Repositorios', d.repositorios || ''], ['Alcance', d.alcance || ''], ['Metodología', d.metodologia || ''],
    ['Periodo de ejecución', `${d.periodo_desde || '—'} al ${d.periodo_hasta || '—'}`], ['Auditor responsable', d.auditor || acta.auditor || ''], ['Próxima revisión', d.proxima_revision || '—'],
  ]));

  L.push(txtTitulo('2. RESUMEN EJECUTIVO'));
  L.push('Conclusión:');
  txtPartir(d.conclusion || '—', TXT_ANCHO - 2).forEach(x => L.push('  ' + x));
  L.push('');
  L.push(txtTabla([{ titulo: 'CRÍTICO', ancho: 20 }, { titulo: 'ALTO', ancho: 20 }, { titulo: 'MEDIO', ancho: 20 }, { titulo: 'BAJO', ancho: 20 }],
    [[`${cnt.critico} hallazgos`, `${cnt.alto} hallazgos`, `${cnt.medio} hallazgos`, `${cnt.bajo} hallazgos`]]));

  L.push(txtTitulo('3. CRITERIOS DE SEVERIDAD'));
  L.push(txtTabla([{ titulo: 'Severidad', ancho: 10 }, { titulo: 'Criterio', ancho: 62 }, { titulo: 'Plazo', ancho: 17 }],
    ['critico', 'alto', 'medio', 'bajo'].map(k => [SEV[k], SEVERIDAD_CONFIG[k].criterio, SEVERIDAD_CONFIG[k].plazo])));

  L.push(txtTitulo('4. RESUMEN DE HALLAZGOS'));
  L.push(txtTabla([{ titulo: 'N.º', ancho: 5 }, { titulo: 'Hallazgo', ancho: 38 }, { titulo: 'Severidad', ancho: 9 }, { titulo: 'Estado', ancho: 11 }, { titulo: 'Responsable', ancho: 11 }, { titulo: 'Fecha límite', ancho: 12 }],
    hs.map(h => [h.id, h.titulo, SEV[h.severidad] || h.severidad, EST[h.estado] || h.estado, h.responsable || '', h.fecha_limite || ''])));
  L.push('Estados válidos: Pendiente · En progreso · Corregido · Verificado.');

  L.push(txtTitulo('5. DETALLE DE HALLAZGOS'));
  const ficha = h => txtTabla([{ titulo: `Hallazgo ${h.id}`, ancho: 20 }, { titulo: `${h.titulo}  [${(SEV[h.severidad] || '').toUpperCase()}]`, ancho: 73 }], [
    ['Severidad', SEV[h.severidad] || ''], ['Evidencia', h.evidencia || '—'], ['Impacto', h.impacto || '—'], ['Ubicación', h.ubicacion || '—'],
    ['Corrección', h.correccion || '—'], ['Responsable / Plazo', `${h.responsable || '—'} · ${h.fecha_limite || '—'}`], ['Estado', EST[h.estado] || h.estado || ''],
  ]);
  L.push('\n5.1  Críticos — acción inmediata');
  L.push(por('critico').length ? por('critico').map(ficha).join('\n\n') : '  No se identificaron hallazgos de severidad crítica.');
  L.push('\n5.2  Altos');
  L.push(por('alto').length ? por('alto').map(ficha).join('\n\n') : '  No se identificaron hallazgos de severidad alta.');
  const tablaCorta = lista => txtTabla([{ titulo: 'N.º', ancho: 5 }, { titulo: 'Hallazgo', ancho: 38 }, { titulo: 'Ubicación', ancho: 22 }, { titulo: 'Corrección', ancho: 22 }],
    lista.map(h => [h.id, h.detalle || h.titulo, h.ubicacion || '—', h.correccion || '—']));
  L.push('\n5.3  Medios');
  L.push(tablaCorta(por('medio')));
  L.push('\n5.4  Bajos y controles conformes');
  if (por('bajo').length) { L.push('Bajos:'); L.push(tablaCorta(por('bajo'))); }
  const conformes = Array.isArray(d.conformes) ? d.conformes : [];
  if (conformes.length) {
    L.push('Controles conformes:');
    L.push(txtTabla([{ titulo: 'Área / Dominio', ancho: 22 }, { titulo: 'Resultado', ancho: 12 }, { titulo: 'Observación', ancho: 56 }], conformes.map(c => [c.area, c.resultado || 'Conforme', c.observacion || ''])));
  }

  L.push(txtTitulo('6. CONTROLES REVISADOS'));
  const filasCtr = [];
  (Array.isArray(d.controles) ? d.controles : []).forEach(dom => (dom.items || []).forEach((it, i) => filasCtr.push([
    i === 0 ? dom.dominio : '', `${it.codigo ? it.codigo + '  ' : ''}${it.control}`, it.cumple === 'si' ? 'Sí' : it.cumple === 'no' ? 'No' : 'N.A.', it.ref || '—'])));
  L.push(txtTabla([{ titulo: 'Dominio', ancho: 20 }, { titulo: 'Control', ancho: 50 }, { titulo: 'Cumple', ancho: 6 }, { titulo: 'Ref.', ancho: 12 }], filasCtr));

  L.push(txtTitulo('7. HERRAMIENTAS RECOMENDADAS'));
  L.push(txtTabla([{ titulo: 'Herramienta', ancho: 28 }, { titulo: 'Prioridad', ancho: 9 }, { titulo: 'Justificación', ancho: 53 }],
    (Array.isArray(d.herramientas) ? d.herramientas : []).map(t => [t.herramienta, t.prioridad || '', t.justificacion || ''])));

  L.push(txtTitulo('8. PLAN DE REMEDIACIÓN'));
  L.push(txtTabla([{ titulo: 'Acción correctiva', ancho: 34 }, { titulo: 'Ref.', ancho: 11 }, { titulo: 'Prioridad', ancho: 9 }, { titulo: 'Responsable', ancho: 13 }, { titulo: 'Fecha', ancho: 10 }, { titulo: 'Hecho', ancho: 5 }],
    (Array.isArray(d.plan_remediacion) ? d.plan_remediacion : []).map(a => [a.accion, a.ref || '', a.prioridad || '', a.responsable || '', a.fecha || '', a.hecho ? '[X]' : '[ ]'])));

  L.push(txtTitulo('9. CONFORMIDAD'));
  txtPartir('Las partes firmantes declaran conocer los hallazgos descritos en la presente acta y se comprometen a ejecutar el plan de remediación en los plazos establecidos.', TXT_ANCHO).forEach(x => L.push(x));
  L.push('');
  L.push('');
  const firma = (nombre, cargo, dni, fecha) => [`______________________________________`, nombre, cargo, `DNI: ${dni || '__________'}   Fecha: ${fecha}`];
  const f1 = firma(d.auditor || acta.auditor || 'Auditor responsable', d.auditor_cargo || 'Auditor responsable', d.auditor_dni, d.auditor_fecha || acta.fecha_emision || '');
  const f2 = firma(d.responsable_proyecto || 'Responsable del proyecto', d.responsable_cargo || 'Responsable del proyecto', d.responsable_dni, d.responsable_fecha || acta.fecha_emision || '');
  f1.forEach((x, i) => L.push(x.padEnd(50) + f2[i]));
  L.push('');
  L.push(linea);
  L.push(`Documento confidencial — uso interno · QUBIRA S.A.C. · ${acta.codigo}`);
  return L.join('\r\n').replace(/(?<!\r)\n/g, '\r\n');
}

function descargarTxt(acta) {
  const cfg = TIPOS_CONFIG[acta.tipo] || TIPOS_CONFIG.seguridad;
  const blob = new Blob(['\ufeff', generarTextoActa(acta)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${acta.codigo} - ${cfg.titulo} - QUBIRA.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`Bloc de notas descargado: ${acta.codigo}.txt`);
}

async function descargarTxtPorId(id) {
  try {
    descargarTxt(await api.get(`/calidad/actas/${id}`));
  } catch (e) {
    toast('Error al descargar el Bloc de notas', 'error');
  }
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
