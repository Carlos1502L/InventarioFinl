import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import reportsRouter from './src/routes/reports.js';
import labelsRouter from './src/routes/labels.js';
import auditRouter from './src/routes/audit.js';
import collaboratorsRouter from './src/routes/collaborators.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de Seguridad y Logging
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS permisivo para frontend en Vercel, localhost y entornos PWA móviles
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Ruta de Salud y Diagnóstico
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Inventory Management API (Render)',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Rutas de la API
app.use('/api/reports', reportsRouter);
app.use('/api/labels', labelsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/collaborators', collaboratorsRouter);

// Manejador 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.originalUrl
  });
});

// Manejador Global de Errores
app.use((err, req, res, next) => {
  console.error('🔥 Error en el servidor:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 [Backend Render] Servidor escuchando en http://localhost:${PORT}`);
  console.log(`📊 Reportes: http://localhost:${PORT}/api/reports`);
  console.log(`🏷️ Etiquetas: http://localhost:${PORT}/api/labels`);
});
