import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as api from '@/api/cliente';

interface Sesion {
  /** `true` mientras se intenta recuperar la sesión guardada. */
  cargando: boolean;
  usuario: api.Usuario | null;
  iniciar: (correo: string, contrasena: string) => Promise<void>;
  /** Confirma el código del registro: crea la cuenta e inicia la sesión. */
  confirmarCodigo: (correo: string, codigo: string) => Promise<void>;
  /** Confirma el código de otra organización (HU-07) y devuelve la membresía creada. */
  confirmarOrganizacion: (
    correo: string,
    codigo: string,
  ) => Promise<api.Membresia>;
  /** Elige la organización activa sin cerrar sesión; guarda el token de acceso nuevo. */
  cambiarOrganizacion: (organizacionId: string) => Promise<void>;
  cerrar: () => Promise<void>;
}

const Contexto = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState<api.Usuario | null>(null);

  useEffect(() => {
    let vigente = true;
    (async () => {
      const u = (await api.renovarSesion())
        ? await api.consultarYo().catch(() => null)
        : null;
      if (vigente) {
        setUsuario(u);
        setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  const iniciar = async (correo: string, contrasena: string) => {
    await api.iniciarSesion(correo, contrasena);
    setUsuario(await api.consultarYo());
  };
  const confirmarCodigo = async (correo: string, codigo: string) => {
    await api.verificarOtp(correo, codigo);
    setUsuario(await api.consultarYo());
  };
  const confirmarOrganizacion = async (correo: string, codigo: string) => {
    const { membresia } = await api.confirmarOrganizacion(correo, codigo);
    // Sin organización activa (solo pendientes), la primera aprobada pasa a serlo con un token que la lleve.
    if (membresia.estado === 'aprobada' && !usuario?.organizacionActiva) {
      await api.cambiarOrganizacionActiva(membresia.organizacionId);
    }
    setUsuario(await api.consultarYo());
    return membresia;
  };
  const cambiarOrganizacion = async (organizacionId: string) => {
    await api.cambiarOrganizacionActiva(organizacionId);
    setUsuario(await api.consultarYo());
  };
  const cerrar = async () => {
    await api.cerrarSesion().catch(() => undefined);
    setUsuario(null);
  };

  return (
    <Contexto
      value={{
        cargando,
        usuario,
        iniciar,
        confirmarCodigo,
        confirmarOrganizacion,
        cambiarOrganizacion,
        cerrar,
      }}
    >
      {children}
    </Contexto>
  );
}

export function useSesion(): Sesion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSesion requiere <ProveedorSesion>');
  return valor;
}
