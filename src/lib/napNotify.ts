import { auth } from "./firebase";

interface NapNotifyParams {
  tipoEvento: "LLENA" | "LIBERADA" | "VACIA";
  idNap: string;
  nombre: string;
  municipio: string;
  localidad: string;
  ocupados: number;
  capacidad: number;
}

export async function notifyNapEvent(params: NapNotifyParams): Promise<void> {
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

    const response = await fetch("/api/nap-notify", {
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
