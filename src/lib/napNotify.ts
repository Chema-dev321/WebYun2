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

    // Use absolute URL so this works both in the browser (client) and on the
    // Vercel serverless runtime (server). NEXT_PUBLIC_APP_URL must be set in
    // Vercel → Settings → Environment Variables, e.g. https://tu-app.vercel.app
    const baseUrl =
      typeof window !== "undefined"
        ? "" // browser — relative URL works fine
        : process.env.NEXT_PUBLIC_APP_URL || ""; // server — needs absolute URL

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
