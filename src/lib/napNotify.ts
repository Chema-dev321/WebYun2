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
    const response = await fetch("/api/nap-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error("[NAP Notify] Error en la respuesta:", response.status);
      return;
    }

    const data = await response.json();
    console.log(`[NAP Notify] Email enviado: ${data.evento} - ${data.idNap}`);
  } catch (error) {
    console.error("[NAP Notify] Error al enviar notificacion:", error);
  }
}
