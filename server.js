const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// Carregar variáveis de ambiente - Railway usa variáveis de ambiente diretamente
// Em desenvolvimento local, tenta carregar do config.env
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: './config.env' });
} else {
    require('dotenv').config();
}

// Importar conexão com banco de dados
const dbConnection = require('./config/database');

// Importar rotas
const authRoutes = require('./routes/auth');
const configuracoesRoutes = require('./routes/configuracoes');
const paradasMaquinaRoutes = require('./routes/paradas-maquina');
const motivosParadaRoutes = require('./routes/motivos-parada');
const motivosDescarteRoutes = require('./routes/motivos-descarte');
const descartesRoutes = require('./routes/descartes');
const producaoRoutes = require('./routes/producao');
const produtosRoutes = require('./routes/produtos');
const configuracoesProdutosRoutes = require('./routes/configuracoes-produtos');
const vinculosProdutoMaquinaRoutes = require('./routes/vinculos-produto-maquina');
const sensorDataRoutes = require('./routes/sensor-data');
const turnosRoutes = require('./routes/turnos');
const logisticaRoutes = require('./routes/logistica');
const ordensProducaoRoutes = require('./routes/ordens-producao');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares de segurança - CSP configurado para permitir scripts externos necessários
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));
// Configurar CORS dinamicamente baseado no ambiente
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [
        process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null,
        process.env.FRONTEND_URL,
        process.env.CORS_ORIGIN
      ].filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
    origin: function (origin, callback) {
        // Em produção, se não houver origins configurados, permitir apenas requisições do mesmo domínio
        if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
            // Se não há origins configurados, permitir requisições sem origin (mesmo domínio)
            return callback(null, true);
        }
        
        // Permitir requisições sem origin (mobile apps, Postman, mesmo domínio)
        if (!origin) return callback(null, true);
        
        // Verificar se o origin está na lista de permitidos
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS bloqueado para origin: ${origin}`);
            callback(new Error('Não permitido pelo CORS'));
        }
    },
    credentials: true
}));

// Rate limiting removido - sem limitações de requisições

// Middlewares para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos
app.use(express.static('public'));

// Usar rotas
app.use('/api/auth', authRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/paradas-maquina', paradasMaquinaRoutes);
app.use('/api/motivos-parada', motivosParadaRoutes);
app.use('/api/motivos-descarte', motivosDescarteRoutes);
app.use('/api/descartes', descartesRoutes);
app.use('/api/producao', producaoRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/configuracoes-produtos', configuracoesProdutosRoutes);
app.use('/api/vinculos-produto-maquina', vinculosProdutoMaquinaRoutes);
app.use('/api/sensor-data', sensorDataRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/logistica', logisticaRoutes);
app.use('/api/ordens-producao', ordensProducaoRoutes);

// Middleware para logging de requisições
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// Rota de health check
app.get('/health', async (req, res) => {
    try {
        const dbHealth = await dbConnection.healthCheck();
        
        res.status(200).json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV,
            database: dbHealth,
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Erro no health check',
            error: error.message
        });
    }
});

// Rota de status da conexão com MongoDB
app.get('/api/database/status', async (req, res) => {
    try {
        const status = dbConnection.getConnectionStatus();
        const health = await dbConnection.healthCheck();
        
        res.json({
            connection: status,
            health: health
        });
    } catch (error) {
        res.status(500).json({
            error: 'Erro ao verificar status do banco',
            message: error.message
        });
    }
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Rota da dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        message: `A rota ${req.method} ${req.originalUrl} não existe`,
        availableRoutes: [
            'GET /',
            'GET /dashboard',
            'GET /health',
            'GET /api/database/status',
            'POST /api/auth/cadastro/operador',
            'POST /api/auth/cadastro/empresa',
            'POST /api/auth/login',
            'POST /api/auth/esqueci-senha',
            'POST /api/auth/redefinir-senha',
            'GET /api/auth/usuario',
            'GET /api/auth/operadores-pendentes',
            'GET /api/auth/empresas-ativas',
            'PATCH /api/auth/operador/:id/status',
            'GET /api/configuracoes/empresa',
            'POST /api/configuracoes/empresa',
            'GET /api/paradas-maquina',
            'GET /api/machines',
            'POST /api/paradas-maquina/classify',
            'POST /api/paradas-maquina',
            'GET /api/descartes',
            'POST /api/descartes',
            'GET /api/descartes/summary/total',
            'GET /api/descartes/export/csv',
            'GET /api/sensor-data',
            'GET /api/sensor-data/test',
            'GET /api/sensor-data/latest',
            'GET /api/sensor-data/machines',
            'GET /api/sensor-data/stats',
            'POST /api/sensor-data',
            'GET /api/sensor-data/export/csv'
        ]
    });
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
    console.error('❌ Erro não tratado:', error);
    
    res.status(error.status || 500).json({
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'Algo deu errado. Tente novamente mais tarde.',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// Função para inicializar o servidor
async function startServer() {
    try {
        console.log('🚀 Iniciando servidor OEE Monitoring System...');
        
        // Conectar ao MongoDB
        await dbConnection.connect();
        
        // Iniciar servidor HTTP
        // Railway fornece a porta via variável de ambiente PORT
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('✅ Servidor iniciado com sucesso!');
            console.log(`🌐 Servidor rodando na porta: ${PORT}`);
            console.log(`📊 Health check: /health`);
            console.log(`🔍 Status DB: /api/database/status`);
            console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
            if (process.env.RAILWAY_PUBLIC_DOMAIN) {
                console.log(`🚂 Railway Domain: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
            }
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('🛑 SIGTERM recebido. Encerrando servidor graciosamente...');
            server.close(async () => {
                await dbConnection.disconnect();
                console.log('✅ Servidor encerrado com sucesso');
                process.exit(0);
            });
        });

        process.on('SIGINT', async () => {
            console.log('🛑 SIGINT recebido. Encerrando servidor graciosamente...');
            server.close(async () => {
                await dbConnection.disconnect();
                console.log('✅ Servidor encerrado com sucesso');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

// Iniciar servidor apenas se este arquivo for executado diretamente
if (require.main === module) {
    startServer();
}

module.exports = app;
