const express = require('express');
const router = express.Router();
const Machine = require('../models/Machine');
const User = require('../models/User');

// Middleware para verificar autenticação
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso necessário' });
    }

    try {
        // Verificar token JWT
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_aqui');
        
        // Buscar usuário no banco de dados
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(403).json({ error: 'Token inválido' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido' });
    }
};

// Rota temporária sem autenticação para debug
router.get('/debug', async (req, res) => {
    try {
        // Conectar ao MongoDB diretamente para buscar dados da coleção ciclos_producao
        const mongoose = require('mongoose');
        
        // Verificar se já está conectado
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oee_system');
        }
        
        // Buscar dados da coleção ciclos_producao
        const db = mongoose.connection.db;
        const productionData = await db.collection('ciclos_producao').find({})
            .sort({ timestamp: -1 })
            .limit(100)
            .toArray();
        
        res.json({
            success: true,
            data: productionData,
            count: productionData.length,
            message: 'Debug sem autenticação - dados de produção'
        });
    } catch (error) {
        console.error('❌ Erro no debug de produção:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// Rota temporária para debug com autenticação
router.get('/debug-auth', authenticateToken, async (req, res) => {
    try {
        const mongoose = require('mongoose');
        
        // Verificar se já está conectado
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oee_system');
        }
        
        // Buscar dados da coleção ciclos_producao
        const db = mongoose.connection.db;
        const productionData = await db.collection('ciclos_producao').find({})
            .sort({ timestamp: -1 })
            .limit(100)
            .toArray();
        
        res.json({
            success: true,
            data: productionData,
            count: productionData.length,
            message: 'Debug com autenticação - dados de produção'
        });
    } catch (error) {
        console.error('❌ Erro no debug auth de produção:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// GET /api/producao - Buscar dados de produção
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { machineId, period = 'week' } = req.query;
        
        const mongoose = require('mongoose');
        
        // Verificar se já está conectado
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oee_system');
        }
        
        // Construir filtros
        let filters = {};
        
        // Filtrar por máquina específica se solicitado (case-insensitive usando regex)
        if (machineId && machineId !== 'all') {
            filters.machineId = { $regex: new RegExp(`^${machineId}$`, 'i') };
        }
        
        // Adicionar filtro de período
        const now = new Date();
        let startDate = new Date();
        
        switch (period) {
            case 'day':
                // Hoje: desde o início do dia de hoje (00:00:00)
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0); // Início do dia
                break;
            case 'week':
                // Esta semana: desde o início da semana (domingo 00:00:00)
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay()); // Voltar para domingo
                startDate.setHours(0, 0, 0, 0); // Início do dia
                break;
            case 'month':
                // Este mês: desde o primeiro dia do mês (dia 1, 00:00:00)
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate.setHours(0, 0, 0, 0); // Início do dia
                break;
            case 'year':
                // Este ano: desde o primeiro dia do ano (1º de janeiro, 00:00:00)
                startDate = new Date(now.getFullYear(), 0, 1);
                startDate.setHours(0, 0, 0, 0); // Início do dia
                break;
            default:
                // Padrão: esta semana
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay());
                startDate.setHours(0, 0, 0, 0);
        }
        
        filters.timestamp = { $gte: startDate };
        
        // Buscar dados da coleção ciclos_producao
        const db = mongoose.connection.db;
        const productionData = await db.collection('ciclos_producao').find(filters)
            .sort({ timestamp: -1 })
            .limit(1000) // Limitar para performance
            .toArray();
        
        res.json({
            success: true,
            data: productionData,
            count: productionData.length
        });
    } catch (error) {
        console.error('Erro ao buscar dados de produção:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar os dados de produção'
        });
    }
});

// GET /api/producao/machines - Buscar máquinas disponíveis
router.get('/machines', authenticateToken, async (req, res) => {
    try {
        let machines = [];
        
        // Todos os usuários veem todas as máquinas da empresa, incluindo máquinas legadas
        machines = await Machine.find({ 
            $or: [
                { empresa: req.user._id },
                { empresa: { $exists: false } },
                { empresa: null }
            ]
        });
        
        res.json({
            success: true,
            data: machines,
            count: machines.length
        });
    } catch (error) {
        console.error('Erro ao buscar máquinas:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar as máquinas'
        });
    }
});

// GET /api/producao/stats - Buscar estatísticas de produção
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const { machineId, period = 'week' } = req.query;
        
        const mongoose = require('mongoose');
        
        // Verificar se já está conectado
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oee_system');
        }
        
        // Construir filtros
        let filters = {};
        
        // Filtrar por máquina específica se solicitado (case-insensitive usando regex)
        if (machineId && machineId !== 'all') {
            filters.machineId = { $regex: new RegExp(`^${machineId}$`, 'i') };
        }
        
        // Adicionar filtro de período
        const now = new Date();
        let startDate = new Date();
        
        switch (period) {
            case 'day':
                // Hoje: desde o início do dia de hoje (00:00:00)
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0); // Início do dia
                break;
            case 'week':
                // Esta semana: desde o início da semana (domingo 00:00:00)
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay()); // Voltar para domingo
                startDate.setHours(0, 0, 0, 0); // Início do dia
                break;
            case 'month':
                // Este mês: desde o primeiro dia do mês (dia 1, 00:00:00)
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate.setHours(0, 0, 0, 0); // Início do dia
                break;
            case 'year':
                // Este ano: desde o primeiro dia do ano (1º de janeiro, 00:00:00)
                startDate = new Date(now.getFullYear(), 0, 1);
                startDate.setHours(0, 0, 0, 0); // Início do dia
                break;
            default:
                // Padrão: esta semana
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay());
                startDate.setHours(0, 0, 0, 0);
        }
        
        filters.timestamp = { $gte: startDate };
        
        // Buscar dados da coleção ciclos_producao
        const db = mongoose.connection.db;
        const productionData = await db.collection('ciclos_producao').find(filters).toArray();
        
        // Calcular estatísticas
        const totalCycles = productionData.length;
        const conformCycles = productionData.filter(cycle => !cycle.isDefective).length;
        const defectiveCycles = totalCycles - conformCycles;
        const conformityRate = totalCycles > 0 ? Math.round((conformCycles / totalCycles) * 100) : 0;
        
        // Agrupar por máquina
        const machineStats = {};
        productionData.forEach(cycle => {
            if (!machineStats[cycle.machineId]) {
                machineStats[cycle.machineId] = {
                    total: 0,
                    conform: 0,
                    defective: 0
                };
            }
            
            machineStats[cycle.machineId].total++;
            if (cycle.isDefective) {
                machineStats[cycle.machineId].defective++;
            } else {
                machineStats[cycle.machineId].conform++;
            }
        });
        
        res.json({
            success: true,
            data: {
                totalCycles,
                conformCycles,
                defectiveCycles,
                conformityRate,
                machineStats
            }
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas de produção:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar as estatísticas de produção'
        });
    }
});

module.exports = router;
