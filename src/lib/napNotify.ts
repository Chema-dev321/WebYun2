import { auth } from "./firebase";

/**
 * Parámetros requeridos para notificar un cambio de estado en una Caja NAP vía correo electrónico.
 */
interface NapNotifyParams {
  /** Tipo de evento ocurrido ('LLENA' al saturarse, 'LIBERADA' al liberar puerto, 'VACIA' al quedar sin clientes) */
  tipoEvento: "LLENA" | "LIBERADA" | "VACIA";
  /** Identificador de la NAP (ej. 'NAP-SCL-01') */
  idNap: string;
  /** Nombre descriptivo de la NAP */
  nombre: string;
  /** Municipio de la NAP */
  municipio: string;
  /** Localidad de la NAP */
  localidad: string;
  /** Cantidad actual de puertos ocupados */
  ocupados: number;
  /** Capacidad total de puertos */
  capacidad: number;
}

/**
 * Envía un webhook/petición a `/api/nap-notify` para disparar una notificación por correo electrónico.
 * Incluye el Token JWT del usuario autenticado actual para autorización.
 *
 * @param params Datos de la NAP y el evento a notificar.
 */
export async function notifyNapEvent(params: NapNotifyParams): Promise<void> {
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

    // Determina la URL base absoluta según si se ejecuta en cliente o servidor Next.js
    const baseUrl =
      typeof window !== "undefined"
        ? "" // Navegador: soporta ruta relativa
        : process.env.NEXT_PUBLIC_APP_URL || ""; // Servidor: requiere URL absoluta

    const response = await fetch(`${baseUrl}/api/nap-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[NAP Notify] Error HTTP ${response.status}: ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log(`[NAP Notify] Email enviado exitosamente: ${data.evento} - ${data.idNap}`);
  } catch (error) {
    console.error("[NAP Notify] Error al enviar notificacion:", error);
  }
}

