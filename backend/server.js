import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import reportsRouter from './src/routes/reports.js';
import labelsRouter from './src/routes/labels.js';
import auditRouter from './src/routes/audit.js';
import collaboratorsRouter from './src/routes/collaborators.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

// ============================================================================
// 1. CABECERAS HTTP DE SEGURIDAD (HELMET)
// ============================================================================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: isProduction ? undefined : false,
    frameguard: { action: 'deny' },
    dnsPrefetchControl: { allow: false },
    hidePoweredBy: true
  })
);

// ============================================================================
// 2. CONFIGURACIÓN ESTRICTA DE CORS
// ============================================================================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) : []),
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (ej. curl, postman, server-to-server, PWA capacitor)
    if (!origin) return callback(null, true);

    const isExplicitlyAllowed = allowedOrigins.includes(origin);
    const isVercelApp = /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin);

    if (isExplicitlyAllowed || isVercelApp) {
      return callback(null, true);
    }

    return callback(new Error(`Bloqueado por política CORS: El origen '${origin}' no está autorizado.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// ============================================================================
// 3. RATE LIMITING (PREVENCIÓN DE DoS, FUERZA BRUTA Y SATURACIÓN)
// ============================================================================
// Limitador global para todas las rutas API
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // Máximo 200 requests por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas solicitudes desde esta dirección IP. Intente de nuevo en 15 minutos.',
    timestamp: new Date().toISOString()
  }
});

// Limitador estricto para operaciones costosas en CPU/memoria (generación de PDFs, Excel, invitación de usuarios)
const heavyResourceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 30, // Máximo 30 descargas/operaciones pesadas por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'HEAVY_RESOURCE_LIMIT_EXCEEDED',
    message: 'Límite de solicitudes de generación de reportes alcanzado. Por favor, espere unos minutos.',
    timestamp: new Date().toISOString()
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Ruta de Salud y Diagnóstico
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Inventory Management API (Render)',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Aplicar limitador global a la API
app.use('/api/', globalApiLimiter);

// Rutas de la API con limitadores específicos
app.use('/api/reports', heavyResourceLimiter, reportsRouter);
app.use('/api/labels', heavyResourceLimiter, labelsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/collaborators', collaboratorsRouter);

// ============================================================================
// 4. MANEJADOR 404 ESTANDARIZADO
// ============================================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 'ENDPOINT_NOT_FOUND',
    message: `El recurso solicitado '${req.originalUrl}' no existe en esta API.`,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 5. MANEJADOR GLOBAL DE ERRORES (SANITIZACIÓN Y CONTROL DE EXCEPCIONES)
// ============================================================================
app.use((err, req, res, next) => {
  // Manejo de rechazos por CORS
  if (err.message && err.message.startsWith('Bloqueado por política CORS')) {
    return res.status(403).json({
      success: false,
      code: 'CORS_FORBIDDEN',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }

  console.error('🔥 [Unhandled Exception]:', err);

  const statusCode = err.status || err.statusCode || 500;
  const safeMessage =
    isProduction && statusCode === 500
      ? 'Ha ocurrido un error interno en el servidor. Por favor, intente más tarde.'
      : err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    success: false,
    code: err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
    message: safeMessage,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

app.listen(PORT, () => {
  console.log(`🚀 [Backend Render] Servidor escuchando en http://localhost:${PORT}`);
  console.log(`📊 Reportes: http://localhost:${PORT}/api/reports`);
  console.log(`🏷️ Etiquetas: http://localhost:${PORT}/api/labels`);
});
