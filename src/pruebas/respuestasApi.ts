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

// HU-09: formas según el contrato del backend (DTOs de `dispositivos`); Play Integrity real no se probó.
export const dispositivoReal = {
  sinDispositivo: ok(404, {
    codigo: 'NO_ENCONTRADO',
    mensaje: 'No se encontró lo que buscas.',
  }),
  vinculado: ok(200, {
    id: '0b6f1d3a-7c2e-4a55-9d21-5f8e3b9c4a10',
    modelo: 'Pixel 8',
    vinculadoEn: '2026-11-04T15:00:00.000Z',
    activo: true,
  }),
  desafio: ok(201, {
    desafio: 'ZGVzYWZpby1kZS1wcnVlYmE',
    expiraEn: '2026-11-04T15:05:00.000Z',
  }),
  vinculadoOk: ok(200, {
    id: '0b6f1d3a-7c2e-4a55-9d21-5f8e3b9c4a10',
    estado: 'vinculado',
  }),
  noIntegro: ok(422, {
    codigo: 'DISPOSITIVO_NO_INTEGRO',
    mensaje: 'No pudimos comprobar tu teléfono.',
  }),
  yaVinculado: ok(400, {
    codigo: 'DISPOSITIVO_YA_VINCULADO',
    mensaje: 'Ya tienes un dispositivo vinculado.',
  }),
};

// HU-08: formas según el contrato del backend (DTOs de `identidad`); el motor facial real no se probó.
export const identidadReal = {
  sinVerificar: ok(200, {
    estado: 'no_verificada',
    verificadoEn: null,
    bloqueadoHasta: null,
  }),
  verificada: ok(200, {
    estado: 'verificada',
    verificadoEn: '2026-11-04T15:00:00.000Z',
    bloqueadoHasta: null,
  }),
  bloqueada: ok(200, {
    estado: 'bloqueada_temporal',
    verificadoEn: null,
    bloqueadoHasta: '2026-11-05T15:00:00.000Z',
  }),
  sesion: ok(201, { sesionId: 'sim-3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b' }),
  exito: ok(200, {
    estado: 'verificada',
    verificadoEn: '2026-11-04T15:00:00.000Z',
  }),
  rostroNoCoincide: ok(422, {
    codigo: 'ROSTRO_NO_COINCIDE',
    mensaje: 'Tu rostro no coincide con la foto del carnet.',
  }),
  documentoDuplicado: ok(409, {
    codigo: 'DOCUMENTO_DUPLICADO',
    mensaje: 'Ese carnet ya está registrado.',
  }),
  intentosAgotados: ok(429, {
    codigo: 'INTENTOS_AGOTADOS',
    mensaje: 'Superaste los intentos de verificación.',
    bloqueadoHasta: '2026-11-05T15:00:00.000Z',
  }),
};

// HU-12: respuestas capturadas de un backend propio (PostgreSQL local, nodo Hardhat de compose, firma real de
// dispositivo, 06/11/2026). `exploradorUrl` es `null` porque Hardhat no tiene explorador; la forma con URL sigue el
// contrato (`https://amoy.polygonscan.com/address/<direccion>`) y Polygon Amoy nunca se tocó.
const DIRECCION_BILLETERA = '0x3021f987aaE8Fb0be0C809E13A05F79b04706805';
export const billeteraReal = {
  direccion: DIRECCION_BILLETERA,
  /** GET /billetera/mia, tras acuñar 12.349 URC en Hardhat (la API trunca a 2 decimales). */
  conSaldo: ok(200, {
    id: 'd0c05fca-d161-447f-92c4-0791765882b3',
    direccion: DIRECCION_BILLETERA,
    saldoUrc: '12.34',
    exploradorUrl: null,
  }),
  /** GET /billetera/mia recién creada. */
  sinSaldo: ok(200, {
    id: 'd0c05fca-d161-447f-92c4-0791765882b3',
    direccion: DIRECCION_BILLETERA,
    saldoUrc: '0.00',
    exploradorUrl: null,
  }),
  /** POST /billetera cuando la crea. */
  creada: ok(201, {
    id: 'd0c05fca-d161-447f-92c4-0791765882b3',
    direccion: DIRECCION_BILLETERA,
    saldoUrc: '0.00',
    exploradorUrl: null,
  }),
  /** Forma del contrato en Polygon Amoy (no capturada: Amoy nunca se tocó). */
  enAmoy: ok(200, {
    id: 'd0c05fca-d161-447f-92c4-0791765882b3',
    direccion: DIRECCION_BILLETERA,
    saldoUrc: '12.30',
    exploradorUrl: `https://amoy.polygonscan.com/address/${DIRECCION_BILLETERA}`,
  }),
  /** GET /billetera/mia sin billetera todavía → 404. */
  noEncontrada: ok(404, {
    codigo: 'BILLETERA_NO_ENCONTRADA',
    mensaje: 'Todavía no tienes una billetera.',
  }),
  identidadNoVerificada: ok(403, {
    codigo: 'IDENTIDAD_NO_VERIFICADA',
    mensaje: 'Debes verificar tu identidad para realizar esta acción.',
  }),
  firmaInvalida: ok(401, {
    codigo: 'FIRMA_DISPOSITIVO_INVALIDA',
    mensaje:
      'No pudimos comprobar que la petición viene de tu teléfono vinculado.',
  }),
  peticionExpirada: ok(401, {
    codigo: 'PETICION_EXPIRADA',
    mensaje: 'La petición expiró o ya fue usada. Inténtalo de nuevo.',
  }),
  cuentaSuspendida: ok(403, {
    codigo: 'CUENTA_SUSPENDIDA',
    mensaje: 'Tu cuenta está suspendida. No puedes usar la billetera.',
  }),
  /** Con el nodo Hardhat apagado. */
  cadenaCaida: ok(503, {
    codigo: 'SERVICIO_BLOCKCHAIN_NO_DISPONIBLE',
    mensaje:
      'No pudimos conectar con la red de tu billetera. Inténtalo de nuevo en unos minutos.',
  }),
};
// HU-14: capturadas de un backend propio (PostgreSQL local, nodo Hardhat de compose, 06/11/2026) con una persona
// verificada, con billetera, 46 movimientos de los 4 tipos (un pendiente y un fallido) y 347 URC acuñados. Sin firma:
// estas rutas van solo con token. `exploradorUrl` es `null` porque Hardhat no tiene explorador; la forma con URL
// sigue el contrato (`https://amoy.polygonscan.com/tx/<hash>`) y Polygon Amoy nunca se tocó.
export const historialReal = {
  /** GET /billetera/saldo → 200 */
  saldo: ok(200, {
    saldoTotal: '362.00',
    saldoDisponible: '347.00',
    saldoBloqueadoEscrow: '15.00',
    moneda: 'URC',
    enLinea: true,
  }),
  /** GET /billetera/saldo con el nodo caído → 200 con el saldo contable (forma del contrato). */
  saldoSinNodo: ok(200, {
    saldoTotal: '362.00',
    saldoDisponible: '347.00',
    saldoBloqueadoEscrow: '15.00',
    moneda: 'URC',
    enLinea: false,
  }),
  /** GET /billetera/movimientos?pagina=1&limite=20 → 200 (el pendiente va primero) */
  pagina1: ok(200, {
    items: [
      {
        id: '2c1c7809-0f79-4760-a890-fcab41fe219b',
        tipo: 'recarga',
        monto: '50.00',
        estado: 'pendiente',
        hashTx: null,
        exploradorUrl: null,
        creadoEn: '2026-11-07T01:23:06.896Z',
      },
      {
        id: '1e4bc003-59da-4841-b7a1-98bc2555a012',
        tipo: 'liberacion_viaje',
        monto: '12.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        exploradorUrl: null,
        creadoEn: '2026-11-07T00:00:06.897Z',
      },
      {
        id: 'f9f047f3-acd3-4510-a994-e998efe30ec3',
        tipo: 'bloqueo_reserva',
        monto: '15.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000003',
        exploradorUrl: null,
        creadoEn: '2026-11-06T00:35:06.897Z',
      },
      {
        id: '32f355eb-40ab-4df2-99b5-56157d623432',
        tipo: 'reembolso_reserva',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000005',
        exploradorUrl: null,
        creadoEn: '2026-11-05T21:35:06.898Z',
      },
      {
        id: '718b8efc-432f-4edf-be9b-b67b97580b34',
        tipo: 'bloqueo_reserva',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000004',
        exploradorUrl: null,
        creadoEn: '2026-11-05T20:35:06.897Z',
      },
      {
        id: '22229e4b-5ace-4e45-90b9-89225fc0511b',
        tipo: 'recarga',
        monto: '5.00',
        estado: 'fallido',
        hashTx: null,
        exploradorUrl: null,
        creadoEn: '2026-11-05T18:55:06.898Z',
      },
      {
        id: 'f2bbbad7-03c7-42c6-8d30-96cebda17d1e',
        tipo: 'recarga',
        monto: '5.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000007',
        exploradorUrl: null,
        creadoEn: '2026-11-05T01:35:06.898Z',
      },
      {
        id: 'c705beb9-82b1-4b53-b8f9-7880ad26f922',
        tipo: 'recarga',
        monto: '7.50',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000008',
        exploradorUrl: null,
        creadoEn: '2026-11-04T20:05:06.898Z',
      },
      {
        id: '395c643f-14de-459e-93dd-07d47d6c43df',
        tipo: 'recarga',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000009',
        exploradorUrl: null,
        creadoEn: '2026-11-04T14:35:06.898Z',
      },
      {
        id: '6b9f07a4-ed82-485d-a197-141ea8e4aee0',
        tipo: 'recarga',
        monto: '12.50',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000000a',
        exploradorUrl: null,
        creadoEn: '2026-11-04T09:05:06.898Z',
      },
      {
        id: '0e3d541c-366b-4bc6-b13b-ab2162f501ad',
        tipo: 'recarga',
        monto: '5.00',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000000b',
        exploradorUrl: null,
        creadoEn: '2026-11-04T03:35:06.898Z',
      },
      {
        id: 'd7101fe3-9229-478d-afd8-f9cd0956c546',
        tipo: 'recarga',
        monto: '7.50',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000000c',
        exploradorUrl: null,
        creadoEn: '2026-11-03T22:05:06.898Z',
      },
      {
        id: 'f862d26f-91a4-43e1-8b1e-d52a2d5c0b59',
        tipo: 'recarga',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000000d',
        exploradorUrl: null,
        creadoEn: '2026-11-03T16:35:06.898Z',
      },
      {
        id: 'ab0596b9-0157-4a2a-bb10-474ad4c1923e',
        tipo: 'recarga',
        monto: '12.50',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000000e',
        exploradorUrl: null,
        creadoEn: '2026-11-03T11:05:06.898Z',
      },
      {
        id: 'ff286de6-8ffe-43e1-bfe5-5331b072b7e6',
        tipo: 'recarga',
        monto: '5.00',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000000f',
        exploradorUrl: null,
        creadoEn: '2026-11-03T05:35:06.898Z',
      },
      {
        id: '18629b53-00f1-4fb9-84f5-d1059e80bed3',
        tipo: 'recarga',
        monto: '7.50',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000010',
        exploradorUrl: null,
        creadoEn: '2026-11-03T00:05:06.898Z',
      },
      {
        id: '82c67eb5-059a-406e-b986-7a56cc7c887b',
        tipo: 'recarga',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000011',
        exploradorUrl: null,
        creadoEn: '2026-11-02T18:35:06.898Z',
      },
      {
        id: '45420378-3108-4b1d-875b-d95b08209b53',
        tipo: 'recarga',
        monto: '12.50',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000012',
        exploradorUrl: null,
        creadoEn: '2026-11-02T13:05:06.898Z',
      },
      {
        id: '6319d846-2efd-46e0-b139-7e2740ccd809',
        tipo: 'recarga',
        monto: '5.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000013',
        exploradorUrl: null,
        creadoEn: '2026-11-02T07:35:06.898Z',
      },
      {
        id: '2a5b4f39-cd1e-40d5-adc7-b5c29e719fef',
        tipo: 'recarga',
        monto: '7.50',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000014',
        exploradorUrl: null,
        creadoEn: '2026-11-02T02:05:06.898Z',
      },
    ],
    total: 46,
    pagina: 1,
    paginas: 3,
  }),
  /** …pagina=2 */
  pagina2: ok(200, {
    items: [
      {
        id: 'a4534aa2-a88e-48f4-aece-8a3e1ae63b3c',
        tipo: 'recarga',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000015',
        exploradorUrl: null,
        creadoEn: '2026-11-01T20:35:06.898Z',
      },
      {
        id: 'aecf0aef-958c-412c-b129-df6234c7d637',
        tipo: 'recarga',
        monto: '12.50',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000016',
        exploradorUrl: null,
        creadoEn: '2026-11-01T15:05:06.898Z',
      },
      {
        id: '55ef17c2-cfd7-4972-abb1-b9c4e91dd0ed',
        tipo: 'recarga',
        monto: '5.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000017',
        exploradorUrl: null,
        creadoEn: '2026-11-01T09:35:06.898Z',
      },
      {
        id: 'ac522b0e-f0c9-4660-bd88-ae54cccf44b9',
        tipo: 'recarga',
        monto: '7.50',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000018',
        exploradorUrl: null,
        creadoEn: '2026-11-01T04:05:06.898Z',
      },
      {
        id: '76a623d7-c697-44fc-8077-29cf4290c4aa',
        tipo: 'recarga',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000019',
        exploradorUrl: null,
        creadoEn: '2026-10-31T22:35:06.898Z',
      },
      {
        id: 'acf6e784-9195-4eae-8a07-1dc626226ddb',
        tipo: 'recarga',
        monto: '12.50',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000001a',
        exploradorUrl: null,
        creadoEn: '2026-10-31T17:05:06.898Z',
      },
      {
        id: '2108ddb6-05da-498f-8636-c29e53664b38',
        tipo: 'recarga',
        monto: '5.00',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000001b',
        exploradorUrl: null,
        creadoEn: '2026-10-31T11:35:06.898Z',
      },
      {
        id: '7dd3ae96-1f87-484a-b5f1-7210cd1e69a4',
        tipo: 'recarga',
        monto: '7.50',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000001c',
        exploradorUrl: null,
        creadoEn: '2026-10-31T06:05:06.898Z',
      },
      {
        id: '8c4d1937-f1bb-4e2f-b0df-5090c2b70295',
        tipo: 'recarga',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000001d',
        exploradorUrl: null,
        creadoEn: '2026-10-31T00:35:06.898Z',
      },
      {
        id: 'f3e2c50f-6cab-42ab-9a54-af1f20c38983',
        tipo: 'recarga',
        monto: '12.50',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000001e',
        exploradorUrl: null,
        creadoEn: '2026-10-30T19:05:06.898Z',
      },
      {
        id: 'd4e6719c-df85-4bbc-aa5d-b9d566b3c51d',
        tipo: 'recarga',
        monto: '5.00',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000001f',
        exploradorUrl: null,
        creadoEn: '2026-10-30T13:35:06.898Z',
      },
      {
        id: '119353e5-b864-4695-b109-f2bef909f046',
        tipo: 'recarga',
        monto: '7.50',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000020',
        exploradorUrl: null,
        creadoEn: '2026-10-30T08:05:06.898Z',
      },
      {
        id: '2d585fbd-8509-43c8-ace6-e1ca0b7c8142',
        tipo: 'recarga',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000021',
        exploradorUrl: null,
        creadoEn: '2026-10-30T02:35:06.898Z',
      },
      {
        id: '9dabd83c-7d1e-43c0-909f-144fc5d65787',
        tipo: 'recarga',
        monto: '12.50',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000022',
        exploradorUrl: null,
        creadoEn: '2026-10-29T21:05:06.898Z',
      },
      {
        id: '39fe624c-457c-4ccc-b314-fd2b795fee6e',
        tipo: 'recarga',
        monto: '5.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000023',
        exploradorUrl: null,
        creadoEn: '2026-10-29T15:35:06.898Z',
      },
      {
        id: 'bcafccda-773f-4302-9ed7-131a4c760e16',
        tipo: 'recarga',
        monto: '7.50',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000024',
        exploradorUrl: null,
        creadoEn: '2026-10-29T10:05:06.898Z',
      },
      {
        id: '36f609f2-4981-4d8d-82d7-4a297d683186',
        tipo: 'recarga',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000025',
        exploradorUrl: null,
        creadoEn: '2026-10-29T04:35:06.898Z',
      },
      {
        id: '30178c17-84c5-41d4-9573-e3a7599acd3d',
        tipo: 'recarga',
        monto: '12.50',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000026',
        exploradorUrl: null,
        creadoEn: '2026-10-28T23:05:06.898Z',
      },
      {
        id: '6b97c5d3-bcfb-43d4-83a7-692c765dc1c1',
        tipo: 'recarga',
        monto: '5.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000027',
        exploradorUrl: null,
        creadoEn: '2026-10-28T17:35:06.898Z',
      },
      {
        id: 'edbbc911-adaf-4cfa-8779-8dbe97b74d19',
        tipo: 'recarga',
        monto: '7.50',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000028',
        exploradorUrl: null,
        creadoEn: '2026-10-28T12:05:06.898Z',
      },
    ],
    total: 46,
    pagina: 2,
    paginas: 3,
  }),
  /** …pagina=3 (las últimas 6) */
  pagina3: ok(200, {
    items: [
      {
        id: '40ce3624-3249-4969-af82-6cea7e1e0f86',
        tipo: 'recarga',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000029',
        exploradorUrl: null,
        creadoEn: '2026-10-28T06:35:06.898Z',
      },
      {
        id: 'a926e7f8-661b-4cb3-b075-3624b0b73778',
        tipo: 'recarga',
        monto: '12.50',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000002a',
        exploradorUrl: null,
        creadoEn: '2026-10-28T01:05:06.898Z',
      },
      {
        id: '51f12b1d-edc1-42a2-919c-293826dec25e',
        tipo: 'recarga',
        monto: '5.00',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000002b',
        exploradorUrl: null,
        creadoEn: '2026-10-27T19:35:06.898Z',
      },
      {
        id: '19ffbbb9-b669-471a-a8d2-1902fd33693d',
        tipo: 'recarga',
        monto: '7.50',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000002c',
        exploradorUrl: null,
        creadoEn: '2026-10-27T14:05:06.898Z',
      },
      {
        id: '976afc57-e5db-4abd-aa8d-945a6f9e0cd6',
        tipo: 'recarga',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000002d',
        exploradorUrl: null,
        creadoEn: '2026-10-27T08:35:06.898Z',
      },
      {
        id: '7f5b5a05-732f-437e-babf-015878688207',
        tipo: 'recarga',
        monto: '12.50',
        estado: 'confirmado',
        hashTx:
          '0x000000000000000000000000000000000000000000000000000000000000002e',
        exploradorUrl: null,
        creadoEn: '2026-10-27T03:05:06.898Z',
      },
    ],
    total: 46,
    pagina: 3,
    paginas: 3,
  }),
  /** …&tipo=reembolso_reserva */
  reembolsos: ok(200, {
    items: [
      {
        id: '32f355eb-40ab-4df2-99b5-56157d623432',
        tipo: 'reembolso_reserva',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000005',
        exploradorUrl: null,
        creadoEn: '2026-11-05T21:35:06.898Z',
      },
    ],
    total: 1,
    pagina: 1,
    paginas: 1,
  }),
  /** …&tipo=bloqueo_reserva,liberacion_viaje (los pagos) */
  pagos: ok(200, {
    items: [
      {
        id: '1e4bc003-59da-4841-b7a1-98bc2555a012',
        tipo: 'liberacion_viaje',
        monto: '12.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        exploradorUrl: null,
        creadoEn: '2026-11-07T00:00:06.897Z',
      },
      {
        id: 'f9f047f3-acd3-4510-a994-e998efe30ec3',
        tipo: 'bloqueo_reserva',
        monto: '15.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000003',
        exploradorUrl: null,
        creadoEn: '2026-11-06T00:35:06.897Z',
      },
      {
        id: '718b8efc-432f-4edf-be9b-b67b97580b34',
        tipo: 'bloqueo_reserva',
        monto: '10.00',
        estado: 'confirmado',
        hashTx:
          '0x0000000000000000000000000000000000000000000000000000000000000004',
        exploradorUrl: null,
        creadoEn: '2026-11-05T20:35:06.897Z',
      },
    ],
    total: 3,
    pagina: 1,
    paginas: 1,
  }),
  /** Persona sin movimientos → 200 */
  vacio: ok(200, { items: [], total: 0, pagina: 1, paginas: 0 }),
  /** Verificada sin billetera → 404 (saldo y movimientos) */
  noEncontrada: ok(404, {
    codigo: 'BILLETERA_NO_ENCONTRADA',
    mensaje: 'Todavía no tienes una billetera.',
  }),
  /** Sin identidad verificada → 403 */
  identidadNoVerificada: ok(403, {
    codigo: 'IDENTIDAD_NO_VERIFICADA',
    mensaje: 'Debes verificar tu identidad para realizar esta acción.',
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
