import * as AlmacenSeguro from 'expo-secure-store';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { elegirPaleta, type Paleta } from './paletas';

export type ModoTema = 'automatico' | 'claro' | 'oscuro';
export type TamanoTexto = 'normal' | 'grande' | 'muy_grande';

export interface Apariencia {
  tema: ModoTema;
  texto: TamanoTexto;
  altoContraste: boolean;
}

/** RN-2: por defecto, Automático, Normal y sin alto contraste. */
export const APARIENCIA_INICIAL: Apariencia = {
  tema: 'automatico',
  texto: 'normal',
  altoContraste: false,
};

/** HU-31 CA-4: ×1,15 y ×1,3; el tope de ×1,5 (RN-5) protege el diseño si se sumaran más escalas. */
export const ESCALAS: Record<TamanoTexto, number> = {
  normal: 1,
  grande: 1.15,
  muy_grande: 1.3,
};
export const TOPE_ESCALA = 1.5;

const CLAVE = 'uniride.apariencia';
const MODOS: ModoTema[] = ['automatico', 'claro', 'oscuro'];
const TAMANOS: TamanoTexto[] = ['normal', 'grande', 'muy_grande'];

/** CA-10: un dato guardado que no entienda cada campo vuelve a su valor por defecto, sin fallar. */
export function leerApariencia(crudo: string | null): Apariencia {
  try {
    const dato = JSON.parse(crudo ?? '') as Partial<Apariencia> | null;
    return {
      tema: MODOS.includes(dato?.tema as ModoTema)
        ? (dato!.tema as ModoTema)
        : APARIENCIA_INICIAL.tema,
      texto: TAMANOS.includes(dato?.texto as TamanoTexto)
        ? (dato!.texto as TamanoTexto)
        : APARIENCIA_INICIAL.texto,
      altoContraste:
        typeof dato?.altoContraste === 'boolean'
          ? dato.altoContraste
          : APARIENCIA_INICIAL.altoContraste,
    };
  } catch {
    return APARIENCIA_INICIAL;
  }
}

interface ContextoTema {
  apariencia: Apariencia;
  colores: Paleta;
  /** `claro` u `oscuro` ya resuelto (el automático sigue al teléfono). */
  esquema: 'claro' | 'oscuro';
  escala: number;
  /** `true` si la última elección no se pudo guardar: rige en esta sesión (§4 de la spec). */
  noGuardada: boolean;
  actualizar: (cambio: Partial<Apariencia>) => void;
}

const porDefecto: ContextoTema = {
  apariencia: APARIENCIA_INICIAL,
  colores: elegirPaleta('claro', false),
  esquema: 'claro',
  escala: 1,
  noGuardada: false,
  actualizar: () => undefined,
};

// Sin proveedor (pruebas, pantallas sueltas) rige el tema claro y el texto normal.
const Contexto = createContext<ContextoTema>(porDefecto);

/** HU-31: la preferencia vive solo en el teléfono (RN-1) y se aplica al instante, sin reiniciar. */
export function ProveedorTema({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const [apariencia, setApariencia] = useState(APARIENCIA_INICIAL);
  const [noGuardada, setNoGuardada] = useState(false);

  useEffect(() => {
    let vigente = true;
    AlmacenSeguro.getItemAsync(CLAVE)
      .then((crudo) => vigente && setApariencia(leerApariencia(crudo)))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, []);

  const actualizar = useCallback((cambio: Partial<Apariencia>) => {
    setApariencia((anterior) => {
      const nueva = { ...anterior, ...cambio };
      AlmacenSeguro.setItemAsync(CLAVE, JSON.stringify(nueva)).then(
        () => setNoGuardada(false),
        () => setNoGuardada(true),
      );
      return nueva;
    });
  }, []);

  const valor = useMemo<ContextoTema>(() => {
    const esquema =
      apariencia.tema === 'automatico'
        ? sistema === 'dark'
          ? 'oscuro'
          : 'claro'
        : apariencia.tema;
    return {
      apariencia,
      colores: elegirPaleta(esquema, apariencia.altoContraste),
      esquema,
      escala: Math.min(ESCALAS[apariencia.texto], TOPE_ESCALA),
      noGuardada,
      actualizar,
    };
  }, [apariencia, sistema, noGuardada, actualizar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useTema = () => useContext(Contexto);
