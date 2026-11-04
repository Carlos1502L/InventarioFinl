import nodemailer from 'nodemailer';

/**
 * Servicio unificado de despacho de correos electrónicos con archivos adjuntos.
 * Soporta Resend API, credenciales SMTP estándar (Gmail, SendGrid, Mailtrap, Brevo)
 * y fallback automático a transport de desarrollo / Ethereal.
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });
      console.log(`✉️ [EmailService] Configurado transporte SMTP: ${smtpHost}:${smtpPort}`);
    } else {
      console.warn('⚠️ [EmailService] SMTP no configurado en .env. Se usará modo simulado / Resend si está disponible.');
    }
  }

  /**
   * Envía el correo con el archivo JSON de respaldo adjunto.
   *
   * @param {Object} options
   * @param {string} options.to - Correo destinatario
   * @param {string} options.inventoryName - Nombre del inventario
   * @param {Buffer|string} options.jsonContent - Contenido del archivo JSON
   * @param {string} options.filename - Nombre del archivo adjunto (ej. backup_tienda_20261103.json)
   * @param {Object} [options.summary] - Conteo resumido de datos
   * @returns {Promise<{ success: boolean, messageId?: string, mode: string }>}
   */
  async sendBackupEmail({ to, inventoryName, jsonContent, filename, summary = {} }) {
    const formattedDate = new Date().toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const subject = `📦 Copia de Seguridad - ${inventoryName} - ${formattedDate}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { background-color: #1e3a5f; color: #ffffff; padding: 28px 32px; }
            .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
            .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.85; }
            .body { padding: 32px; }
            .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
            .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 12px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .stat { font-size: 13px; color: #334155; }
            .stat strong { color: #0f172a; }
            .footer { padding: 20px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
            .badge { display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📦 Respaldo de Inventario</h1>
              <p>${inventoryName} &bull; ${formattedDate}</p>
            </div>
            <div class="body">
              <p>Hola,</p>
              <p>Adjunto a este correo encontrarás el archivo oficial de copia de seguridad (<strong>${filename}</strong>) generado para tu inventario.</p>
              
              <div class="card">
                <div class="card-title">Resumen de Contenido Respaldado</div>
                <div class="grid">
                  <div class="stat">📦 Productos: <strong>${summary.products ?? 'N/A'}</strong></div>
                  <div class="stat">📍 Ubicaciones: <strong>${summary.locations ?? 'N/A'}</strong></div>
                  <div class="stat">🏷️ Categorías: <strong>${summary.categories ?? 'N/A'}</strong></div>
                  <div class="stat">💰 Ventas Históricas: <strong>${summary.sales ?? 'N/A'}</strong></div>
                </div>
              </div>

              <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                <strong>Nota de Seguridad:</strong> Este archivo <code>.json</code> contiene la estructura completa de tu inventario. Guárdalo en un lugar seguro. Puedes restaurarlo en cualquier momento desde el módulo de <em>Ajustes &gt; Copias de Seguridad</em> de la aplicación.
              </p>
            </div>
            <div class="footer">
              Enviado automáticamente por el Sistema de Gestión de Inventario Stockly.
            </div>
          </div>
        </body>
      </html>
    `;

    const buffer = Buffer.isBuffer(jsonContent) ? jsonContent : Buffer.from(jsonContent, 'utf-8');

    let sendError = null;

    // Opción 1: Resend API si existe RESEND_API_KEY
    if (process.env.RESEND_API_KEY) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Stockly Backup <onboarding@resend.dev>',
            to: [to],
            subject,
            html: htmlContent,
            attachments: [
              {
                filename,
                content: buffer.toString('base64')
              }
            ]
          })
        });

        const data = await response.json();
        if (response.ok) {
          console.log(`✅ [EmailService] Respaldo enviado exitosamente vía Resend a ${to} (ID: ${data.id})`);
          return { success: true, messageId: data.id, mode: 'resend' };
        } else {
          console.error('❌ [EmailService] Error en Resend API:', data);
          sendError = data.message || 'Error en Resend API';
        }
      } catch (err) {
        console.error('❌ [EmailService] Error de red enviando con Resend:', err);
        sendError = err.message;
      }
    }

    // Opción 2: Nodemailer con SMTP configurado
    if (!this.transporter) {
      this.initTransporter();
    }

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: process.env.EMAIL_FROM || '"Stockly Inventario" <no-reply@inventariocoop.com>',
          to,
          subject,
          html: htmlContent,
          attachments: [
            {
              filename,
              content: buffer,
              contentType: 'application/json'
            }
          ]
        });

        console.log(`✅ [EmailService] Respaldo enviado exitosamente vía SMTP a ${to} (ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId, mode: 'smtp' };
      } catch (smtpErr) {
        console.error('❌ [EmailService] Error enviando correo vía SMTP:', smtpErr);
        sendError = smtpErr.message;
      }
    }

    // Si falló con proveedor configurado
    if (sendError) {
      return {
        success: false,
        mode: 'error',
        error: `Error al enviar correo: ${sendError}`
      };
    }

    // Si no hay proveedor configurado en .env
    console.warn(`⚠️ [EmailService] No hay credenciales de correo (RESEND_API_KEY ni SMTP) configuradas en el servidor.`);
    return {
      success: false,
      mode: 'unconfigured',
      error: 'El servidor no tiene configurado un servicio de correo saliente (falta RESEND_API_KEY o SMTP en las variables de entorno de Render).'
    };
  }

  /**
   * Envía el código de verificación OTP de 6 dígitos al correo destino.
   *
   * @param {Object} options
   * @param {string} options.to - Correo destinatario
   * @param {string} options.code - Código de 6 dígitos
   * @param {string} options.inventoryName - Nombre del inventario
   * @returns {Promise<{ success: boolean, messageId?: string, mode: string }>}
   */
  async sendOtpEmail({ to, code, inventoryName = 'Inventario' }) {
    const subject = `🔐 Tu código de verificación para respaldo - Stockly (${code})`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0; }
            .container { max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { background-color: #1e3a5f; color: #ffffff; padding: 24px 28px; text-align: center; }
            .header h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
            .header p { margin: 4px 0 0 0; font-size: 12px; opacity: 0.85; }
            .body { padding: 32px 28px; text-align: center; }
            .otp-box { background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 18px 24px; margin: 24px 0; display: inline-block; }
            .otp-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a5f; margin: 0; }
            .instructions { font-size: 13px; color: #475569; line-height: 1.6; margin: 0 0 16px 0; }
            .security-note { font-size: 11px; color: #94a3b8; line-height: 1.5; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
            .footer { padding: 16px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Verificación de Correo Destino</h1>
              <p>${inventoryName} &bull; Seguridad de Copias de Seguridad</p>
            </div>
            <div class="body">
              <p class="instructions">
                Has solicitado autorizar este correo para recibir la copia de seguridad de tu inventario.
                Ingresa el siguiente código de 6 dígitos en la aplicación para verificar tu cuenta:
              </p>

              <div class="otp-box">
                <div class="otp-code">${code}</div>
              </div>

              <p style="font-size: 12px; color: #64748b; margin: 0;">
                ⏱️ Este código es válido por <strong>10 minutos</strong>.
              </p>

              <p class="security-note">
                Por motivos de seguridad, nunca compartas este código con nadie. Si no realizaste esta solicitud desde tu panel de inventario, puedes ignorar este mensaje de forma segura.
              </p>
            </div>
            <div class="footer">
              Enviado automáticamente por el Sistema de Gestión de Inventario Stockly.
            </div>
          </div>
        </body>
      </html>
    `;

    let sendError = null;

    // Opción 1: Resend si existe
    if (process.env.RESEND_API_KEY) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Stockly Seguridad <onboarding@resend.dev>',
            to: [to],
            subject,
            html: htmlContent
          })
        });

        const data = await response.json();
        if (response.ok) {
          console.log(`✅ [EmailService] Código OTP enviado vía Resend a ${to} (ID: ${data.id})`);
          return { success: true, messageId: data.id, mode: 'resend' };
        } else {
          console.error('❌ [EmailService] Error en Resend API enviando OTP:', data);
          sendError = data.message || 'Error en Resend API';
        }
      } catch (err) {
        console.error('❌ [EmailService] Error de red enviando OTP con Resend:', err);
        sendError = err.message;
      }
    }

    // Opción 2: Nodemailer SMTP
    if (!this.transporter) {
      this.initTransporter();
    }

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: process.env.EMAIL_FROM || '"Stockly Inventario" <no-reply@inventariocoop.com>',
          to,
          subject,
          html: htmlContent
        });

        console.log(`✅ [EmailService] Código OTP enviado vía SMTP a ${to} (ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId, mode: 'smtp' };
      } catch (smtpErr) {
        console.error('❌ [EmailService] Error enviando OTP vía SMTP:', smtpErr);
        sendError = smtpErr.message;
      }
    }

    if (sendError) {
      return {
        success: false,
        mode: 'error',
        error: `Error al despachar el código OTP: ${sendError}`
      };
    }

    return {
      success: false,
      mode: 'unconfigured',
      error: 'El servidor no tiene configurado un servicio de correo saliente (falta RESEND_API_KEY o SMTP en Render).'
    };
  }
}

export const emailService = new EmailService();
