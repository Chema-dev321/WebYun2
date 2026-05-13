import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

admin.initializeApp();

const NOTIFY_EMAIL = "network.services@hulux.mx";

interface NAPData {
  nombre: string;
  municipio: string;
  localidad: string;
  capacidad_total: number;
  puertos_ocupados: number;
}

interface ClienteData {
  nombre: string;
  id_wisp: string;
  id_nap: string;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendEmail(subject: string, body: string): Promise<void> {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@hulux.mx",
    to: NOTIFY_EMAIL,
    subject,
    html: body,
  });
}

/**
 * Se dispara cuando un documento en `naps` es actualizado.
 * Detecta si una NAP llegó al 100% de capacidad y envía alerta.
 */
export const onNAPUpdated = functions.firestore
  .document("naps/{napId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as NAPData;
    const after = change.after.data() as NAPData;
    const napId = context.params.napId;

    const beforeFull = before.puertos_ocupados >= before.capacidad_total;
    const afterFull = after.puertos_ocupados >= after.capacidad_total;

    // NAP recién saturada (no lo estaba antes, ahora sí)
    if (!beforeFull && afterFull) {
      const subject = `[ALERTA] NAP saturada: ${after.nombre}`;
      const body = `
        <h2>NAP al 100% de capacidad</h2>
        <p><strong>NAP:</strong> ${after.nombre} (${napId})</p>
        <p><strong>Ubicación:</strong> ${after.municipio}, ${after.localidad}</p>
        <p><strong>Ocupación:</strong> ${after.puertos_ocupados} / ${after.capacidad_total}</p>
        <p style="color:red;font-weight:bold;">⚠️ Se requiere acción inmediata.</p>
      `;
      await sendEmail(subject, body);
      functions.logger.info("NAP saturation alert sent for", napId);
    }

    // Sobre-ocupación detectada (error)
    if (after.puertos_ocupados > after.capacidad_total) {
      const subject = `[ERROR] Sobre-ocupación en NAP: ${after.nombre}`;
      const body = `
        <h2>ERROR: NAP con sobre-ocupación</h2>
        <p><strong>NAP:</strong> ${after.nombre} (${napId})</p>
        <p><strong>Ocupación:</strong> ${after.puertos_ocupados} / ${after.capacidad_total}</p>
        <p style="color:purple;font-weight:bold;">🟣 El contador supera la capacidad. Revisar manualmente.</p>
      `;
      await sendEmail(subject, body);
      functions.logger.error("NAP over-occupation detected for", napId);
    }
  });

/**
 * Se dispara cuando un cliente es eliminado de Firestore.
 * Envía notificación de puerto liberado.
 */
export const onClienteDeleted = functions.firestore
  .document("clientes/{clienteId}")
  .onDelete(async (snap) => {
    const data = snap.data() as ClienteData;

    // Obtener info de la NAP asociada
    const napSnap = await admin
      .firestore()
      .collection("naps")
      .doc(data.id_nap)
      .get();

    const napData = napSnap.exists ? (napSnap.data() as NAPData) : null;

    const subject = `[INFO] Puerto liberado — Cliente: ${data.nombre}`;
    const body = `
      <h2>Puerto liberado</h2>
      <p><strong>Cliente eliminado:</strong> ${data.nombre} (ID WISP: ${data.id_wisp})</p>
      ${
        napData
          ? `<p><strong>NAP:</strong> ${napData.nombre} — ahora ${napData.puertos_ocupados - 1} / ${napData.capacidad_total} ocupados</p>
             <p><strong>Ubicación:</strong> ${napData.municipio}, ${napData.localidad}</p>`
          : ""
      }
    `;
    await sendEmail(subject, body);
    functions.logger.info("Port freed notification sent for", data.id_wisp);
  });
