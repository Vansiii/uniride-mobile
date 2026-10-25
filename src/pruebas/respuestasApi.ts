// Respuestas capturadas de un backend real de HU-05 (PostgreSQL local, correo en consola).
// Los tokens van con valores de prueba: nunca se guardan los de la corrida.
export interface RespuestaSimulada {
  estado: number;
  cuerpo: unknown;
}

const ok = (estado: number, cuerpo: unknown): RespuestaSimulada => ({
  estado,
  cuerpo,
});

export const respuestasReales = {
  /** POST /autenticacion/registro y /reenviar-codigo → 202 */
  codigoEnviado: ok(202, { reenviarEn: '2026-10-25T02:56:06.092Z' }),
  /** POST /autenticacion/registro, antes del minuto → 429 */
  reenvioLimitado: ok(429, {
    codigo: 'OTP_LIMITE_REENVIO',
    mensaje: 'Ya te enviamos un código. Espera un momento antes de pedir otro.',
    reenviarEn: '2026-10-25T02:56:06.092Z',
  }),
  organizacionNoAfiliada: ok(422, {
    codigo: 'ORGANIZACION_NO_AFILIADA',
    mensaje: 'Tu organización no está afiliada a UniRide.',
  }),
  contrasenaDebil: ok(400, {
    codigo: 'CONTRASENA_DEBIL',
    mensaje:
      'La contraseña debe tener al menos 8 caracteres, con letras y números.',
  }),
  consentimientoRequerido: ok(400, {
    codigo: 'CONSENTIMIENTO_REQUERIDO',
    mensaje:
      'Debes aceptar el tratamiento de tus datos personales para registrarte.',
  }),
  /** POST /autenticacion/verificar-otp */
  otpInvalido: ok(400, {
    codigo: 'OTP_INVALIDO',
    mensaje: 'El código no es correcto.',
  }),
  otpVencido: ok(410, {
    codigo: 'OTP_VENCIDO',
    mensaje: 'El código venció. Pide uno nuevo.',
  }),
  otpBloqueado: ok(429, {
    codigo: 'OTP_BLOQUEADO',
    mensaje: 'Demasiados intentos. Vuelve a intentarlo más tarde.',
    reintentarEn: '2026-10-25T03:10:11.106Z',
  }),
  sesionAprobada: ok(200, {
    tokenAcceso: 'acceso-de-prueba',
    tokenRefresco: 'refresco-de-prueba',
    estadoMembresia: 'aprobada',
  }),
  sesionPendiente: ok(200, {
    tokenAcceso: 'acceso-de-prueba',
    tokenRefresco: 'refresco-de-prueba',
    estadoMembresia: 'pendiente',
  }),
  /** GET /yo tras el registro en una organización de aprobación automática */
  yoAprobada: ok(200, {
    id: '6b021aa1-c985-46f6-8817-50d297e2c7ee',
    nombreCompleto: 'Ana Real',
    correo: 'ana@a.hu05mob.test',
    rolPlataforma: null,
    organizacionActiva: 'eb0c1e92-8c1d-47bd-a52d-d227d588aaf3',
    membresias: [
      {
        organizacionId: 'eb0c1e92-8c1d-47bd-a52d-d227d588aaf3',
        organizacion: 'HU05MOB A',
        rol: 'miembro',
        estado: 'aprobada',
      },
    ],
  }),
  /** GET /yo tras el registro en una organización de aprobación manual */
  yoPendiente: ok(200, {
    id: '2c9ec8e3-0373-4400-a72d-79cf171bce94',
    nombreCompleto: 'Ana Real',
    correo: 'carla@b.hu05mob.test',
    rolPlataforma: null,
    organizacionActiva: null,
    membresias: [
      {
        organizacionId: 'c6c3b9fa-1440-4797-ab97-ca1f2b89dbf7',
        organizacion: 'HU05MOB B',
        rol: 'miembro',
        estado: 'pendiente',
      },
    ],
  }),
};

/** `fetch` falso que responde según "MÉTODO /ruta"; lo que no está en `rutas` falla como una caída de red. */
export function simularFetch(
  rutas: Record<string, RespuestaSimulada | RespuestaSimulada[]>,
) {
  const llamadas: { ruta: string; cuerpo: unknown }[] = [];
  const pendientes = Object.fromEntries(
    Object.entries(rutas).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]),
  );
  const falso = jest.fn(async (url: string, init?: RequestInit) => {
    const ruta = `${init?.method ?? 'GET'} ${new URL(url).pathname.replace('/api/v1', '')}`;
    llamadas.push({
      ruta,
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const cola = pendientes[ruta];
    if (!cola?.length) throw new TypeError('Network request failed');
    // La última respuesta se repite, como un servidor que responde igual.
    const { estado, cuerpo } = cola.length > 1 ? cola.shift()! : cola[0];
    return {
      ok: estado >= 200 && estado < 300,
      status: estado,
      json: async () => cuerpo,
    };
  });
  globalThis.fetch = falso as unknown as typeof fetch;
  return { llamadas, falso };
}
