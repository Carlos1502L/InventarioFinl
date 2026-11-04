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
        },
        // Timeouts estrictos para evitar que Render quede colgado si los puertos SMTP están bloqueados
        connectionTimeout: 6000, // 6 segundos máximo para conectar
        greetingTimeout: 6000,
        socketTimeout: 12000
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
            .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04); }
            .header { background-color: #1e3a5f; color: #ffffff; padding: 22px 28px; }
            .header h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
            .header p { margin: 4px 0 0 0; font-size: 12px; opacity: 0.9; }
            .body { padding: 28px; font-size: 14px; line-height: 1.6; color: #334155; }
            .file-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #1e293b; font-family: ui-monospace, monospace; }
            .footer { padding: 16px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📦 Copia de Seguridad</h1>
              <p>${inventoryName} &bull; ${formattedDate}</p>
            </div>
            <div class="body">
              <p>Estimado/a Propietario/a,</p>
              <p>
                Le informamos que se ha generado exitosamente la copia de seguridad correspondiente a su inventario <strong>${inventoryName}</strong>.
              </p>
              <p>
                Adjunto a este correo encontrará el archivo oficial con la totalidad de los datos estructurados en formato JSON:
              </p>
              <div class="file-box">
                📎 ${filename}
              </div>
              <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
                Conserve este archivo en un lugar seguro. Podrá utilizarlo para restaurar su información en cualquier momento desde el módulo de Ajustes del sistema.
              </p>
              <p style="margin-top: 28px; font-size: 13px; color: #475569;">
                Atentamente,<br>
                <strong>Sistema de Gestión Stockly</strong>
              </p>
            </div>
            <div class="footer">
              Este es un mensaje automático del sistema de inventario. No responda a este correo.
            </div>
          </div>
        </body>
      </html>
    `;

    const buffer = Buffer.isBuffer(jsonContent) ? jsonContent : Buffer.from(jsonContent, 'utf-8');

    let sendError = null;

    // Opción 1: Google Apps Script Webhook vía HTTPS (Puerto 443 - Inmune al bloqueo de puertos SMTP en Render)
    if (process.env.GMAIL_SCRIPT_URL) {
      try {
        const response = await fetch(process.env.GMAIL_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to,
            subject,
            html: htmlContent,
            attachments: [
              {
                filename,
                content: buffer.toString('base64'),
                contentType: 'application/json'
              }
            ]
          })
        });

        const data = await response.json();
        if (data.success || response.ok) {
          console.log(`✅ [EmailService] Respaldo enviado exitosamente vía Google Apps Script a ${to}`);
          return { success: true, mode: 'gas_webhook' };
        } else {
          console.error('❌ [EmailService] Error en Google Apps Script Webhook:', data);
          sendError = data.error || 'Error en Webhook de Google Apps Script';
        }
      } catch (err) {
        console.error('❌ [EmailService] Error enviando con Google Apps Script:', err);
        sendError = err.message;
      }
    }

    // Opción 2: Resend API si existe RESEND_API_KEY (Puerto 443)
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

    // Opción 3: Nodemailer con SMTP configurado
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
        if (
          smtpErr.code === 'ETIMEDOUT' ||
          smtpErr.message?.includes('ETIMEDOUT') ||
          smtpErr.message?.includes('greeting never received')
        ) {
          sendError = `Tiempo agotado (Timeout). Render bloquea los puertos SMTP salientes (587 y 465) en su capa gratuita. Utiliza GMAIL_SCRIPT_URL (HTTPS) o RESEND_API_KEY.`;
        } else {
          sendError = smtpErr.message;
        }
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
    const subject = `🔐 Código de Verificación para Respaldo: ${code} - Stockly`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0; }
            .container { max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04); }
            .header { background-color: #1e3a5f; color: #ffffff; padding: 22px 28px; }
            .header h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
            .header p { margin: 4px 0 0 0; font-size: 12px; opacity: 0.9; }
            .body { padding: 28px; font-size: 14px; line-height: 1.6; color: #334155; }
            .code-box { background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px; margin: 20px 0; text-align: center; }
            .code-digits { font-family: ui-monospace, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a5f; margin: 0; }
            .footer { padding: 16px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Verificación de Respaldo</h1>
              <p>${inventoryName} &bull; Autorización de Envío Seguro</p>
            </div>
            <div class="body">
              <p>Estimado/a Propietario/a,</p>
              <p>
                Ha solicitado enviar una copia de seguridad del inventario <strong>${inventoryName}</strong> a esta dirección de correo.
              </p>
              <p>
                Para confirmar su identidad y autorizar la entrega del archivo, introduzca el siguiente código de validación de 6 dígitos:
              </p>
              <div class="code-box">
                <div class="code-digits">${code}</div>
              </div>
              <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
                ⏱️ Este código es confidencial y vence en <strong>10 minutos</strong>. Si no reconoció esta solicitud, puede desestimar este mensaje de forma segura.
              </p>
              <p style="margin-top: 24px; font-size: 13px; color: #475569;">
                Atentamente,<br>
                <strong>Sistema de Gestión Stockly</strong>
              </p>
            </div>
            <div class="footer">
              Este es un mensaje automático de seguridad. No responda a este correo.
            </div>
          </div>
        </body>
      </html>
    `;

    let sendError = null;

    // Opción 1: Google Apps Script Webhook vía HTTPS (Puerto 443 - Inmune a bloqueos SMTP de Render)
    if (process.env.GMAIL_SCRIPT_URL) {
      try {
        const response = await fetch(process.env.GMAIL_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to,
            subject,
            html: htmlContent
          })
        });

        const data = await response.json();
        if (data.success || response.ok) {
          console.log(`✅ [EmailService] Código OTP enviado vía Google Apps Script a ${to}`);
          return { success: true, mode: 'gas_webhook' };
        } else {
          console.error('❌ [EmailService] Error en Google Apps Script OTP:', data);
          sendError = data.error || 'Error en Google Apps Script';
        }
      } catch (err) {
        console.error('❌ [EmailService] Error de red enviando OTP con Google Apps Script:', err);
        sendError = err.message;
      }
    }

    // Opción 2: Resend si existe (Puerto 443)
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

    // Opción 3: Nodemailer SMTP
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
        if (
          smtpErr.code === 'ETIMEDOUT' ||
          smtpErr.message?.includes('ETIMEDOUT') ||
          smtpErr.message?.includes('greeting never received')
        ) {
          sendError = `Tiempo agotado (Timeout). Render bloquea los puertos SMTP salientes (587 y 465) en su capa gratuita. Utiliza GMAIL_SCRIPT_URL (HTTPS) o RESEND_API_KEY.`;
        } else {
          sendError = smtpErr.message;
        }
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
