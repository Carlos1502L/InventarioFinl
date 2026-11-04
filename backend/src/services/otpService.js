import crypto from 'crypto';

/**
 * Servicio de gestión de códigos OTP de 6 dígitos y tokens criptográficos
 * para verificación previa de correos destinatarios de copias de seguridad.
 */
class OtpService {
  constructor() {
    // Memoria volátil para OTPs activos: key = `${inventoryId}:${normalizedEmail}`
    this.otpStore = new Map();
    // Limpieza periódica cada 5 minutos de códigos expirados
    setInterval(() => this.cleanupExpired(), 5 * 60 * 1000).unref();
  }

  getSecret() {
    return (
      process.env.JWT_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      'stockly-backup-otp-secret-salt-2026'
    );
  }

  _getKey(inventoryId, email) {
    return `${inventoryId}:${email.trim().toLowerCase()}`;
  }

  _hash(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
  }

  /**
   * Genera un código OTP de 6 dígitos con validez de 10 minutos.
   *
   * @param {string} inventoryId
   * @param {string} email
   * @returns {string} Código numérico de 6 dígitos (ej. "482910")
   */
  generateOtp(inventoryId, email) {
    const key = this._getKey(inventoryId, email);
    // Generar 6 dígitos criptográficamente seguros entre 100000 y 999999
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos

    this.otpStore.set(key, {
      codeHash: this._hash(code),
      expiresAt,
      attempts: 0
    });

    return code;
  }

  /**
   * Valida el código OTP ingresado por el usuario.
   * Si es correcto, genera un token firmado de autorización válido por 30 minutos.
   *
   * @param {string} inventoryId
   * @param {string} email
   * @param {string} code
   * @returns {{ success: boolean, message?: string, verification_token?: string }}
   */
  verifyOtp(inventoryId, email, code) {
    const key = this._getKey(inventoryId, email);
    const entry = this.otpStore.get(key);

    if (!entry) {
      return {
        success: false,
        message: 'No hay un código de verificación activo para este correo. Solicita uno nuevo.'
      };
    }

    if (Date.now() > entry.expiresAt) {
      this.otpStore.delete(key);
      return {
        success: false,
        message: 'El código de verificación ha expirado (validez 10 minutos). Solicita uno nuevo.'
      };
    }

    if (entry.attempts >= 5) {
      this.otpStore.delete(key);
      return {
        success: false,
        message: 'Demasiados intentos incorrectos. Por seguridad el código fue anulado. Solicita uno nuevo.'
      };
    }

    const inputHash = this._hash(code.trim());
    if (inputHash !== entry.codeHash) {
      entry.attempts += 1;
      return {
        success: false,
        message: 'Código de verificación incorrecto. Revisa tu correo e inténtalo nuevamente.'
      };
    }

    // Código válido -> consumirlo para que no se reuse
    this.otpStore.delete(key);

    // Generar token firmado de autorización
    const token = this.generateVerificationToken(inventoryId, email);

    return {
      success: true,
      verification_token: token
    };
  }

  /**
   * Genera un token HMAC-SHA256 firmado con expiración de 30 minutos.
   */
  generateVerificationToken(inventoryId, email) {
    const normalizedEmail = email.trim().toLowerCase();
    const payload = {
      inventory_id: inventoryId,
      email: normalizedEmail,
      exp: Date.now() + 30 * 60 * 1000 // 30 minutos de ventana para enviar el backup
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.getSecret())
      .update(payloadB64)
      .digest('base64url');

    return `${payloadB64}.${signature}`;
  }

  /**
   * Verifica la autenticidad y vigencia de un verification_token.
   *
   * @param {string} inventoryId
   * @param {string} email
   * @param {string} token
   * @returns {{ valid: boolean, error?: string }}
   */
  verifyToken(inventoryId, email, token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return { valid: false, error: 'Token de verificación ausente o con formato inválido.' };
    }

    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) {
      return { valid: false, error: 'Token de verificación corrupto.' };
    }

    // Verificar firma HMAC
    const expectedSig = crypto
      .createHmac('sha256', this.getSecret())
      .update(payloadB64)
      .digest('base64url');

    if (signature !== expectedSig) {
      return { valid: false, error: 'Firma de seguridad del token inválida.' };
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

      if (Date.now() > payload.exp) {
        return { valid: false, error: 'La sesión de verificación ha expirado. Vuelve a validar tu correo.' };
      }

      if (payload.inventory_id !== inventoryId) {
        return { valid: false, error: 'El token de verificación no corresponde a este inventario.' };
      }

      if (payload.email !== email.trim().toLowerCase()) {
        return { valid: false, error: 'El correo destino no coincide con el correo verificado mediante OTP.' };
      }

      return { valid: true, payload };
    } catch (e) {
      return { valid: false, error: 'No se pudo decodificar el payload del token.' };
    }
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [key, value] of this.otpStore.entries()) {
      if (now > value.expiresAt) {
        this.otpStore.delete(key);
      }
    }
  }
}

export const otpService = new OtpService();
