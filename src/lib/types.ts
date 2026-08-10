/**
 * Representa una Caja NAP (Network Access Point) en el sistema.
 */
export interface NAP {
  /** ID único del documento en Firestore */
  id: string;
  /** Identificador operativo de la NAP (ej. 'NAP-SCL-01') */
  id_nap: string;
  /** Nombre asignado a la NAP */
  nombre: string;
  /** Municipio donde se encuentra ubicada la NAP */
  municipio: string;
  /** Localidad específica dentro del municipio */
  localidad: string;
  /** Capacidad total de puertos instalados (ej. 8 o 16) */
  capacidad_total: number;
  /** Cantidad actual de puertos ocupados por clientes */
  puertos_ocupados: number;
  /** Estado reportado por el sistema Tomodat ('Activo', 'Rojo', etc.) */
  estado_tomodat: string;
  /** Estado de verificación física en campo (1: Verificada, 0: No verificada) */
  verificacion: number;
  /** Fecha en formato ISO de la última revisión o auditoría física en campo */
  fecha_verificacion?: string;
  /** Coordenada de latitud geográfica (para renderizado en mapa) */
  latitud?: number;
  /** Coordenada de longitud geográfica (para renderizado en mapa) */
  longitud?: number;
}

/**
 * Representa a un cliente final conectado a una NAP.
 */
export interface Cliente {
  /** ID único del documento en Firestore */
  id: string;
  /** Identificador único del cliente en el sistema WISP */
  id_wisp: string;
  /** Nombre completo o razón social del cliente */
  nombre: string;
  /** Municipio de residencia/instalación */
  municipio: string;
  /** Localidad de residencia/instalación */
  localidad: string;
  /** ID operativo de la NAP a la cual está conectado (corresponde a `NAP.id_nap`) */
  id_nap: string;
  /** Fecha de registro o alta en el sistema (formato ISO) */
  fecha_alta: string;
}

/**
 * Representa la asociación de un municipio con una de sus localidades.
 */
export interface LocalidadEntry {
  /** Nombre del municipio */
  municipio: string;
  /** Nombre de la localidad */
  localidad: string;
}

