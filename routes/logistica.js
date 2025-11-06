const express = require('express');
const router = express.Router();
const { ItemLogistica, SolicitacaoCompra } = require('../models/ItemLogistica');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { enviarEmailSolicitacaoCompra } = require('../utils/emailSender');

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            error: 'Token de acesso necessário',
            message: 'Faça login para acessar este recurso'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_aqui');
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(403).json({ 
                error: 'Token inválido',
                message: 'Usuário não encontrado'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ 
            error: 'Token inválido',
            message: 'Token expirado ou inválido'
        });
    }
};

// Middleware para verificar se é empresa
const verificarEmpresa = (req, res, next) => {
    if (req.user.tipoUsuario !== 'empresa') {
        return res.status(403).json({ 
            success: false, 
            message: 'Acesso negado. Apenas empresas podem gerenciar logística.' 
        });
    }
    next();
};

// ===== ROTAS PARA ITENS DE LOGÍSTICA =====

// GET /api/logistica/itens - Listar todos os itens
router.get('/itens', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const categoria = req.query.categoria || '';
        const status = req.query.status || '';
        const precisaAtencao = req.query.precisaAtencao;

        let query = { empresa: req.user._id, ativo: true };

        // Busca por texto
        if (search) {
            query.$or = [
                { codigo: { $regex: search, $options: 'i' } },
                { nome: { $regex: search, $options: 'i' } },
                { descricao: { $regex: search, $options: 'i' } }
            ];
        }

        if (categoria) {
            query.categoria = categoria;
        }

        if (status) {
            query.status = status;
        }

        if (precisaAtencao === 'true') {
            query.precisaAtencao = true;
        }

        const total = await ItemLogistica.countDocuments(query);
        const itens = await ItemLogistica.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({
            success: true,
            data: itens,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar itens de logística:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// GET /api/logistica/itens/atencao - Listar itens que precisam de atenção (DEVE VIR ANTES DE /itens/:id)
router.get('/itens/atencao', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const itens = await ItemLogistica.find({
            empresa: req.user._id,
            ativo: true,
            precisaAtencao: true
        }).sort({ motivoAtencao: 1, quantidadeAtual: 1 });

        res.json({
            success: true,
            data: itens,
            total: itens.length
        });
    } catch (error) {
        console.error('❌ Erro ao buscar itens que precisam de atenção:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// GET /api/logistica/itens/:id - Buscar item por ID
router.get('/itens/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        // Validar se o ID é um ObjectId válido
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'ID inválido'
            });
        }

        const item = await ItemLogistica.findOne({ 
            _id: req.params.id, 
            empresa: req.user._id 
        });

        if (!item) {
            return res.status(404).json({ 
                success: false, 
                message: 'Item não encontrado' 
            });
        }

        res.json({ success: true, data: item });
    } catch (error) {
        console.error('❌ Erro ao buscar item:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// POST /api/logistica/itens - Criar novo item
router.post('/itens', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const dados = {
            ...req.body,
            empresa: req.user._id
        };

        const item = new ItemLogistica(dados);
        await item.save();

        res.status(201).json({
            success: true,
            message: 'Item criado com sucesso',
            data: item
        });
    } catch (error) {
        console.error('❌ Erro ao criar item:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos',
                errors: Object.values(error.errors).map(e => e.message)
            });
        }
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// PUT /api/logistica/itens/:id - Atualizar item
router.put('/itens/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        // Validar se o ID é um ObjectId válido
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'ID inválido'
            });
        }

        const item = await ItemLogistica.findOneAndUpdate(
            { _id: req.params.id, empresa: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!item) {
            return res.status(404).json({ 
                success: false, 
                message: 'Item não encontrado' 
            });
        }

        res.json({
            success: true,
            message: 'Item atualizado com sucesso',
            data: item
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar item:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos',
                errors: Object.values(error.errors).map(e => e.message)
            });
        }
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// DELETE /api/logistica/itens/:id - Deletar item (hard delete)
router.delete('/itens/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        // Validar se o ID é um ObjectId válido
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'ID inválido'
            });
        }

        const item = await ItemLogistica.findOneAndDelete({
            _id: req.params.id,
            empresa: req.user._id
        });

        if (!item) {
            return res.status(404).json({ 
                success: false, 
                message: 'Item não encontrado' 
            });
        }

        res.json({
            success: true,
            message: 'Item removido permanentemente com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao deletar item:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// GET /api/logistica/resumo - Resumo do estoque
router.get('/resumo', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const totalItens = await ItemLogistica.countDocuments({
            empresa: req.user._id,
            ativo: true
        });

        const itensAtencao = await ItemLogistica.countDocuments({
            empresa: req.user._id,
            ativo: true,
            precisaAtencao: true
        });

        const itensEstoqueBaixo = await ItemLogistica.countDocuments({
            empresa: req.user._id,
            ativo: true,
            $expr: { $lte: ['$quantidadeAtual', { $ifNull: ['$quantidadeMinima', 0] }] }
        });

        res.json({
            success: true,
            data: {
                totalItens,
                itensAtencao,
                itensEstoqueBaixo,
                todosOk: itensAtencao === 0
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar resumo:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// ===== ROTAS PARA SOLICITAÇÕES DE COMPRA =====

// GET /api/logistica/solicitacoes - Listar solicitações de compra
router.get('/solicitacoes', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const status = req.query.status || '';
        let query = { empresa: req.user._id };

        if (status) {
            query.status = status;
        }

        const solicitacoes = await SolicitacaoCompra.find(query)
            .populate('itemLogistica', 'codigo nome unidadeMedida')
            .populate('solicitante', 'nome email')
            .sort({ dataSolicitacao: -1 })
            .lean();

        res.json({
            success: true,
            data: solicitacoes,
            total: solicitacoes.length
        });
    } catch (error) {
        console.error('❌ Erro ao buscar solicitações:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// POST /api/logistica/solicitacoes - Criar solicitação de compra
router.post('/solicitacoes', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const dados = {
            ...req.body,
            solicitante: req.user._id,
            empresa: req.user._id
        };

        const solicitacao = new SolicitacaoCompra(dados);
        await solicitacao.save();

        // Popular dados para retorno
        await solicitacao.populate('itemLogistica', 'codigo nome unidadeMedida');
        await solicitacao.populate('solicitante', 'nome email');

        res.status(201).json({
            success: true,
            message: 'Solicitação criada com sucesso',
            data: solicitacao
        });
    } catch (error) {
        console.error('❌ Erro ao criar solicitação:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos',
                errors: Object.values(error.errors).map(e => e.message)
            });
        }
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// POST /api/logistica/solicitacoes/limpar-antigas - Limpar solicitações antigas (DEVE VIR ANTES DE /solicitacoes/:id)
router.post('/solicitacoes/limpar-antigas', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const resultado = await SolicitacaoCompra.deleteMany({
            empresa: req.user._id,
            status: { $in: ['recebida', 'cancelada'] }
        });

        res.json({
            success: true,
            message: `${resultado.deletedCount} solicitação(ões) antiga(s) removida(s)`,
            deletedCount: resultado.deletedCount
        });
    } catch (error) {
        console.error('❌ Erro ao limpar solicitações antigas:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// POST /api/logistica/solicitacoes/limpar-todas - Limpar todas as solicitações (DEVE VIR ANTES DE /solicitacoes/:id)
router.post('/solicitacoes/limpar-todas', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const resultado = await SolicitacaoCompra.deleteMany({
            empresa: req.user._id
        });

        res.json({
            success: true,
            message: `${resultado.deletedCount} solicitação(ões) removida(s)`,
            deletedCount: resultado.deletedCount
        });
    } catch (error) {
        console.error('❌ Erro ao limpar todas as solicitações:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// PUT /api/logistica/solicitacoes/:id - Atualizar solicitação
router.put('/solicitacoes/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        // Validar se o ID é um ObjectId válido
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'ID inválido'
            });
        }

        const solicitacao = await SolicitacaoCompra.findOneAndUpdate(
            { _id: req.params.id, empresa: req.user._id },
            req.body,
            { new: true, runValidators: true }
        ).populate('itemLogistica', 'codigo nome unidadeMedida')
         .populate('solicitante', 'nome email');

        if (!solicitacao) {
            return res.status(404).json({ 
                success: false, 
                message: 'Solicitação não encontrada' 
            });
        }

        res.json({
            success: true,
            message: 'Solicitação atualizada com sucesso',
            data: solicitacao
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar solicitação:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// DELETE /api/logistica/solicitacoes/:id - Deletar solicitação
router.delete('/solicitacoes/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        // Validar se o ID é um ObjectId válido
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'ID inválido'
            });
        }

        const solicitacao = await SolicitacaoCompra.findOneAndDelete({
            _id: req.params.id,
            empresa: req.user._id
        });

        if (!solicitacao) {
            return res.status(404).json({ 
                success: false, 
                message: 'Solicitação não encontrada' 
            });
        }

        res.json({
            success: true,
            message: 'Solicitação removida com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao deletar solicitação:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// POST /api/logistica/solicitar-compra-email - Enviar e-mail de solicitação de compra
router.post('/solicitar-compra-email', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { itemId, emailDestinatario, quantidade, mensagem } = req.body;

        if (!itemId || !emailDestinatario || !quantidade) {
            return res.status(400).json({
                success: false,
                message: 'Item, e-mail destinatário e quantidade são obrigatórios'
            });
        }

        // Buscar item
        const item = await ItemLogistica.findOne({
            _id: itemId,
            empresa: req.user._id
        });

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item não encontrado'
            });
        }

        // Validar e-mail
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailDestinatario)) {
            return res.status(400).json({
                success: false,
                message: 'E-mail inválido'
            });
        }

        // Enviar e-mail
        await enviarEmailSolicitacaoCompra({
            para: emailDestinatario,
            itemNome: item.nome,
            itemCodigo: item.codigo,
            quantidade: parseFloat(quantidade),
            unidadeMedida: item.unidadeMedida || 'un',
            mensagem: mensagem || '',
            solicitanteNome: req.user.nome
        });

        // Criar registro de solicitação de compra
        const solicitacao = new SolicitacaoCompra({
            itemLogistica: itemId,
            solicitante: req.user._id,
            empresa: req.user._id,
            quantidade: parseFloat(quantidade),
            prioridade: 'alta',
            status: 'pendente',
            observacoes: mensagem || `Solicitação enviada por e-mail para ${emailDestinatario}`
        });

        await solicitacao.save();

        res.json({
            success: true,
            message: 'E-mail de solicitação de compra enviado com sucesso!',
            data: {
                solicitacaoId: solicitacao._id,
                emailEnviado: emailDestinatario
            }
        });
    } catch (error) {
        console.error('❌ Erro ao enviar e-mail de solicitação de compra:', error);
        
        if (error.responseCode && error.code === 'EAUTH') {
            return res.status(500).json({
                success: false,
                message: 'Erro de autenticação do e-mail. Verifique as configurações de e-mail do sistema.'
            });
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao enviar e-mail de solicitação de compra'
        });
    }
});

module.exports = router;

