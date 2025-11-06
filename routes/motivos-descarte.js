const express = require('express');
const router = express.Router();
const MotivoDescarte = require('../models/MotivoDescarte');
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
            message: 'Apenas empresas ativas podem gerenciar motivos de descarte'
        });
    }
    next();
};

// GET /api/motivos-descarte - Buscar motivos de descarte
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { classe, gravidade, ativo = true, search } = req.query;
        
        // Construir filtros
        let filters = {};
        
        if (classe && classe !== 'all') {
            filters.classe = classe;
        }
        
        if (gravidade && gravidade !== 'all') {
            filters.gravidade = gravidade;
        }
        
        if (ativo !== undefined) {
            filters.ativo = ativo === 'true' || ativo === true;
        }

        // Buscar motivos
        let query = MotivoDescarte.find(filters);

        // Aplicar busca por texto se fornecida
        if (search) {
            query = query.find({
                $or: [
                    { codigo: { $regex: search, $options: 'i' } },
                    { nome: { $regex: search, $options: 'i' } },
                    { classe: { $regex: search, $options: 'i' } },
                    { descricao: { $regex: search, $options: 'i' } }
                ]
            });
        }

        const motivos = await query
            .sort({ createdAt: -1 })
            .limit(1000);
        
        res.json({
            success: true,
            data: motivos,
            count: motivos.length
        });
    } catch (error) {
        console.error('Erro ao buscar motivos de descarte:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar os motivos de descarte'
        });
    }
});

// GET /api/motivos-descarte/:id - Buscar motivo específico
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const motivo = await MotivoDescarte.findById(req.params.id);
        
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
        console.error('Erro ao buscar motivo de descarte:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar o motivo de descarte'
        });
    }
});

// POST /api/motivos-descarte - Criar novo motivo
router.post('/', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { codigo, nome, classe, descricao, gravidade = 'baixa', cor = '#ef4444' } = req.body;
        
        // Validações básicas
        if (!nome || !classe) {
            return res.status(400).json({
                error: 'Dados incompletos',
                message: 'Nome e classe são obrigatórios'
            });
        }
        
        // Validar gravidade
        if (!gravidade || !['baixa', 'media', 'alta', 'critica'].includes(gravidade.toLowerCase())) {
            return res.status(400).json({
                error: 'Gravidade inválida',
                message: 'Gravidade deve ser: baixa, media, alta ou critica'
            });
        }
        
        // Validar classe - apenas verificar se não está vazia
        if (!classe || classe.trim().length === 0) {
            return res.status(400).json({
                error: 'Classe inválida',
                message: 'Classe é obrigatória'
            });
        }
        
        // Validar descrição apenas se fornecida
        if (descricao && descricao.trim().length === 0) {
            return res.status(400).json({
                error: 'Descrição inválida',
                message: 'Descrição não pode estar vazia'
            });
        }
        
        // Verificar se já existe motivo com o mesmo código
        if (codigo) {
            const motivoExistente = await MotivoDescarte.findOne({ 
                codigo: codigo.toUpperCase(),
                ativo: true
            });
            
            if (motivoExistente) {
                return res.status(409).json({
                    error: 'Código já existe',
                    message: 'Já existe um motivo com este código'
                });
            }
        }
        
        // Criar novo motivo
        const novoMotivo = new MotivoDescarte({
            codigo: codigo ? codigo.toUpperCase() : undefined, // Será gerado automaticamente se não fornecido
            nome,
            classe,
            descricao: descricao || '', // Usar string vazia se não fornecido
            gravidade,
            cor
        });
        
        await novoMotivo.save();
        
        res.status(201).json({ 
            success: true,
            message: 'Motivo de descarte criado com sucesso',
            data: novoMotivo
        });
    } catch (error) {
        console.error('Erro ao criar motivo de descarte:', error);
        
        // Tratar erros específicos do MongoDB
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                error: 'Erro de validação',
                message: 'Dados inválidos fornecidos',
                details: errors
            });
        }
        
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'Código duplicado',
                message: 'Já existe um motivo com este código'
            });
        }
        
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível criar o motivo de descarte',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PUT /api/motivos-descarte/:id - Atualizar motivo
router.put('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { codigo, nome, classe, descricao, gravidade, cor, ativo } = req.body;
        
        // Verificar se o motivo existe
        const motivo = await MotivoDescarte.findById(req.params.id);
        
        if (!motivo) {
            return res.status(404).json({ 
                error: 'Motivo não encontrado',
                message: 'O motivo especificado não foi encontrado'
            });
        }
        
        // Verificar se já existe outro motivo com o mesmo código (se código foi alterado)
        if (codigo && codigo.toUpperCase() !== motivo.codigo) {
            const motivoExistente = await MotivoDescarte.findOne({ 
                codigo: codigo.toUpperCase(),
                ativo: true,
                _id: { $ne: req.params.id }
            });
            
            if (motivoExistente) {
                return res.status(409).json({
                    error: 'Código já existe',
                    message: 'Já existe um motivo com este código'
                });
            }
        }
        
        // Atualizar campos
        if (codigo) motivo.codigo = codigo.toUpperCase();
        if (nome) motivo.nome = nome;
        if (classe) motivo.classe = classe;
        if (descricao) motivo.descricao = descricao;
        if (gravidade) motivo.gravidade = gravidade;
        if (cor) motivo.cor = cor;
        if (ativo !== undefined) motivo.ativo = ativo;
        
        await motivo.save();
        
        res.json({ 
            success: true,
            message: 'Motivo de descarte atualizado com sucesso',
            data: motivo
        });
    } catch (error) {
        console.error('Erro ao atualizar motivo de descarte:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível atualizar o motivo de descarte'
        });
    }
});

// DELETE /api/motivos-descarte/:id - Excluir motivo (hard delete)
router.delete('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        // Verificar se o motivo existe
        const motivo = await MotivoDescarte.findById(req.params.id);
        
        if (!motivo) {
            return res.status(404).json({ 
                error: 'Motivo não encontrado',
                message: 'O motivo especificado não foi encontrado'
            });
        }
        
        // Hard delete - remover fisicamente do banco
        await MotivoDescarte.findByIdAndDelete(req.params.id);
        
        res.json({ 
            success: true,
            message: 'Motivo de descarte excluído com sucesso'
        });
    } catch (error) {
        console.error('Erro ao excluir motivo de descarte:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível excluir o motivo de descarte'
        });
    }
});

// GET /api/motivos-descarte/classes/summary - Resumo por classes
router.get('/classes/summary', authenticateToken, async (req, res) => {
    try {
        const summary = await MotivoDescarte.aggregate([
            { $match: { ativo: true } },
            { $group: { 
                _id: '$classe', 
                count: { $sum: 1 },
                motivos: { $push: { nome: '$nome', codigo: '$codigo', cor: '$cor' } }
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

// GET /api/motivos-descarte/gravidade/summary - Resumo por gravidade
router.get('/gravidade/summary', authenticateToken, async (req, res) => {
    try {
        const summary = await MotivoDescarte.aggregate([
            { $match: { ativo: true } },
            { $group: { 
                _id: '$gravidade', 
                count: { $sum: 1 },
                motivos: { $push: { nome: '$nome', codigo: '$codigo', classe: '$classe' } }
            }},
            { $sort: { count: -1 } }
        ]);
        
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Erro ao buscar resumo de gravidade:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar o resumo de gravidade'
        });
    }
});

module.exports = router;
