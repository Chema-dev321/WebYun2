import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

async function verifyFirebaseToken(idToken: string): Promise<boolean> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return false;
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

function buildTemplateLlena(idNap: string, nombre: string, municipio: string, localidad: string, ocupados: number, capacidad: number): string {
  const fecha = new Date().toLocaleString("es-ES", { timeZone: "America/Argentina/Buenos_Aires" });
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ALERTA - NAP Llena</title></head><body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;"><div style="max-width:600px;margin:20px auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);"><div style="background:linear-gradient(135deg,#dc3545 0%,#ffc107 100%);padding:30px 20px;text-align:center;color:#ffffff;"><div style="font-size:48px;margin-bottom:10px;">&#9888;&#65039;</div><h1 style="margin:0;font-size:28px;font-weight:700;">ALERTA: NAP LLENA</h1></div><div style="padding:30px 20px;"><div style="background-color:#fff3cd;border-left:4px solid #dc3545;padding:15px;margin-bottom:20px;border-radius:4px;"><p style="margin:0;color:#856404;font-size:14px;"><strong>Atencion:</strong> La caja NAP ha alcanzado el 100% de su capacidad. No hay puertos disponibles. Se requiere accion tecnica inmediata.</p></div><table style="width:100%;border-collapse:collapse;margin:20px 0;"><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">ID NAP</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${idNap}</td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Nombre</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${nombre}</td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Ubicacion</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${municipio}, ${localidad}</td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Ocupacion</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;"><span style="display:inline-block;background-color:#dc3545;color:#ffffff;padding:5px 15px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;">LLENA - ${ocupados}/${capacidad}</span></td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Fecha del evento</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${fecha}</td></tr></table><p style="color:#6c757d;font-size:14px;">Por favor, revise la infraestructura y planifique una ampliacion o liberacion de puertos lo antes posible.</p></div><div style="background-color:#f8f9fa;padding:20px;text-align:center;color:#6c757d;font-size:12px;border-top:1px solid #e0e0e0;"><p style="margin:5px 0;">Sistema de Monitoreo NAP - Notificacion automatica</p><p style="margin:5px 0;">Este es un mensaje generado automaticamente, no responda a este correo.</p></div></div></body></html>`;
}

function buildTemplateLiberada(idNap: string, nombre: string, municipio: string, localidad: string, ocupados: number, capacidad: number): string {
  const fecha = new Date().toLocaleString("es-ES", { timeZone: "America/Argentina/Buenos_Aires" });
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Puerto Liberado - NAP</title></head><body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;"><div style="max-width:600px;margin:20px auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);"><div style="background:linear-gradient(135deg,#28a745 0%,#17a2b8 100%);padding:30px 20px;text-align:center;color:#ffffff;"><div style="font-size:48px;margin-bottom:10px;">&#9989;</div><h1 style="margin:0;font-size:28px;">PUERTO LIBERADO</h1></div><div style="padding:30px 20px;"><div style="background-color:#d1ecf1;border-left:4px solid #17a2b8;padding:15px;margin-bottom:20px;border-radius:4px;"><p style="margin:0;color:#0c5460;font-size:14px;"><strong>Informacion:</strong> Se libero un puerto en la NAP que estaba al 100% de capacidad. Ya hay espacio disponible para nuevas asignaciones.</p></div><table style="width:100%;border-collapse:collapse;margin:20px 0;"><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">ID NAP</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${idNap}</td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Nombre</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${nombre}</td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Ubicacion</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${municipio}, ${localidad}</td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Ocupacion actual</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;"><span style="display:inline-block;background-color:#28a745;color:#ffffff;padding:5px 15px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;">${ocupados}/${capacidad} - Disponible</span></td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Fecha del evento</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${fecha}</td></tr></table><p style="color:#6c757d;font-size:14px;">La NAP ya no esta saturada. Puede proceder con nuevas asignaciones.</p></div><div style="background-color:#f8f9fa;padding:20px;text-align:center;color:#6c757d;font-size:12px;border-top:1px solid #e0e0e0;"><p style="margin:5px 0;">Sistema de Monitoreo NAP - Notificacion automatica</p><p style="margin:5px 0;">Este es un mensaje generado automaticamente, no responda a este correo.</p></div></div></body></html>`;
}

function buildTemplateVacia(idNap: string, nombre: string, municipio: string, localidad: string, ocupados: number, capacidad: number): string {
  const fecha = new Date().toLocaleString("es-ES", { timeZone: "America/Argentina/Buenos_Aires" });
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>NAP Disponible</title></head><body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;"><div style="max-width:600px;margin:20px auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);"><div style="background:linear-gradient(135deg,#28a745 0%,#17a2b8 100%);padding:30px 20px;text-align:center;color:#ffffff;"><div style="font-size:48px;margin-bottom:10px;">&#9989;</div><h1 style="margin:0;font-size:28px;font-weight:700;">NAP DISPONIBLE</h1></div><div style="padding:30px 20px;"><div style="background-color:#d1ecf1;border-left:4px solid #17a2b8;padding:15px;margin-bottom:20px;border-radius:4px;"><p style="margin:0;color:#0c5460;font-size:14px;"><strong>Informacion:</strong> La caja NAP se ha liberado completamente y esta 100% disponible para nuevas asignaciones.</p></div><table style="width:100%;border-collapse:collapse;margin:20px 0;"><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">ID NAP</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${idNap}</td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Nombre</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${nombre}</td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Ubicacion</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${municipio}, ${localidad}</td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Estado</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;"><span style="display:inline-block;background-color:#28a745;color:#ffffff;padding:5px 15px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;">VACIA - ${ocupados}/${capacidad}</span></td></tr><tr><th style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;background-color:#f8f9fa;color:#495057;font-weight:600;width:40%;">Fecha del evento</th><td style="padding:12px 15px;text-align:left;border-bottom:1px solid #e0e0e0;color:#212529;">${fecha}</td></tr></table><p style="color:#6c757d;font-size:14px;">La caja NAP esta lista para recibir nuevas conexiones. Puede proceder con las asignaciones programadas.</p></div><div style="background-color:#f8f9fa;padding:20px;text-align:center;color:#6c757d;font-size:12px;border-top:1px solid #e0e0e0;"><p style="margin:5px 0;">Sistema de Monitoreo NAP - Notificacion automatica</p><p style="margin:5px 0;">Este es un mensaje generado automaticamente, no responda a este correo.</p></div></div></body></html>`;
}

export async function POST(req: NextRequest) {
  try {
    // Verify Firebase Auth token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token || !(await verifyFirebaseToken(token))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { tipoEvento, idNap, nombre, municipio, localidad, ocupados, capacidad } = body;

    if (!tipoEvento || !idNap || !nombre) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "my.mailbux.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: process.env.NODE_ENV === "development" ? { rejectUnauthorized: false } : undefined,
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });

    const emailLlena = (process.env.EMAIL_TO || "chemjmme@gmail.com")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const emailLiberada = (process.env.EMAIL_TO_LIBERADA || "chemjmme@gmail.com")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    let asunto: string;
    let html: string;
    let destinatarios: string[];

    switch (tipoEvento) {
      case "LLENA":
        asunto = `[ALERTA] NAP LLENA: ${nombre} (${idNap})`;
        html = buildTemplateLlena(idNap, nombre, municipio, localidad, ocupados, capacidad);
        destinatarios = emailLlena;
        break;
      case "LIBERADA":
        asunto = `[INFO] Puerto liberado de NAP llena: ${nombre} (${idNap})`;
        html = buildTemplateLiberada(idNap, nombre, municipio, localidad, ocupados, capacidad);
        destinatarios = emailLiberada;
        break;
      case "VACIA":
        asunto = `[INFO] NAP VACIA: ${nombre} (${idNap})`;
        html = buildTemplateVacia(idNap, nombre, municipio, localidad, ocupados, capacidad);
        destinatarios = emailLlena;
        break;
      default:
        return NextResponse.json({ error: "Tipo de evento invalido" }, { status: 400 });
    }

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "chema.it@hulux.org",
      to: destinatarios,
      subject: asunto,
      html,
    });

    return NextResponse.json({ success: true, evento: tipoEvento, idNap });
  } catch (error) {
    console.error("[NAP Notify API] Error:", error);
    return NextResponse.json({ error: "Error al enviar email" }, { status: 500 });
  }
}
