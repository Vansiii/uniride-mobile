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

// HU-07: capturadas de un backend real (PostgreSQL local, correo en consola). Una persona con
// A activa, B aprobada, C pendiente y D rechazada; los tokens van con valores de prueba.
export const organizacionesReales = {
  idA: 'ad8107ae-4c8a-4548-af52-1dabe84ccae6',
  idB: '2153001b-3c2f-4db3-a51e-12ff88f9a267',
  idC: '979d2776-b518-4f23-b02d-27c4a09847a6',
  idD: '5c503e8d-c8f1-4b69-9763-608a6d51ebce',
  /** GET /yo con una sola organización (A activa) */
  yoSoloA: ok(200, {
    id: '8221f194-48cd-46e2-9557-0df896aa194f',
    nombreCompleto: 'Ana Real',
    correo: 'ana@pa.p7mob.test',
    rolPlataforma: null,
    organizacionActiva: 'ad8107ae-4c8a-4548-af52-1dabe84ccae6',
    membresias: [
      {
        organizacionId: 'ad8107ae-4c8a-4548-af52-1dabe84ccae6',
        organizacion: 'P7MOB A',
        rol: 'miembro',
        estado: 'aprobada',
      },
    ],
  }),
  /** GET /yo con A activa, B aprobada, C pendiente y D rechazada */
  yoVarias: ok(200, {
    id: '8221f194-48cd-46e2-9557-0df896aa194f',
    nombreCompleto: 'Ana Real',
    correo: 'ana@pa.p7mob.test',
    rolPlataforma: null,
    organizacionActiva: 'ad8107ae-4c8a-4548-af52-1dabe84ccae6',
    membresias: [
      {
        organizacionId: 'ad8107ae-4c8a-4548-af52-1dabe84ccae6',
        organizacion: 'P7MOB A',
        rol: 'miembro',
        estado: 'aprobada',
      },
      {
        organizacionId: '2153001b-3c2f-4db3-a51e-12ff88f9a267',
        organizacion: 'P7MOB B',
        rol: 'miembro',
        estado: 'aprobada',
      },
      {
        organizacionId: '979d2776-b518-4f23-b02d-27c4a09847a6',
        organizacion: 'P7MOB C',
        rol: 'miembro',
        estado: 'pendiente',
      },
      {
        organizacionId: '5c503e8d-c8f1-4b69-9763-608a6d51ebce',
        organizacion: 'P7MOB D',
        rol: 'miembro',
        estado: 'rechazada',
      },
    ],
  }),
  /** GET /yo tras PUT /yo/organizacion-activa a B */
  yoActivaB: ok(200, {
    id: '8221f194-48cd-46e2-9557-0df896aa194f',
    nombreCompleto: 'Ana Real',
    correo: 'ana@pa.p7mob.test',
    rolPlataforma: null,
    organizacionActiva: '2153001b-3c2f-4db3-a51e-12ff88f9a267',
    membresias: [
      {
        organizacionId: 'ad8107ae-4c8a-4548-af52-1dabe84ccae6',
        organizacion: 'P7MOB A',
        rol: 'miembro',
        estado: 'aprobada',
      },
      {
        organizacionId: '2153001b-3c2f-4db3-a51e-12ff88f9a267',
        organizacion: 'P7MOB B',
        rol: 'miembro',
        estado: 'aprobada',
      },
      {
        organizacionId: '979d2776-b518-4f23-b02d-27c4a09847a6',
        organizacion: 'P7MOB C',
        rol: 'miembro',
        estado: 'pendiente',
      },
      {
        organizacionId: '5c503e8d-c8f1-4b69-9763-608a6d51ebce',
        organizacion: 'P7MOB D',
        rol: 'miembro',
        estado: 'rechazada',
      },
    ],
  }),
  /** POST /membresias → 202 */
  codigoEnviado: ok(202, { reenviarEn: '2026-10-27T02:59:56.135Z' }),
  /** POST /membresias, antes del minuto → 429 */
  reenvioLimitado: ok(429, {
    codigo: 'OTP_LIMITE_REENVIO',
    mensaje: 'Ya te enviamos un código. Espera un momento antes de pedir otro.',
    reenviarEn: '2026-10-27T02:59:56.135Z',
  }),
  /** POST /autenticacion/reenviar-codigo con propósito `agregar_organizacion` → 202 */
  reenvioAgregar: ok(202, { reenviarEn: '2026-10-27T02:59:56.439Z' }),
  organizacionNoAfiliada: ok(422, {
    codigo: 'ORGANIZACION_NO_AFILIADA',
    mensaje: 'Tu organización no está afiliada a UniRide.',
  }),
  yaEsMiembro: ok(409, {
    codigo: 'YA_ES_MIEMBRO',
    mensaje:
      'Ya eres miembro de esta organización o tu solicitud está pendiente.',
  }),
  membresiaRechazada: ok(409, {
    codigo: 'MEMBRESIA_RECHAZADA',
    mensaje:
      'Tu solicitud para esta organización fue rechazada. Si crees que es un error, comunícate con su administrador.',
  }),
  correoEnUso: ok(409, {
    codigo: 'CORREO_EN_USO',
    mensaje: 'Ese correo ya está en uso en otra cuenta.',
  }),
  /** POST /membresias/confirmar → 200, organización de aprobación automática */
  confirmadaAprobada: ok(200, {
    membresia: {
      organizacionId: '2153001b-3c2f-4db3-a51e-12ff88f9a267',
      organizacion: 'P7MOB B',
      rol: 'miembro',
      estado: 'aprobada',
    },
  }),
  /** POST /membresias/confirmar → 200, organización de aprobación manual */
  confirmadaPendiente: ok(200, {
    membresia: {
      organizacionId: '979d2776-b518-4f23-b02d-27c4a09847a6',
      organizacion: 'P7MOB C',
      rol: 'miembro',
      estado: 'pendiente',
    },
  }),
  /** PUT /yo/organizacion-activa → 200 */
  activaCambiada: ok(200, { tokenAcceso: 'acceso-nuevo-de-prueba' }),
  /** PUT /yo/organizacion-activa a una pendiente o rechazada → 403 */
  activaNoAprobada: ok(403, {
    codigo: 'MEMBRESIA_NO_APROBADA',
    mensaje:
      'Solo puedes elegir una organización donde tu membresía esté aprobada.',
  }),
};

// HU-34: capturadas de un backend real (PostgreSQL local, correo en consola) con una cuenta y un correo sin cuenta.
export const recuperacionReal = {
  /** POST /autenticacion/recuperar-contrasena con un correo que tiene cuenta → 202 */
  solicitudConCuenta: ok(202, { reenviarEn: '2026-10-27T03:47:45.276Z' }),
  /** Lo mismo con un correo sin cuenta → 202 con la misma forma (CA-2) */
  solicitudSinCuenta: ok(202, { reenviarEn: '2026-10-27T03:47:45.526Z' }),
  /** Segunda petición antes del minuto, con cuenta → 429 */
  limitadoConCuenta: ok(429, {
    codigo: 'OTP_LIMITE_REENVIO',
    mensaje: 'Ya te enviamos un código. Espera un momento antes de pedir otro.',
    reenviarEn: '2026-10-27T03:47:45.276Z',
  }),
  /** Lo mismo sin cuenta → 429 idéntico */
  limitadoSinCuenta: ok(429, {
    codigo: 'OTP_LIMITE_REENVIO',
    mensaje: 'Ya te enviamos un código. Espera un momento antes de pedir otro.',
    reenviarEn: '2026-10-27T03:47:45.526Z',
  }),
  /** POST /autenticacion/restablecer-contrasena: código incorrecto, ya usado o de un correo sin cuenta → 400 */
  codigoInvalido: ok(400, {
    codigo: 'OTP_INVALIDO',
    mensaje: 'El código no es correcto.',
  }),
  contrasenaDebil: ok(400, {
    codigo: 'CONTRASENA_DEBIL',
    mensaje:
      'La contraseña debe tener al menos 8 caracteres, con letras y números.',
  }),
  vencido: ok(410, {
    codigo: 'OTP_VENCIDO',
    mensaje: 'El código venció. Pide uno nuevo.',
  }),
  /** Al quinto error seguido, y en los intentos siguientes → 429 */
  bloqueado: ok(429, {
    codigo: 'OTP_BLOQUEADO',
    mensaje: 'Demasiados intentos. Vuelve a intentarlo más tarde.',
    reintentarEn: '2026-10-27T04:03:52.533Z',
  }),
  /** Contraseña cambiada y todas las sesiones cerradas → 204 sin cuerpo */
  restablecida: ok(204, null),
};

// HU-11: capturadas de un backend real (PostgreSQL local, MinIO), con multipart real; la foto nunca viene en las respuestas.
export const vehiculosReales = {
  /** POST /vehiculos con "1234-abc" → 201, placa ya normalizada */
  registrado: ok(201, {
    id: '55d90330-1195-45ee-a8bf-7bc48ff0617c',
    placa: '1234ABC',
    marca: 'Toyota',
    modelo: 'Corolla',
    color: 'Blanco',
    capacidad: 4,
  }),
  /** GET /vehiculos/mio con vehículo → 200 */
  mio: ok(200, {
    id: '55d90330-1195-45ee-a8bf-7bc48ff0617c',
    placa: '1234ABC',
    marca: 'Toyota',
    modelo: 'Corolla',
    color: 'Blanco',
    capacidad: 4,
  }),
  /** GET /vehiculos/mio sin vehículo → 404 */
  sinVehiculo: ok(404, {
    codigo: 'NO_ENCONTRADO',
    mensaje: 'No se encontró lo que buscas.',
  }),
  placaDuplicada: ok(409, {
    codigo: 'VEHICULO_PLACA_DUPLICADA',
    mensaje: 'Esa placa ya está registrada en UniRide.',
  }),
  yaRegistrado: ok(409, {
    codigo: 'VEHICULO_YA_REGISTRADO',
    mensaje: 'Ya tienes un vehículo registrado.',
  }),
  placaInvalida: ok(400, {
    codigo: 'VEHICULO_DATO_INVALIDO',
    mensaje:
      'Revisa el dato marcado: la placa lleva 3 o 4 números y 3 letras (por ejemplo, 1234ABC) y la capacidad va de 1 a 6 asientos para pasajeros.',
    campo: 'placa',
  }),
  capacidadInvalida: ok(400, {
    codigo: 'VEHICULO_DATO_INVALIDO',
    mensaje:
      'Revisa el dato marcado: la placa lleva 3 o 4 números y 3 letras (por ejemplo, 1234ABC) y la capacidad va de 1 a 6 asientos para pasajeros.',
    campo: 'capacidad',
  }),
  fotoInvalida: ok(400, {
    codigo: 'VEHICULO_FOTO_INVALIDA',
    mensaje: 'La foto debe ser JPEG o PNG y pesar como máximo 5 MB.',
    maximoBytes: 5242880,
    tipos: ['image/jpeg', 'image/png'],
  }),
  consentimientoRequerido: ok(400, {
    codigo: 'CONSENTIMIENTO_REQUERIDO',
    mensaje: 'Debes aceptar el uso de la foto de tu vehículo para registrarlo.',
  }),
  /** Membresía pendiente o rechazada (CA-8) → 403 */
  noAutorizado: ok(403, {
    codigo: 'NO_AUTORIZADO',
    mensaje: 'No tienes permiso para realizar esta acción.',
  }),
  /** S3 inalcanzable → 503, sin nada registrado */
  almacenamientoNoDisponible: ok(503, {
    codigo: 'ALMACENAMIENTO_NO_DISPONIBLE',
    mensaje: 'No pudimos guardar la foto. Inténtalo de nuevo más tarde.',
  }),
};

/** Cuerpo enviado: JSON ya leído o, si fue multipart, un objeto con cada parte (los archivos como `{ archivo: true, ... }`). */
function leerCuerpo(cuerpo: unknown): unknown {
  if (!cuerpo) return undefined;
  if (typeof cuerpo === 'string') return JSON.parse(cuerpo);
  const partes: [string, unknown][] =
    'getParts' in (cuerpo as object)
      ? (
          cuerpo as {
            getParts(): { fieldName: string; string?: string }[];
          }
        )
          .getParts()
          .map((p) => [p.fieldName, p.string ?? { archivo: true, ...p }])
      : [...(cuerpo as FormData).entries()];
  return Object.fromEntries(partes);
}

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
    llamadas.push({ ruta, cuerpo: leerCuerpo(init?.body) });
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
