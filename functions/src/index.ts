import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

admin.initializeApp();

const NOTIFY_EMAIL = process.env.EMAIL_TO || "chemjmme@gmail.com";
const SMTP_FROM = process.env.EMAIL_FROM || "chema.it@hulux.org";

interface NAPData {
  id_nap: string;
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
  municipio: string;
  localidad: string;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "my.mailbux.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "chema.it@hulux.org",
      pass: process.env.SMTP_PASS || "",
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });
}

async function sendEmail(subject: string, html: string): Promise<void> {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: SMTP_FROM,
    to: NOTIFY_EMAIL,
    subject,
    html,
  });
}

function getFechaLocal(): string {
  return new Date().toLocaleString("es-ES", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildTemplateLlena(nap: NAPData, napId: string): string {
  const fecha = getFechaLocal();
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ALERTA - NAP Llena</title></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;">
  <div style="max-width:600px;margin:20px auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#dc3545 0%,#ffc107 100%);padding:30px 20px;text-align:center;color:#ffffff;">
      <div style="font-size:48px;margin-bottom:10px;">&#9888;&#65039;</div>
      <h1 style="margin:0;font-size:28px;font-weight:700;">ALERTA: NAP LLENA</h1>
    </div>
    <div style="padding:30px 20px;">
      <div style="background-color:#fff3cd;border-left:4px solid #dc3545;padding:15px;margin-bottom:20px;border-radius:4px;">
        <p style="margin:0;color:#856404;font-size:14px;"><strong>Atencion:</strong> La caja NAP ha alcanzado el 100% de su capacidad. No hay puertos disponibles. Se requiere accion tecnica inmediata.</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">ID NAP</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${napId}</td></tr>
        <tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Nombre</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${nap.nombre}</td></tr>
        <tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Ubicacion</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${nap.municipio}, ${nap.localidad}</td></tr>
        <tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Ocupacion</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;"><span style="display:inline-block;background-color:#dc3545;color:#ffffff;padding:5px 15px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;">LLENA - ${nap.puertos_ocupados}/${nap.capacidad_total}</span></td></tr>
        <tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Fecha del evento</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${fecha}</td></tr>
      </table>
      <p style="color:#6c757d;font-size:14px;">Por favor, revise la infraestructura y planifique una ampliacion o liberacion de puertos lo antes posible.</p>
    </div>
    <div style="background-color:#f8f9fa;padding:20px;text-align:center;color:#6c757d;font-size:12px;border-top:1px solid #e0e0e0;">
      <p style="margin:5px 0;">Sistema de Monitoreo NAP - Notificacion automatica</p>
      <p style="margin:5px 0;">Este es un mensaje generado automaticamente, no responda a este correo.</p>
    </div>
  </div>
</body>
</html>`;
}

function buildTemplateVacia(nap: NAPData, napId: string): string {
  const fecha = getFechaLocal();
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>NAP Disponible</title></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;">
  <div style="max-width:600px;margin:20px auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#28a745 0%,#17a2b8 100%);padding:30px 20px;text-align:center;color:#ffffff;">
      <div style="font-size:48px;margin-bottom:10px;">&#9989;</div>
      <h1 style="margin:0;font-size:28px;font-weight:700;">NAP DISPONIBLE</h1>
    </div>
    <div style="padding:30px 20px;">
      <div style="background-color:#d1ecf1;border-left:4px solid #17a2b8;padding:15px;margin-bottom:20px;border-radius:4px;">
        <p style="margin:0;color:#0c5460;font-size:14px;"><strong>Informacion:</strong> La caja NAP se ha liberado completamente y esta 100% disponible para nuevas asignaciones.</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">ID NAP</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${napId}</td></tr>
        <tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Nombre</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${nap.nombre}</td></tr>
        <tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Ubicacion</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${nap.municipio}, ${nap.localidad}</td></tr>
        <tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Estado</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;"><span style="display:inline-block;background-color:#28a745;color:#ffffff;padding:5px 15px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;">VACIA - 0/${nap.capacidad_total}</span></td></tr>
        <tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Fecha del evento</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${fecha}</td></tr>
      </table>
      <p style="color:#6c757d;font-size:14px;">La caja NAP esta lista para recibir nuevas conexiones. Puede proceder con las asignaciones programadas.</p>
    </div>
    <div style="background-color:#f8f9fa;padding:20px;text-align:center;color:#6c757d;font-size:12px;border-top:1px solid #e0e0e0;">
      <p style="margin:5px 0;">Sistema de Monitoreo NAP - Notificacion automatica</p>
      <p style="margin:5px 0;">Este es un mensaje generado automaticamente, no responda a este correo.</p>
    </div>
  </div>
</body>
</html>`;
}

export const onNAPUpdated = functions.firestore
  .document("naps/{napId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as NAPData;
    const after = change.after.data() as NAPData;
    const napId = context.params.napId;

    try {
      const beforeFull = before.puertos_ocupados >= before.capacidad_total;
      const afterFull = after.puertos_ocupados >= after.capacidad_total;
      const wasEmpty = before.puertos_ocupados === 0;
      const isEmpty = after.puertos_ocupados === 0;

      if (!beforeFull && afterFull) {
        const subject = `[ALERTA] NAP LLENA: ${after.nombre} (${napId})`;
        const html = buildTemplateLlena(after, napId);
        await sendEmail(subject, html);
        functions.logger.info(`NAP LLENA alert sent: ${napId}`);
      }

      if (!wasEmpty && isEmpty && after.capacidad_total > 0) {
        const subject = `[INFO] NAP VACIA: ${after.nombre} (${napId})`;
        const html = buildTemplateVacia(after, napId);
        await sendEmail(subject, html);
        functions.logger.info(`NAP VACIA alert sent: ${napId}`);
      }

      if (after.puertos_ocupados > after.capacidad_total) {
        const subject = `[ERROR] Sobre-ocupacion NAP: ${after.nombre} (${napId})`;
        const html = `
          <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);font-family:'Segoe UI',sans-serif;">
            <div style="background:linear-gradient(135deg,#6f42c1,#dc3545);padding:30px;text-align:center;color:#fff;">
              <h1 style="margin:0;font-size:28px;">ERROR: Sobre-ocupacion NAP</h1>
            </div>
            <div style="padding:30px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><th style="padding:12px;text-align:left;border-bottom:1px solid #e0e0e0;background:#f8f9fa;width:40%;">ID NAP</th><td style="padding:12px;border-bottom:1px solid #e0e0e0;">${napId}</td></tr>
                <tr><th style="padding:12px;text-align:left;border-bottom:1px solid #e0e0e0;background:#f8f9fa;">Nombre</th><td style="padding:12px;border-bottom:1px solid #e0e0e0;">${after.nombre}</td></tr>
                <tr><th style="padding:12px;text-align:left;border-bottom:1px solid #e0e0e0;background:#f8f9fa;">Ocupacion</th><td style="padding:12px;border-bottom:1px solid #e0e0e0;color:#dc3545;font-weight:bold;">${after.puertos_ocupados} / ${after.capacidad_total}</td></tr>
              </table>
              <p style="color:#6c757d;margin-top:20px;">El contador de puertos supera la capacidad total. Revisar manualmente.</p>
            </div>
          </div>`;
        await sendEmail(subject, html);
        functions.logger.error(`NAP over-occupation: ${napId}`);
      }
    } catch (error) {
      functions.logger.error(`Error in onNAPUpdated for ${napId}:`, error);
    }
  });

export const onClienteDeleted = functions.firestore
  .document("clientes/{clienteId}")
  .onDelete(async (snap) => {
    const data = snap.data() as ClienteData;

    try {
      const napSnap = await admin
        .firestore()
        .collection("naps")
        .doc(data.id_nap)
        .get();

      if (napSnap.exists) {
        const napData = napSnap.data() as NAPData;

        if (napData.puertos_ocupados === 0) {
          const subject = `[INFO] NAP VACIA: ${napData.nombre} (${data.id_nap})`;
          const html = buildTemplateVacia(napData, data.id_nap);
          await sendEmail(subject, html);
          functions.logger.info(`NAP VACIA alert sent on delete: ${data.id_nap}`);
        }
      }

      const subject = `[INFO] Puerto liberado - Cliente: ${data.nombre}`;
      const html = `
        <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);font-family:'Segoe UI',sans-serif;">
          <div style="background:linear-gradient(135deg,#28a745,#17a2b8);padding:30px;text-align:center;color:#fff;">
            <h1 style="margin:0;font-size:28px;">Puerto Liberado</h1>
          </div>
          <div style="padding:30px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><th style="padding:12px;text-align:left;border-bottom:1px solid #e0e0e0;background:#f8f9fa;width:40%;">Cliente</th><td style="padding:12px;border-bottom:1px solid #e0e0e0;">${data.nombre}</td></tr>
              <tr><th style="padding:12px;text-align:left;border-bottom:1px solid #e0e0e0;background:#f8f9fa;">ID WISP</th><td style="padding:12px;border-bottom:1px solid #e0e0e0;">${data.id_wisp}</td></tr>
              <tr><th style="padding:12px;text-align:left;border-bottom:1px solid #e0e0e0;background:#f8f9fa;">NAP</th><td style="padding:12px;border-bottom:1px solid #e0e0e0;">${data.id_nap}</td></tr>
            </table>
            <p style="color:#6c757d;margin-top:20px;">El puerto ha sido liberado exitosamente.</p>
          </div>
        </div>`;
      await sendEmail(subject, html);
      functions.logger.info(`Port freed notification sent: ${data.id_wisp}`);
    } catch (error) {
      functions.logger.error(`Error in onClienteDeleted for ${data.id_wisp}:`, error);
    }
  });
