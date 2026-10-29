// ============================================================================
// SERVIDOR BACKEND LOCAL (PostgreSQL Docker + pgAdmin 4: pruebaLocalWeb)
// No modifica ni afecta los archivos de despliegue en Render / Supabase / Vercel
// ============================================================================

// Forzar que el cliente interno de las rutas apunte al Gateway Local en lugar de Supabase Cloud
process.env.SUPABASE_URL = 'http://localhost:4000';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-role-key';
process.env.SUPABASE_ANON_KEY = 'local-anon-key';
process.env.NODE_ENV = 'development';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { initializeLocalSchema, dbConfig } from './src/config/datasource.local.js';
import localGatewayRouter from './src/routes/localGateway.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(morgan('dev'));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// CORS totalmente abierto en local: refleja automáticamente todos los headers (incluyendo x-supabase-api-version)
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Range', 'Range-Unit']
  })
);
app.options('*', cors({ origin: true, credentials: true }));

// Montar primero la ruta de subida binaria de Storage antes de express.json()
app.use('/storage/v1/object', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    return localGatewayRouter(req, res, next);
  }
  next();
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Ruta de salud y estado de conexión con PostgreSQL Local
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'LOCAL_POSTGRES_DOCKER',
    datasource: `jdbc:postgresql://${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
    username: dbConfig.user,
    ddlAuto: dbConfig.ddlAuto,
    timestamp: new Date().toISOString()
  });
});

// Montar el Gateway Local compatible con el cliente del Frontend (/auth/v1, /rest/v1, /storage/v1)
app.use('/', localGatewayRouter);

async function startLocalServer() {
  try {
    // 1. Inicializar conexión y ejecutar ddl-auto: update sobre pruebaLocalWeb
    await initializeLocalSchema();

    // 2. Importar rutas de negocio (apuntando ahora al Gateway Local)
    const { default: reportsRouter } = await import('./src/routes/reports.js');
    const { default: labelsRouter } = await import('./src/routes/labels.js');
    const { default: auditRouter } = await import('./src/routes/audit.js');
    const { default: collaboratorsRouter } = await import('./src/routes/collaborators.js');

    app.use('/api/reports', reportsRouter);
    app.use('/api/labels', labelsRouter);
    app.use('/api/audit', auditRouter);
    app.use('/api/collaborators', collaboratorsRouter);

    // Manejador 404
    app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint no encontrado en servidor local',
        path: req.originalUrl
      });
    });

    // Manejador Global de Errores
    app.use((err, req, res, next) => {
      console.error('🔥 Error en el servidor local:', err);
      res.status(err.status || 500).json({
        error: err.message || 'Error interno del servidor local'
      });
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log('======================================================================');
      console.log(`🚀 [Backend Local] Servidor activo en: http://localhost:${PORT}`);
      console.log(`🐘 [PostgreSQL Docker] jdbc:postgresql://${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
      console.log(`👤 [DB Credenciales] usuario: ${dbConfig.user} | ddl-auto: ${dbConfig.ddlAuto}`);
      console.log('======================================================================');
    });
  } catch (err) {
    console.error('❌ No se pudo iniciar el servidor local:', err);
    process.exit(1);
  }
}

startLocalServer();
