require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const SMTP_CONFIG = {
    host: process.env.SMTP_HOST || 'my.mailbux.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    socketTimeout: 10000
};

const EMAIL_FROM = process.env.EMAIL_FROM || 'chema.it@hulux.org';
const EMAIL_TO = process.env.EMAIL_TO || 'chemjmme@gmail.com';

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport(SMTP_CONFIG);
    }
    return transporter;
}

function loadTemplate(tipoEvento) {
    const templateFile = tipoEvento === 'LLENA' ? 'templateLlena.html' : 'templateVacia.html';
    const templatePath = path.join(__dirname, 'templates', templateFile);
    return fs.readFileSync(templatePath, 'utf-8');
}

function renderTemplate(template, data) {
    return template
        .replace(/{{ID_NAP}}/g, data.idNap)
        .replace(/{{UBICACION}}/g, data.ubicacion)
        .replace(/{{FECHA}}/g, data.fecha);
}

async function sendNapNotification(idNap, ubicacion, tipoEvento) {
    const tiposValidos = ['LLENA', 'VACIA'];
    
    if (!tiposValidos.includes(tipoEvento.toUpperCase())) {
        throw new Error(`Tipo de evento invalido: ${tipoEvento}. Debe ser 'LLENA' o 'VACIA'`);
    }

    if (!idNap || !ubicacion) {
        throw new Error('ID_NAP y Ubicacion son requeridos');
    }

    const evento = tipoEvento.toUpperCase();
    const fecha = new Date().toLocaleString('es-ES', {
        timeZone: 'America/Argentina/Buenos_Aires'
    });

    const asunto = evento === 'LLENA' 
        ? `ALERTA: NAP ${idNap} LLENA - ${ubicacion}`
        : `INFO: NAP ${idNap} DISPONIBLE - ${ubicacion}`;

    try {
        const template = loadTemplate(evento);
        const htmlContent = renderTemplate(template, {
            idNap,
            ubicacion,
            fecha
        });

        const mailOptions = {
            from: EMAIL_FROM,
            to: EMAIL_TO,
            subject: asunto,
            html: htmlContent,
            priority: evento === 'LLENA' ? 'high' : 'normal'
        };

        const mailer = getTransporter();
        const info = await mailer.sendMail(mailOptions);

        console.log(`[NAP Notifier] Email enviado exitosamente - Evento: ${evento}, NAP: ${idNap}, MessageID: ${info.messageId}`);
        return { success: true, messageId: info.messageId, evento, idNap };

    } catch (error) {
        console.error(`[NAP Notifier] ERROR al enviar email - Evento: ${evento}, NAP: ${idNap}`);
        console.error(`[NAP Notifier] Detalle del error: ${error.message}`);
        
        if (error.code === 'ESOCKET' || error.code === 'ECONNECTION') {
            console.error('[NAP Notifier] Error de conexion SMTP. Verifique host, puerto y credenciales.');
        } else if (error.code === 'EAUTH') {
            console.error('[NAP Notifier] Error de autenticacion SMTP. Verifique usuario y contraseña.');
        } else if (error.code === 'ETIMEOUT') {
            console.error('[NAP Notifier] Timeout de conexion SMTP. El servidor no responde.');
        }
        
        return { success: false, error: error.message, evento, idNap };
    }
}

module.exports = { sendNapNotification };
