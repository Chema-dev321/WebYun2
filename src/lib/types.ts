export interface NAP {
  id: string;
  id_nap: string;
  nombre: string;
  municipio: string;
  localidad: string;
  capacidad_total: number;
  puertos_ocupados: number;
  estado_tomodat: string;
  verificacion: number;
  latitud?: number;
  longitud?: number;
}

export interface Cliente {
  id: string;
  id_wisp: string;
  nombre: string;
  municipio: string;
  localidad: string;
  id_nap: string;
  fecha_alta: string;
}

export interface LocalidadEntry {
  municipio: string;
  localidad: string;
}

