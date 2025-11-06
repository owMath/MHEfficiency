const express = require('express');
const router = express.Router();
const Machine = require('../models/Machine');
const User = require('../models/User');
const ParadaMaquina = require('../models/ParadaMaquina');

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
        const stopsData = await ParadaMaquina.find({})
            .populate('motivoParada', 'nome classe cor')
            .sort({ timestamp: -1 })
            .limit(100);
        
        res.json({
            success: true,
            data: stopsData,
            count: stopsData.length,
            message: 'Debug sem autenticação'
        });
    } catch (error) {
        console.error('❌ Erro no debug:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// Rota temporária para debug com autenticação
router.get('/debug-auth', authenticateToken, async (req, res) => {
    try {
        const stopsData = await ParadaMaquina.find({})
            .populate('motivoParada', 'nome classe cor')
            .sort({ timestamp: -1 })
            .limit(100);
        
        res.json({
            success: true,
            data: stopsData,
            count: stopsData.length,
            message: 'Debug com autenticação'
        });
    } catch (error) {
        console.error('❌ Erro no debug auth:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// GET /api/paradas-maquina - Buscar paradas de máquina
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { machineId, period = 'week' } = req.query;
        
        // Construir filtros baseados no usuário
        let filters = {};
        
        // Filtrar por empresa: considerar também documentos legados sem o campo empresa
        // Isso evita esconder paradas antigas que não possuem empresa definida
        if (req.user._id) {
            filters.$or = [
                { empresa: req.user._id },
                { empresa: { $exists: false } },
                { empresa: null }
            ];
        }
        
        // Filtrar por máquina específica se solicitado (case-insensitive usando regex)
        if (machineId && machineId !== 'all') {
            // Usar regex case-insensitive para buscar machineId
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
        
        // Buscar paradas reais do banco
        const stopsData = await ParadaMaquina.find(filters)
            .populate('motivoParada', 'nome classe cor')
            .populate('motivoParada', 'nome classe cor')
            .sort({ timestamp: -1 })
            .limit(1000); // Limitar para performance
        
        res.json({
            success: true,
            data: stopsData,
            count: stopsData.length
        });
    } catch (error) {
        console.error('Erro ao buscar paradas de máquina:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar os dados de paradas'
        });
    }
});

// GET /api/machines - Buscar máquinas disponíveis
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

// POST /api/paradas-maquina/classify - Classificar uma parada
router.post('/classify', authenticateToken, async (req, res) => {
    try {
        const { stopId, reason, operator } = req.body;
        
        // Verificar se a parada existe e pertence à empresa do usuário
        const parada = await ParadaMaquina.findOne({ 
            _id: stopId, 
            empresa: req.user._id 
        });
        
        if (!parada) {
            return res.status(404).json({ 
                error: 'Parada não encontrada',
                message: 'A parada especificada não foi encontrada'
            });
        }
        
        // Atualizar a parada
        parada.classified = true;
        parada.reason = reason || parada.reason;
        parada.operator = operator || parada.operator;
        
        await parada.save();
        
        res.json({ 
            success: true,
            message: 'Parada classificada com sucesso',
            data: parada
        });
    } catch (error) {
        console.error('Erro ao classificar parada:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível classificar a parada'
        });
    }
});

// PUT /api/paradas-maquina/:id - Atualizar parada
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { motivoParada, reason, duration_seconds, operator } = req.body;
        
        // Buscar a parada - ser mais flexível com dados existentes
        let parada = await ParadaMaquina.findById(req.params.id);
        
        if (!parada) {
            return res.status(404).json({ 
                error: 'Parada não encontrada',
                message: 'A parada especificada não foi encontrada'
            });
        }
        
        // Se a parada tem empresa definida, verificar se pertence ao usuário
        if (parada.empresa && req.user._id) {
            if (parada.empresa.toString() !== req.user._id.toString()) {
                return res.status(403).json({ 
                    error: 'Acesso negado',
                    message: 'Esta parada não pertence à sua empresa'
                });
            }
        }
        
        // Atualizar campos
        if (motivoParada !== undefined) parada.motivoParada = motivoParada;
        if (reason !== undefined) parada.reason = reason;
        if (duration_seconds !== undefined) parada.duration_seconds = duration_seconds;
        if (operator !== undefined) parada.operator = operator;
        
        // Se um motivo foi inserido (motivoParada ou reason), marcar como classificada
        if ((motivoParada !== undefined && motivoParada !== null && motivoParada !== '') ||
            (reason !== undefined && reason !== null && reason.trim() !== '')) {
            parada.classified = true;
        }
        
        // Se não tem empresa definida e o usuário é empresa, definir
        if (!parada.empresa && req.user.tipoUsuario === 'empresa') {
            parada.empresa = req.user._id;
        }
        
        await parada.save();
        
        res.json({ 
            success: true,
            message: 'Parada atualizada com sucesso',
            data: parada
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar parada:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível atualizar a parada'
        });
    }
});

// DELETE /api/paradas-maquina/:id - Excluir parada
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Buscar a parada - ser mais flexível com dados existentes
        let parada = await ParadaMaquina.findById(req.params.id);
        
        if (!parada) {
            return res.status(404).json({ 
                error: 'Parada não encontrada',
                message: 'A parada especificada não foi encontrada'
            });
        }
        
        // Se a parada tem empresa definida, verificar se pertence ao usuário
        if (parada.empresa && req.user._id) {
            if (parada.empresa.toString() !== req.user._id.toString()) {
                return res.status(403).json({ 
                    error: 'Acesso negado',
                    message: 'Esta parada não pertence à sua empresa'
                });
            }
        }
        
        // Excluir a parada
        await ParadaMaquina.findByIdAndDelete(req.params.id);
        
        res.json({ 
            success: true,
            message: 'Parada excluída com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao excluir parada:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível excluir a parada'
        });
    }
});

// POST /api/paradas-maquina - Criar nova parada
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { machineId, reason, duration, operator, observacoes } = req.body;
        
        // Verificar se a máquina pertence à empresa
        const machine = await Machine.findOne({ 
            machineId: machineId, 
            empresa: req.user._id 
        });
        
        if (!machine) {
            return res.status(404).json({ 
                error: 'Máquina não encontrada',
                message: 'A máquina especificada não foi encontrada'
            });
        }
        
        // Criar nova parada
        const novaParada = new ParadaMaquina({
            machineId,
            reason,
            duration,
            operator: operator || 'N/A',
            empresa: req.user._id,
            observacoes,
            classified: false
        });
        
        await novaParada.save();
        
        res.status(201).json({ 
            success: true,
            message: 'Parada registrada com sucesso',
            data: novaParada
        });
    } catch (error) {
        console.error('Erro ao criar parada:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível registrar a parada'
        });
    }
});

module.exports = router;
