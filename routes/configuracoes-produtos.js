const express = require('express');
const router = express.Router();
const ConfiguracaoProduto = require('../models/ConfiguracaoProduto');
const Produto = require('../models/Produto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware para verificar token JWT (mesmo padrão das outras rotas)
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
        // Verificar token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_aqui');
        
        // Buscar usuário no banco de dados
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
            error: 'Acesso negado',
            message: 'Apenas empresas podem acessar este recurso'
        });
    }
    next();
};

// ===== ROTAS =====

// GET /api/configuracoes-produtos - Listar configurações com paginação e busca
router.get('/', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (page - 1) * limit;
        
        // Construir filtros
        const filtros = { empresa: req.user._id, ativo: true };
        
        // Se houver busca, filtrar por nome ou código do produto
        if (search) {
            const produtos = await Produto.find({
                empresa: req.user._id,
                $or: [
                    { nomeProduto: { $regex: search, $options: 'i' } },
                    { codigoProduto: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            
            const produtoIds = produtos.map(p => p._id);
            filtros.produto = { $in: produtoIds };
        }

        // Buscar configurações
        const configuracoes = await ConfiguracaoProduto.find(filtros)
            .populate({
                path: 'produto',
                select: 'codigoProduto nomeProduto categoria descricao maquina',
                populate: {
                    path: 'maquina',
                    select: 'machineId configuracoes.nome configuracoes.status'
                }
            })
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Contar total
        const total = await ConfiguracaoProduto.countDocuments(filtros);

        res.json({
            success: true,
            data: configuracoes,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total: total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Erro ao listar configurações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET /api/configuracoes-produtos/:id - Buscar configuração por ID
router.get('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const configuracao = await ConfiguracaoProduto.findOne({
            _id: req.params.id,
            empresa: req.user._id,
            ativo: true
        }).populate({
            path: 'produto',
            select: 'codigoProduto nomeProduto categoria descricao maquina',
            populate: {
                path: 'maquina',
                select: 'machineId configuracoes.nome configuracoes.status'
            }
        });

        if (!configuracao) {
            return res.status(404).json({
                success: false,
                message: 'Configuração não encontrada'
            });
        }

        res.json({
            success: true,
            data: configuracao
        });
    } catch (error) {
        console.error('Erro ao buscar configuração:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET /api/configuracoes-produtos/produto/:produtoId - Buscar configuração por produto
router.get('/produto/:produtoId', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const configuracao = await ConfiguracaoProduto.findOne({
            produto: req.params.produtoId,
            empresa: req.user._id,
            ativo: true
        }).populate({
            path: 'produto',
            select: 'codigoProduto nomeProduto categoria descricao maquina',
            populate: {
                path: 'maquina',
                select: 'machineId configuracoes.nome configuracoes.status'
            }
        });

        res.json({
            success: true,
            data: configuracao
        });
    } catch (error) {
        console.error('Erro ao buscar configuração por produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// POST /api/configuracoes-produtos - Criar nova configuração
router.post('/', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { produto, tempoCiclo, tempoSetup, producaoIdeal, temperatura, pressao, velocidade, materiaisNecessarios, instrucoesFabricacao } = req.body;

        // Validar se o produto existe e pertence à empresa
        const produtoExiste = await Produto.findOne({
            _id: produto,
            empresa: req.user._id,
            ativo: true
        });

        if (!produtoExiste) {
            return res.status(400).json({
                success: false,
                message: 'Produto não encontrado ou não pertence à sua empresa'
            });
        }

        // Verificar se já existe configuração para este produto
        const configuracaoExistente = await ConfiguracaoProduto.findOne({
            produto: produto,
            empresa: req.user._id
        });

        if (configuracaoExistente) {
            return res.status(400).json({
                success: false,
                message: 'Já existe uma configuração para este produto'
            });
        }

        // Criar nova configuração
        const novaConfiguracao = new ConfiguracaoProduto({
            produto,
            tempoCiclo: tempoCiclo || 0,
            tempoSetup: tempoSetup || 0,
            producaoIdeal: producaoIdeal || 0,
            temperatura: temperatura || 0,
            pressao: pressao || 0,
            velocidade: velocidade || 0,
            materiaisNecessarios: materiaisNecessarios || '',
            instrucoesFabricacao: instrucoesFabricacao || '',
            empresa: req.user._id
        });

        await novaConfiguracao.save();

        // Popular dados do produto para retorno
        await novaConfiguracao.populate({
            path: 'produto',
            select: 'codigoProduto nomeProduto categoria descricao maquina',
            populate: {
                path: 'maquina',
                select: 'machineId configuracoes.nome configuracoes.status'
            }
        });

        res.status(201).json({
            success: true,
            message: 'Configuração criada com sucesso',
            data: novaConfiguracao
        });
    } catch (error) {
        console.error('Erro ao criar configuração:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// PUT /api/configuracoes-produtos/:id - Atualizar configuração
router.put('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { tempoCiclo, tempoSetup, producaoIdeal, temperatura, pressao, velocidade, materiaisNecessarios, instrucoesFabricacao } = req.body;

        const configuracao = await ConfiguracaoProduto.findOne({
            _id: req.params.id,
            empresa: req.user._id,
            ativo: true
        });

        if (!configuracao) {
            return res.status(404).json({
                success: false,
                message: 'Configuração não encontrada'
            });
        }

        // Atualizar campos
        configuracao.tempoCiclo = tempoCiclo !== undefined ? tempoCiclo : configuracao.tempoCiclo;
        configuracao.tempoSetup = tempoSetup !== undefined ? tempoSetup : configuracao.tempoSetup;
        configuracao.producaoIdeal = producaoIdeal !== undefined ? producaoIdeal : configuracao.producaoIdeal;
        configuracao.temperatura = temperatura !== undefined ? temperatura : configuracao.temperatura;
        configuracao.pressao = pressao !== undefined ? pressao : configuracao.pressao;
        configuracao.velocidade = velocidade !== undefined ? velocidade : configuracao.velocidade;
        configuracao.materiaisNecessarios = materiaisNecessarios !== undefined ? materiaisNecessarios : configuracao.materiaisNecessarios;
        configuracao.instrucoesFabricacao = instrucoesFabricacao !== undefined ? instrucoesFabricacao : configuracao.instrucoesFabricacao;

        await configuracao.save();

        // Popular dados do produto para retorno
        await configuracao.populate({
            path: 'produto',
            select: 'codigoProduto nomeProduto categoria descricao maquina',
            populate: {
                path: 'maquina',
                select: 'machineId configuracoes.nome configuracoes.status'
            }
        });

        res.json({
            success: true,
            message: 'Configuração atualizada com sucesso',
            data: configuracao
        });
    } catch (error) {
        console.error('Erro ao atualizar configuração:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// DELETE /api/configuracoes-produtos/:id - Excluir configuração (hard delete)
router.delete('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const configuracao = await ConfiguracaoProduto.findOne({
            _id: req.params.id,
            empresa: req.user._id
        });

        if (!configuracao) {
            return res.status(404).json({
                success: false,
                message: 'Configuração não encontrada'
            });
        }

        // Hard delete - remover fisicamente do banco
        await ConfiguracaoProduto.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Configuração excluída com sucesso'
        });
    } catch (error) {
        console.error('Erro ao excluir configuração:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;
