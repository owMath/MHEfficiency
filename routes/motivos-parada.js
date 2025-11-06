const express = require('express');
const router = express.Router();
const MotivoParada = require('../models/MotivoParada');
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

// Middleware para verificar se é empresa
const verificarEmpresa = (req, res, next) => {
    if (req.user.tipoUsuario !== 'empresa' || req.user.status !== 'ativo') {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas empresas ativas podem gerenciar motivos de parada'
        });
    }
    next();
};

// GET /api/motivos-parada - Buscar motivos de parada
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { classe, ativo = true } = req.query;
        
        // Construir filtros (sem filtro por empresa - motivos globais)
        let filters = {};
        
        if (classe && classe !== 'all') {
            filters.classe = classe;
        }
        
        if (ativo !== undefined) {
            filters.ativo = ativo === 'true' || ativo === true;
        }
        
        // Buscar motivos (todos os motivos, não filtrados por empresa)
        const motivos = await MotivoParada.find(filters)
            .sort({ createdAt: -1 })
            .limit(1000);
        
        res.json({
            success: true,
            data: motivos,
            count: motivos.length
        });
    } catch (error) {
        console.error('Erro ao buscar motivos de parada:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar os motivos de parada'
        });
    }
});

// GET /api/motivos-parada/:id - Buscar motivo específico
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const motivo = await MotivoParada.findOne({ 
            _id: req.params.id
            // Removido filtro por empresa - motivos globais
        });
        
        if (!motivo) {
            return res.status(404).json({ 
                error: 'Motivo não encontrado',
                message: 'O motivo especificado não foi encontrado'
            });
        }
        
        res.json({
            success: true,
            data: motivo
        });
    } catch (error) {
        console.error('Erro ao buscar motivo de parada:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar o motivo de parada'
        });
    }
});

// POST /api/motivos-parada - Criar novo motivo
router.post('/', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { nome, classe, descricao, cor = '#3b82f6' } = req.body;
        
        // Validações básicas
        if (!nome || !classe || !descricao) {
            return res.status(400).json({
                error: 'Dados incompletos',
                message: 'Nome, classe e descrição são obrigatórios'
            });
        }
        
        // Verificar se já existe motivo com o mesmo nome (globalmente)
        const motivoExistente = await MotivoParada.findOne({ 
            nome: nome, 
            ativo: true
            // Removido filtro por empresa - verificação global
        });
        
        if (motivoExistente) {
            return res.status(409).json({
                error: 'Motivo já existe',
                message: 'Já existe um motivo com este nome'
            });
        }
        
        // Criar novo motivo (sem associar à empresa)
        const novoMotivo = new MotivoParada({
            nome,
            classe,
            descricao,
            cor
            // Removido campo empresa - motivos globais
        });
        
        await novoMotivo.save();
        
        res.status(201).json({ 
            success: true,
            message: 'Motivo de parada criado com sucesso',
            data: novoMotivo
        });
    } catch (error) {
        console.error('Erro ao criar motivo de parada:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível criar o motivo de parada'
        });
    }
});

// PUT /api/motivos-parada/:id - Atualizar motivo
router.put('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { nome, classe, descricao, cor, ativo } = req.body;
        
        // Verificar se o motivo existe (sem filtro por empresa)
        const motivo = await MotivoParada.findOne({ 
            _id: req.params.id
            // Removido filtro por empresa - motivos globais
        });
        
        if (!motivo) {
            return res.status(404).json({ 
                error: 'Motivo não encontrado',
                message: 'O motivo especificado não foi encontrado'
            });
        }
        
        // Verificar se já existe outro motivo com o mesmo nome (se nome foi alterado)
        if (nome && nome !== motivo.nome) {
            const motivoExistente = await MotivoParada.findOne({ 
                nome: nome, 
                ativo: true,
                _id: { $ne: req.params.id }
                // Removido filtro por empresa - verificação global
            });
            
            if (motivoExistente) {
                return res.status(409).json({
                    error: 'Motivo já existe',
                    message: 'Já existe um motivo com este nome'
                });
            }
        }
        
        // Atualizar campos
        if (nome) motivo.nome = nome;
        if (classe) motivo.classe = classe;
        if (descricao) motivo.descricao = descricao;
        if (cor) motivo.cor = cor;
        if (ativo !== undefined) motivo.ativo = ativo;
        
        await motivo.save();
        
        res.json({ 
            success: true,
            message: 'Motivo de parada atualizado com sucesso',
            data: motivo
        });
    } catch (error) {
        console.error('Erro ao atualizar motivo de parada:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível atualizar o motivo de parada'
        });
    }
});

// DELETE /api/motivos-parada/:id - Excluir motivo (hard delete)
router.delete('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        // Verificar se o motivo existe (sem filtro por empresa)
        const motivo = await MotivoParada.findOne({ 
            _id: req.params.id
            // Removido filtro por empresa - motivos globais
        });
        
        if (!motivo) {
            return res.status(404).json({ 
                error: 'Motivo não encontrado',
                message: 'O motivo especificado não foi encontrado'
            });
        }
        
        // Hard delete - remover fisicamente do banco
        await MotivoParada.findByIdAndDelete(req.params.id);
        
        res.json({ 
            success: true,
            message: 'Motivo de parada excluído com sucesso'
        });
    } catch (error) {
        console.error('Erro ao excluir motivo de parada:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível excluir o motivo de parada'
        });
    }
});

// GET /api/motivos-parada/classes/summary - Resumo por classes
router.get('/classes/summary', authenticateToken, async (req, res) => {
    try {
        const summary = await MotivoParada.aggregate([
            { $match: { ativo: true } }, // Removido filtro por empresa - motivos globais
            { $group: { 
                _id: '$classe', 
                count: { $sum: 1 },
                motivos: { $push: { nome: '$nome', cor: '$cor' } }
            }},
            { $sort: { count: -1 } }
        ]);
        
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Erro ao buscar resumo de classes:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar o resumo de classes'
        });
    }
});

module.exports = router;
