const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const dbConnection = require('../config/database');

// Middleware de autenticação simplificado para desenvolvimento
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Para desenvolvimento, permitir requisições sem token
    if (!token) {
        return next();
    }

    try {
        // Verificar token JWT
        const jwt = require('jsonwebtoken');
        const User = require('../models/User');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_aqui');
        const user = await User.findById(decoded.id);
        
        if (user) {
            req.user = user;
        }
        next();
    } catch (error) {
        next(); // Permitir mesmo com erro para desenvolvimento
    }
};

// Aplicar middleware de autenticação em todas as rotas
router.use(authenticateToken);

// Função auxiliar para obter o banco de dados
const getDb = () => {
    // Verificar se a conexão está pronta
    if (mongoose.connection.readyState !== 1) {
        throw new Error('Banco de dados não está conectado');
    }
    return mongoose.connection.db;
};

// Rota de teste para verificar se a API está funcionando
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'API de sensor data funcionando!',
        timestamp: new Date().toISOString()
    });
});

// Rota de debug para verificar estrutura dos dados na coleção
router.get('/debug', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('sensor_data');
        
        // Contar documentos
        const count = await collection.countDocuments({});
        
        // Buscar alguns documentos de exemplo
        const samples = await collection.find({}).limit(5).toArray();
        
        // Verificar estrutura do primeiro documento
        let sampleStructure = null;
        if (samples.length > 0) {
            sampleStructure = {
                fields: Object.keys(samples[0]),
                timestampType: typeof samples[0].timestamp,
                timestampValue: samples[0].timestamp,
                sampleDocument: samples[0]
            };
        }
        
        res.json({
            success: true,
            totalDocuments: count,
            sampleCount: samples.length,
            sampleStructure: sampleStructure,
            samples: samples
        });
    } catch (error) {
        console.error('❌ Erro no debug:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/sensor-data - Buscar dados de sensor
router.get('/', async (req, res) => {
    try {
        const { period, machineId, startDate, endDate } = req.query;
        
        // Verificar conexão com banco
        let db;
        try {
            db = getDb();
        } catch (error) {
            console.error('❌ Banco de dados não conectado:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Banco de dados não conectado',
                message: 'Verifique a conexão com MongoDB'
            });
        }
        
        const collection = db.collection('sensor_data');
        
        // Construir filtro
        const filter = {};
        
        // Filtro de máquina
        if (machineId && machineId !== 'all') {
            filter.machineId = machineId;
        }
        
        // Construir filtro de data baseado no período ou intervalo customizado
        let dateStart = null;
        let dateEnd = null;
        
        if (startDate && endDate) {
            // Filtro por intervalo customizado
            dateStart = new Date(startDate);
            dateEnd = new Date(endDate);
        } else if (period) {
            // Filtro por período pré-definido
            const now = new Date();
            switch (period) {
                case 'hour':
                    dateStart = new Date(now.getTime() - (60 * 60 * 1000));
                    break;
                case 'day':
                    dateStart = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                    break;
                case 'week':
                    dateStart = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                    break;
                default:
                    dateStart = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            }
        }
        
        // Aplicar filtro de data se houver
        if (dateStart) {
            if (dateEnd) {
                filter.timestamp = {
                    $gte: dateStart.toISOString(),
                    $lte: dateEnd.toISOString()
                };
            } else {
                filter.timestamp = {
                    $gte: dateStart.toISOString()
                };
            }
        }
        
        // Buscar dados
        let sensorData = [];
        try {
            // Primeiro, tentar com o filtro como está
            sensorData = await collection
                .find(filter)
                .sort({ timestamp: -1 })
                .limit(1000)
                .toArray();
            
            // Se não encontrou nada e há filtro de data, tentar buscar sem filtro de data
            if (sensorData.length === 0 && filter.timestamp) {
                const noDateFilter = { ...filter };
                delete noDateFilter.timestamp;
                sensorData = await collection
                    .find(noDateFilter)
                    .sort({ timestamp: -1 })
                    .limit(1000)
                    .toArray();
            }
        } catch (queryError) {
            console.error('❌ Erro ao buscar dados de sensor:', queryError);
            // Tentar buscar sem filtro de data se houver erro
            if (filter.timestamp) {
                const simpleFilter = { ...filter };
                delete simpleFilter.timestamp;
                sensorData = await collection
                    .find(simpleFilter)
                    .sort({ timestamp: -1 })
                    .limit(1000)
                    .toArray();
            }
        }
        
        res.json({
            success: true,
            data: sensorData,
            count: sensorData.length,
            message: `Encontrados ${sensorData.length} registros`
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar dados de sensor:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// GET /api/sensor-data/latest - Buscar dados mais recentes
router.get('/latest', async (req, res) => {
    try {
        const { machineId } = req.query;
        const db = getDb();
        const collection = db.collection('sensor_data');
        
        // Construir filtro de máquina
        let filter = {};
        if (machineId && machineId !== 'all') {
            filter.machineId = machineId;
        }
        
        // Buscar dados mais recentes
        const latestData = await collection
            .find(filter)
            .sort({ timestamp: -1 })
            .limit(1)
            .toArray();
        
        res.json({
            success: true,
            data: latestData.length > 0 ? latestData[0] : null,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar dados mais recentes:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// GET /api/sensor-data/machines - Listar máquinas disponíveis
router.get('/machines', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('sensor_data');
        
        // Buscar machineIds únicos
        const machines = await collection.distinct('machineId');
        
        res.json({
            success: true,
            data: machines.filter(m => m).map(machineId => ({
                machineId: machineId,
                nome: `Máquina ${machineId}`
            })),
            count: machines.filter(m => m).length
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar máquinas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// GET /api/sensor-data/stats - Estatísticas dos dados de sensor
router.get('/stats', async (req, res) => {
    try {
        const { period, machineId } = req.query;
        const db = getDb();
        const collection = db.collection('sensor_data');
        
        // Construir filtro de data baseado no período
        let dateFilter = {};
        if (period) {
            const now = new Date();
            let startDate;
            
            switch (period) {
                case 'hour':
                    startDate = new Date(now.getTime() - (60 * 60 * 1000));
                    break;
                case 'day':
                    startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                    break;
                default:
                    startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            }
            
            dateFilter.$or = [
                { timestamp: { $gte: startDate.toISOString() } },
                { timestamp: { $gte: startDate } }
            ];
        }
        
        // Construir filtro de máquina
        let machineFilter = {};
        if (machineId && machineId !== 'all') {
            machineFilter.machineId = machineId;
        }
        
        // Combinar filtros
        const filter = { ...machineFilter };
        if (dateFilter.$or) {
            filter.$or = dateFilter.$or;
        }
        
        // Pipeline de agregação para calcular estatísticas
        const pipeline = [
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalRecords: { $sum: 1 },
                    avgRssi: { $avg: '$networkMetrics.rssi' },
                    minRssi: { $min: '$networkMetrics.rssi' },
                    maxRssi: { $max: '$networkMetrics.rssi' },
                    avgSnr: { $avg: '$networkMetrics.snr' },
                    minSnr: { $min: '$networkMetrics.snr' },
                    maxSnr: { $max: '$networkMetrics.snr' },
                    avgLatency: { $avg: '$networkMetrics.latency' },
                    minLatency: { $min: '$networkMetrics.latency' },
                    maxLatency: { $max: '$networkMetrics.latency' },
                    avgThroughput: { $avg: '$networkMetrics.throughput' },
                    minThroughput: { $min: '$networkMetrics.throughput' },
                    maxThroughput: { $max: '$networkMetrics.throughput' },
                    avgPacketLoss: { $avg: '$networkMetrics.packetLoss' },
                    minPacketLoss: { $min: '$networkMetrics.packetLoss' },
                    maxPacketLoss: { $max: '$networkMetrics.packetLoss' },
                    onlineCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] }
                    },
                    offlineCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'offline'] }, 1, 0] }
                    }
                }
            }
        ];
        
        const stats = await collection.aggregate(pipeline).toArray();
        
        res.json({
            success: true,
            data: stats.length > 0 ? stats[0] : {
                totalRecords: 0,
                avgRssi: 0,
                minRssi: 0,
                maxRssi: 0,
                avgSnr: 0,
                minSnr: 0,
                maxSnr: 0,
                avgLatency: 0,
                minLatency: 0,
                maxLatency: 0,
                avgThroughput: 0,
                minThroughput: 0,
                maxThroughput: 0,
                avgPacketLoss: 0,
                minPacketLoss: 0,
                maxPacketLoss: 0,
                onlineCount: 0,
                offlineCount: 0
            },
            filter: filter
        });
        
    } catch (error) {
        console.error('❌ Erro ao calcular estatísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// POST /api/sensor-data - Criar novo registro de sensor (para testes)
router.post('/', async (req, res) => {
    try {
        const { machineId, networkMetrics, status } = req.body;
        
        if (!machineId) {
            return res.status(400).json({
                success: false,
                error: 'machineId é obrigatório'
            });
        }
        
        const db = getDb();
        const collection = db.collection('sensor_data');
        
        const sensorData = {
            machineId: machineId,
            timestamp: new Date().toISOString(),
            networkMetrics: networkMetrics || {
                rssi: Math.floor(Math.random() * 40) - 80, // -80 a -40 dBm
                snr: Math.floor(Math.random() * 30) + 10,  // 10 a 40 dB
                latency: Math.floor(Math.random() * 50) + 20, // 20 a 70 ms
                throughput: Math.floor(Math.random() * 50) + 10, // 10 a 60 Mbps
                jitter: Math.floor(Math.random() * 10) + 1, // 1 a 10 ms
                packetLoss: Math.floor(Math.random() * 5) // 0 a 5%
            },
            status: status || 'online',
            lastUpdate: 'Agora'
        };
        
        const result = await collection.insertOne(sensorData);
        
        res.status(201).json({
            success: true,
            data: {
                _id: result.insertedId,
                ...sensorData
            },
            message: 'Registro de sensor criado com sucesso'
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar registro de sensor:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// GET /api/sensor-data/export/csv - Exportar dados para CSV
router.get('/export/csv', async (req, res) => {
    try {
        const { period, machineId } = req.query;
        const db = getDb();
        const collection = db.collection('sensor_data');
        
        // Construir filtro de data baseado no período
        let dateFilter = {};
        if (period) {
            const now = new Date();
            let startDate;
            
            switch (period) {
                case 'hour':
                    startDate = new Date(now.getTime() - (60 * 60 * 1000));
                    break;
                case 'day':
                    startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                    break;
                default:
                    startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            }
            
            dateFilter.$or = [
                { timestamp: { $gte: startDate.toISOString() } },
                { timestamp: { $gte: startDate } }
            ];
        }
        
        // Construir filtro de máquina
        let machineFilter = {};
        if (machineId && machineId !== 'all') {
            machineFilter.machineId = machineId;
        }
        
        // Combinar filtros
        const filter = { ...machineFilter };
        if (dateFilter.$or) {
            filter.$or = dateFilter.$or;
        }
        
        // Buscar dados
        const sensorData = await collection
            .find(filter)
            .sort({ timestamp: -1 })
            .limit(10000) // Limitar a 10000 registros para exportação
            .toArray();
        
        // Preparar CSV
        const headers = ['Data/Hora', 'Máquina', 'Status', 'RSSI', 'SNR', 'Latência', 'Throughput', 'Packet Loss', 'Jitter'];
        const csvRows = sensorData.map(data => {
            const timestamp = new Date(data.timestamp).toLocaleString('pt-BR');
            const networkMetrics = data.networkMetrics || {};
            
            return [
                timestamp,
                data.machineId,
                data.status || 'Desconhecido',
                networkMetrics.rssi || '--',
                networkMetrics.snr || '--',
                networkMetrics.latency || '--',
                networkMetrics.throughput || '--',
                networkMetrics.packetLoss || '--',
                networkMetrics.jitter || '--'
            ];
        });
        
        const csvContent = [headers, ...csvRows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=sensor_data_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);
        
    } catch (error) {
        console.error('❌ Erro ao exportar CSV:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

module.exports = router;
