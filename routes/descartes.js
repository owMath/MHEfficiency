const express = require('express');
const router = express.Router();
const Descarte = require('../models/Descarte');
const User = require('../models/User');
const MotivoDescarte = require('../models/MotivoDescarte');

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

// Middleware para verificar se usuário está ativo
const verificarUsuarioAtivo = (req, res, next) => {
    if (req.user.status !== 'ativo') {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Usuário deve estar ativo para registrar descartes'
        });
    }
    next();
};

// GET /api/descartes - Buscar descartes
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { 
            maquina, 
            severidade, 
            categoria, 
            dataInicio, 
            dataFim, 
            search,
            page = 1,
            limit = 50
        } = req.query;
        
        // Construir filtros
        let filters = { ativo: true };
        
        
        // Filtrar por empresa do usuário - Versão robusta
        let empresaId = null;
        
        if (req.user.tipoUsuario === 'empresa') {
            // Usuário é empresa - usar seu próprio ID
            empresaId = req.user._id;
        } else if (req.user.tipoUsuario === 'operador') {
            // Usuário é operador - usar ID da empresa vinculada
            if (req.user.operador && req.user.operador.empresaVinculada) {
                if (typeof req.user.operador.empresaVinculada === 'string') {
                    // Se empresaVinculada é string (ObjectId)
                    empresaId = req.user.operador.empresaVinculada;
                } else if (req.user.operador.empresaVinculada._id) {
                    // Se empresaVinculada é objeto populado
                    empresaId = req.user.operador.empresaVinculada._id;
                } else if (req.user.operador.empresaVinculada.toString) {
                    // Se empresaVinculada é ObjectId
                    empresaId = req.user.operador.empresaVinculada.toString();
                }
            }
        }
        
        // Aplicar filtro de empresa com lógica corrigida
        if (empresaId) {
            filters.empresa = empresaId;
        }
        
        if (maquina && maquina !== 'all') {
            filters.maquina = maquina;
        }
        
        if (severidade && severidade !== 'all') {
            filters.severidade = severidade;
        }
        
        if (categoria && categoria !== 'all') {
            filters.categoria = categoria;
        }
        
        // Filtro por data
        if (dataInicio || dataFim) {
            filters.dataHora = {};
            if (dataInicio) {
                filters.dataHora.$gte = new Date(dataInicio);
            }
            if (dataFim) {
                filters.dataHora.$lte = new Date(dataFim);
            }
        }

        
        // Buscar descartes
        let query = Descarte.find(filters)
            .populate('registradoPor', 'nome email')
            .populate('empresa', 'nomeFantasia');

        // Aplicar busca por texto se fornecida
        if (search) {
            query = query.find({
                $or: [
                    { maquina: { $regex: search, $options: 'i' } },
                    { motivo: { $regex: search, $options: 'i' } },
                    { categoria: { $regex: search, $options: 'i' } },
                    { descricao: { $regex: search, $options: 'i' } }
                ]
            });
        }

        // Paginação
        const skip = (parseInt(page) - 1) * parseInt(limit);
        query = query.skip(skip).limit(parseInt(limit));

        const descartes = await query.sort({ dataHora: -1 });
        const total = await Descarte.countDocuments(filters);
        
        res.json({
            success: true,
            data: descartes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Erro ao buscar descartes:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar os descartes'
        });
    }
});

// GET /api/descartes/:id - Buscar descarte específico
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const descarte = await Descarte.findById(req.params.id)
            .populate('registradoPor', 'nome email')
            .populate('empresa', 'nomeFantasia');
        
        if (!descarte) {
            return res.status(404).json({ 
                error: 'Descarte não encontrado',
                message: 'O descarte especificado não foi encontrado'
            });
        }
        
        // Verificar se o usuário tem acesso a este descarte
        if (req.user.tipoUsuario === 'operador' && descarte.empresa.toString() !== req.user.empresa.toString()) {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Você não tem permissão para visualizar este descarte'
            });
        }
        
        res.json({
            success: true,
            data: descarte
        });
    } catch (error) {
        console.error('Erro ao buscar descarte:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar o descarte'
        });
    }
});

// POST /api/descartes - Criar novo descarte
router.post('/', authenticateToken, verificarUsuarioAtivo, async (req, res) => {
    try {
        const { 
            maquina, 
            categoria, 
            motivo, 
            quantidade, 
            severidade, 
            descricao = '' 
        } = req.body;
        
        // Validações básicas
        if (!maquina || !categoria || !motivo || !quantidade || !severidade) {
            return res.status(400).json({
                error: 'Dados incompletos',
                message: 'Todos os campos obrigatórios devem ser preenchidos'
            });
        }
        
        // Validar quantidade
        if (quantidade < 1) {
            return res.status(400).json({
                error: 'Quantidade inválida',
                message: 'A quantidade deve ser maior que zero'
            });
        }
        
        // Validar severidade
        if (!['baixa', 'media', 'alta', 'critica'].includes(severidade.toLowerCase())) {
            return res.status(400).json({
                error: 'Severidade inválida',
                message: 'Severidade deve ser: baixa, media, alta ou critica'
            });
        }
        
        // Validar categoria - apenas verificar se não está vazia
        if (!categoria || categoria.trim().length === 0) {
            return res.status(400).json({
                error: 'Categoria inválida',
                message: 'Categoria é obrigatória'
            });
        }
        
        // Determinar ID da empresa - Versão robusta
        let empresaId = null;
        
        if (req.user.tipoUsuario === 'empresa') {
            // Usuário é empresa - usar seu próprio ID
            empresaId = req.user._id;
        } else if (req.user.tipoUsuario === 'operador') {
            // Usuário é operador - usar ID da empresa vinculada
            if (req.user.operador && req.user.operador.empresaVinculada) {
                if (typeof req.user.operador.empresaVinculada === 'string') {
                    empresaId = req.user.operador.empresaVinculada;
                } else if (req.user.operador.empresaVinculada._id) {
                    empresaId = req.user.operador.empresaVinculada._id;
                } else if (req.user.operador.empresaVinculada.toString) {
                    empresaId = req.user.operador.empresaVinculada.toString();
                }
            }
        }
        
        if (!empresaId) {
            return res.status(400).json({
                error: 'Empresa não identificada',
                message: 'Não foi possível identificar a empresa do usuário'
            });
        }
        
        // Criar novo descarte
        const novoDescarte = new Descarte({
            maquina,
            categoria: categoria.toLowerCase(),
            motivo,
            quantidade: parseInt(quantidade),
            severidade: severidade.toLowerCase(),
            descricao: descricao.trim(),
            registradoPor: req.user._id,
            empresa: empresaId
        });
        
        await novoDescarte.save();
        
        // Popular os dados para retorno
        await novoDescarte.populate('registradoPor', 'nome email');
        await novoDescarte.populate('empresa', 'nomeFantasia');
        
        res.status(201).json({ 
            success: true,
            message: 'Descarte registrado com sucesso',
            data: novoDescarte
        });
    } catch (error) {
        console.error('Erro ao criar descarte:', error);
        
        // Tratar erros específicos do MongoDB
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                error: 'Erro de validação',
                message: 'Dados inválidos fornecidos',
                details: errors
            });
        }
        
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível registrar o descarte',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PUT /api/descartes/:id - Atualizar descarte
router.put('/:id', authenticateToken, verificarUsuarioAtivo, async (req, res) => {
    try {
        const { 
            maquina, 
            categoria, 
            motivo, 
            quantidade, 
            severidade, 
            descricao 
        } = req.body;
        
        // Verificar se o descarte existe
        const descarte = await Descarte.findById(req.params.id);
        
        if (!descarte) {
            return res.status(404).json({ 
                error: 'Descarte não encontrado',
                message: 'O descarte especificado não foi encontrado'
            });
        }
        
        // Verificar se o usuário tem permissão para editar
        if (req.user.tipoUsuario === 'operador' && descarte.registradoPor.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Você só pode editar seus próprios descartes'
            });
        }
        
        // Atualizar campos
        if (maquina) descarte.maquina = maquina;
        if (categoria) descarte.categoria = categoria.toLowerCase();
        if (motivo) descarte.motivo = motivo;
        if (quantidade) descarte.quantidade = parseInt(quantidade);
        if (severidade) descarte.severidade = severidade.toLowerCase();
        if (descricao !== undefined) descarte.descricao = descricao.trim();
        
        await descarte.save();
        
        // Popular os dados para retorno
        await descarte.populate('registradoPor', 'nome email');
        await descarte.populate('empresa', 'nomeFantasia');
        
        res.json({ 
            success: true,
            message: 'Descarte atualizado com sucesso',
            data: descarte
        });
    } catch (error) {
        console.error('Erro ao atualizar descarte:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível atualizar o descarte'
        });
    }
});

// DELETE /api/descartes/:id - Excluir descarte (hard delete)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Verificar se o descarte existe
        const descarte = await Descarte.findById(req.params.id);
        
        if (!descarte) {
            return res.status(404).json({ 
                error: 'Descarte não encontrado',
                message: 'O descarte especificado não foi encontrado'
            });
        }
        
        // Verificar permissões
        if (req.user.tipoUsuario === 'operador' && descarte.registradoPor.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Você só pode excluir seus próprios descartes'
            });
        }
        
        // Hard delete - remover fisicamente do banco
        await Descarte.findByIdAndDelete(req.params.id);
        
        res.json({ 
            success: true,
            message: 'Descarte excluído com sucesso'
        });
    } catch (error) {
        console.error('Erro ao excluir descarte:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível excluir o descarte'
        });
    }
});

// GET /api/descartes/summary/total - Resumo total de descartes
router.get('/summary/total', authenticateToken, async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        
        let filters = { ativo: true };
        
        // Filtrar por empresa do usuário
        if (req.user.tipoUsuario === 'empresa') {
            filters.empresa = req.user.empresa;
        } else if (req.user.tipoUsuario === 'operador') {
            filters.empresa = req.user.empresa;
        }
        
        // Filtro por data
        if (dataInicio || dataFim) {
            filters.dataHora = {};
            if (dataInicio) {
                filters.dataHora.$gte = new Date(dataInicio);
            }
            if (dataFim) {
                filters.dataHora.$lte = new Date(dataFim);
            }
        }
        
        const totalDescartes = await Descarte.aggregate([
            { $match: filters },
            { $group: { 
                _id: null, 
                totalQuantidade: { $sum: '$quantidade' },
                totalRegistros: { $sum: 1 }
            }}
        ]);
        
        res.json({
            success: true,
            data: totalDescartes[0] || { totalQuantidade: 0, totalRegistros: 0 }
        });
    } catch (error) {
        console.error('Erro ao buscar resumo total:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar o resumo total'
        });
    }
});

// GET /api/descartes/summary/motivo - Resumo por motivo
router.get('/summary/motivo', authenticateToken, async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        
        let filters = { ativo: true };
        
        // Filtrar por empresa do usuário
        if (req.user.tipoUsuario === 'empresa') {
            filters.empresa = req.user.empresa;
        } else if (req.user.tipoUsuario === 'operador') {
            filters.empresa = req.user.empresa;
        }
        
        // Filtro por data
        if (dataInicio || dataFim) {
            filters.dataHora = {};
            if (dataInicio) {
                filters.dataHora.$gte = new Date(dataInicio);
            }
            if (dataFim) {
                filters.dataHora.$lte = new Date(dataFim);
            }
        }
        
        const summary = await Descarte.aggregate([
            { $match: filters },
            { $group: { 
                _id: '$motivo', 
                quantidade: { $sum: '$quantidade' },
                registros: { $sum: 1 },
                categoria: { $first: '$categoria' }
            }},
            { $sort: { quantidade: -1 } }
        ]);
        
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Erro ao buscar resumo por motivo:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar o resumo por motivo'
        });
    }
});

// GET /api/descartes/summary/severidade - Resumo por severidade
router.get('/summary/severidade', authenticateToken, async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        
        let filters = { ativo: true };
        
        // Filtrar por empresa do usuário
        if (req.user.tipoUsuario === 'empresa') {
            filters.empresa = req.user.empresa;
        } else if (req.user.tipoUsuario === 'operador') {
            filters.empresa = req.user.empresa;
        }
        
        // Filtro por data
        if (dataInicio || dataFim) {
            filters.dataHora = {};
            if (dataInicio) {
                filters.dataHora.$gte = new Date(dataInicio);
            }
            if (dataFim) {
                filters.dataHora.$lte = new Date(dataFim);
            }
        }
        
        const summary = await Descarte.aggregate([
            { $match: filters },
            { $group: { 
                _id: '$severidade', 
                quantidade: { $sum: '$quantidade' },
                registros: { $sum: 1 }
            }},
            { $sort: { quantidade: -1 } }
        ]);
        
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Erro ao buscar resumo por severidade:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar o resumo por severidade'
        });
    }
});

// GET /api/descartes/export/csv - Exportar descartes para CSV
router.get('/export/csv', authenticateToken, async (req, res) => {
    try {
        const { 
            maquina, 
            severidade, 
            categoria, 
            dataInicio, 
            dataFim 
        } = req.query;
        
        // Construir filtros (mesmo código da busca principal)
        let filters = { ativo: true };
        
        if (req.user.tipoUsuario === 'empresa') {
            filters.empresa = req.user.empresa;
        } else if (req.user.tipoUsuario === 'operador') {
            filters.empresa = req.user.empresa;
        }
        
        if (maquina && maquina !== 'all') {
            filters.maquina = maquina;
        }
        
        if (severidade && severidade !== 'all') {
            filters.severidade = severidade;
        }
        
        if (categoria && categoria !== 'all') {
            filters.categoria = categoria;
        }
        
        if (dataInicio || dataFim) {
            filters.dataHora = {};
            if (dataInicio) {
                filters.dataHora.$gte = new Date(dataInicio);
            }
            if (dataFim) {
                filters.dataHora.$lte = new Date(dataFim);
            }
        }
        
        const descartes = await Descarte.find(filters)
            .populate('registradoPor', 'nome')
            .populate('empresa', 'nomeFantasia')
            .sort({ dataHora: -1 });
        
        // Gerar CSV
        const headers = ['Data/Hora', 'Máquina', 'Categoria', 'Motivo', 'Quantidade', 'Severidade', 'Registrado por', 'Empresa', 'Descrição'];
        const rows = descartes.map(descarte => [
            descarte.dataHora.toLocaleString('pt-BR'),
            descarte.maquina,
            descarte.categoria,
            descarte.motivo,
            descarte.quantidade,
            descarte.severidade,
            descarte.registradoPor?.nome || 'N/A',
            descarte.empresa?.nomeFantasia || 'N/A',
            descarte.descricao
        ]);
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="descartes_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
        
    } catch (error) {
        console.error('Erro ao exportar descartes:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível exportar os descartes'
        });
    }
});

module.exports = router;
