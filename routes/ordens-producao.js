const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const OrdemProducao = require('../models/OrdemProducao');
const VinculoProdutoMaquina = require('../models/VinculoProdutoMaquina');
const Machine = require('../models/Machine');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

// Middleware para verificar empresa ou operador
const verificarAcesso = async (req, res, next) => {
    let empresaId = null;
    
    if (req.user.tipoUsuario === 'empresa') {
        empresaId = req.user._id;
    } else if (req.user.tipoUsuario === 'operador' && req.user.operador && req.user.operador.empresaVinculada) {
        empresaId = req.user.operador.empresaVinculada;
    } else {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Usuário não tem empresa vinculada'
        });
    }
    
    req.empresaId = empresaId;
    next();
};

// GET /api/ordens-producao - Listar ordens de produção
router.get('/', authenticateToken, verificarAcesso, async (req, res) => {
    try {
        const { maquina, status, page = 1, limit = 50 } = req.query;
        const skip = (page - 1) * limit;
        
        const filtros = { empresa: req.empresaId };
        
        if (maquina) {
            // Buscar máquina com busca flexível (incluindo máquinas legadas)
            let maquinaObj = await Machine.findOne({ 
                machineId: maquina
            });
            
            // Se não encontrar, tentar com uppercase
            if (!maquinaObj) {
                const maquinaIdUpper = maquina.toString().toUpperCase().trim();
                maquinaObj = await Machine.findOne({ machineId: maquinaIdUpper });
            }
            
            // Se ainda não encontrar, buscar case-insensitive
            if (!maquinaObj) {
                maquinaObj = await Machine.findOne({ machineId: { $regex: new RegExp(`^${maquina}$`, 'i') } });
            }
            
            if (maquinaObj) {
                filtros.maquina = maquinaObj._id;
            }
        }
        
        if (status) {
            filtros.status = status;
        }

        const ordens = await OrdemProducao.find(filtros)
            .populate({
                path: 'produto',
                select: 'codigoProduto nomeProduto categoria'
            })
            .populate({
                path: 'maquina',
                select: 'machineId nome status'
            })
            .populate({
                path: 'vinculoProdutoMaquina',
                select: '_id tempoCiclo tempoSetup producaoIdeal'
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await OrdemProducao.countDocuments(filtros);

        res.json({
            success: true,
            data: ordens,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total: total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Erro ao listar ordens:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET /api/ordens-producao/:id - Buscar ordem por ID
router.get('/:id', authenticateToken, verificarAcesso, async (req, res) => {
    try {
        const ordem = await OrdemProducao.findOne({
            _id: req.params.id,
            empresa: req.empresaId
        });

        if (!ordem) {
            return res.status(404).json({
                success: false,
                message: 'Ordem de produção não encontrada'
            });
        }

        res.json({
            success: true,
            data: ordem
        });
    } catch (error) {
        console.error('Erro ao buscar ordem:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// POST /api/ordens-producao - Criar nova ordem de produção
router.post('/', authenticateToken, verificarAcesso, async (req, res) => {
    try {
        const { vinculoProdutoMaquinaId, quantidade, dataFim, observacoes } = req.body;

        // Validações básicas
        if (!vinculoProdutoMaquinaId) {
            return res.status(400).json({
                success: false,
                message: 'Vínculo produto-máquina é obrigatório'
            });
        }

        if (!quantidade || isNaN(quantidade) || parseInt(quantidade) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantidade deve ser um número maior que zero'
            });
        }

        // Validar ObjectId format
        if (!mongoose.Types.ObjectId.isValid(vinculoProdutoMaquinaId)) {
            return res.status(400).json({
                success: false,
                message: 'ID do vínculo produto-máquina inválido'
            });
        }

        // Buscar vínculo
        const vinculo = await VinculoProdutoMaquina.findOne({
            _id: vinculoProdutoMaquinaId,
            empresa: req.empresaId,
            ativo: true
        }).populate('produto').populate('maquina');

        if (!vinculo) {
            return res.status(404).json({
                success: false,
                message: 'Vínculo produto-máquina não encontrado ou inativo'
            });
        }

        // Verificar se produto e máquina estão válidos
        if (!vinculo.produto || !vinculo.maquina) {
            return res.status(400).json({
                success: false,
                message: 'Vínculo produto-máquina está incompleto (produto ou máquina não encontrados)'
            });
        }

        // Verificar se já existe ordem em produção para esta máquina
        const maquinaId = vinculo.maquina._id || vinculo.maquina;
        const ordemExistente = await OrdemProducao.findOne({
            maquina: maquinaId,
            status: 'em-producao',
            empresa: req.empresaId
        });

        if (ordemExistente) {
            return res.status(400).json({
                success: false,
                message: 'Já existe uma ordem em produção para esta máquina'
            });
        }

        // Validar dataFim se fornecida
        let dataFimFormatada = null;
        if (dataFim) {
            dataFimFormatada = new Date(dataFim);
            if (isNaN(dataFimFormatada.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Data de fim inválida'
                });
            }
        }

        // Criar ordem
        const ordem = new OrdemProducao({
            vinculoProdutoMaquina: vinculo._id,
            produto: vinculo.produto._id || vinculo.produto,
            maquina: vinculo.maquina._id || vinculo.maquina,
            quantidade: parseInt(quantidade),
            dataFim: dataFimFormatada,
            observacoes: (observacoes || '').trim(),
            status: 'em-producao',
            empresa: req.empresaId,
            criadoPor: req.user._id
        });

        await ordem.save();

        // Popular dados para retorno
        await ordem.populate([
            { path: 'produto', select: 'codigoProduto nomeProduto categoria' },
            { path: 'maquina', select: 'machineId nome status' },
            { path: 'vinculoProdutoMaquina', select: '_id tempoCiclo tempoSetup producaoIdeal' }
        ]);

        res.status(201).json({
            success: true,
            message: 'Ordem de produção criada com sucesso',
            data: ordem
        });
    } catch (error) {
        console.error('Erro ao criar ordem:', error);
        
        // Tratar erros de validação do Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Erro de validação',
                errors: messages
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Número de ordem já existe. Tente novamente.'
            });
        }

        // Retornar mensagem de erro mais detalhada em desenvolvimento
        const errorMessage = process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'Erro interno do servidor';
        
        res.status(500).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// PUT /api/ordens-producao/:id - Atualizar ordem de produção
router.put('/:id', authenticateToken, verificarAcesso, async (req, res) => {
    try {
        const { quantidade, quantidadeProduzida, dataFim, observacoes } = req.body;

        const ordem = await OrdemProducao.findOne({
            _id: req.params.id,
            empresa: req.empresaId
        });

        if (!ordem) {
            return res.status(404).json({
                success: false,
                message: 'Ordem de produção não encontrada'
            });
        }

        if (ordem.status !== 'em-producao') {
            return res.status(400).json({
                success: false,
                message: 'Apenas ordens em produção podem ser editadas'
            });
        }

        if (quantidade !== undefined) ordem.quantidade = parseInt(quantidade);
        if (quantidadeProduzida !== undefined) ordem.quantidadeProduzida = parseInt(quantidadeProduzida);
        if (dataFim !== undefined) ordem.dataFim = dataFim ? new Date(dataFim) : null;
        if (observacoes !== undefined) ordem.observacoes = observacoes;

        // Verificar se a quantidade produzida atingiu ou ultrapassou a quantidade meta
        // e finalizar automaticamente a ordem
        let ordemFinalizada = false;
        if (ordem.quantidadeProduzida >= ordem.quantidade && ordem.status === 'em-producao') {
            ordem.status = 'finalizada';
            if (!ordem.dataFim) {
                ordem.dataFim = new Date();
            }
            ordemFinalizada = true;
        }

        await ordem.save();

        res.json({
            success: true,
            message: ordemFinalizada 
                ? 'Ordem de produção finalizada automaticamente - quantidade meta atingida!' 
                : 'Ordem de produção atualizada com sucesso',
            data: ordem,
            finalizada: ordemFinalizada
        });
    } catch (error) {
        console.error('Erro ao atualizar ordem:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// DELETE /api/ordens-producao/:id - Finalizar ordem de produção (não exclui do banco)
router.delete('/:id', authenticateToken, verificarAcesso, async (req, res) => {
    try {
        // Validar ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'ID da ordem inválido'
            });
        }

        const ordem = await OrdemProducao.findOne({
            _id: req.params.id,
            empresa: req.empresaId
        });

        if (!ordem) {
            return res.status(404).json({
                success: false,
                message: 'Ordem de produção não encontrada'
            });
        }

        // Ao invés de excluir, apenas atualizar o status para 'finalizada'
        ordem.status = 'finalizada';
        
        // Se ainda não tiver dataFim, definir como agora
        if (!ordem.dataFim) {
            ordem.dataFim = new Date();
        }
        
        await ordem.save();

        res.json({
            success: true,
            message: 'Ordem de produção finalizada com sucesso'
        });
    } catch (error) {
        console.error('Erro ao finalizar ordem:', error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'ID da ordem inválido'
            });
        }
        
        const errorMessage = process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'Erro interno do servidor';
        
        res.status(500).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// GET /api/ordens-producao/vinculos/:maquinaId - Listar vínculos disponíveis para uma máquina
router.get('/vinculos/:maquinaId', authenticateToken, verificarAcesso, async (req, res) => {
    try {
        // Buscar máquina com busca flexível (incluindo máquinas legadas)
        let maquina = await Machine.findOne({
            machineId: req.params.maquinaId
        });
        
        // Se não encontrar, tentar com uppercase
        if (!maquina) {
            const maquinaIdUpper = req.params.maquinaId.toString().toUpperCase().trim();
            maquina = await Machine.findOne({ machineId: maquinaIdUpper });
        }
        
        // Se ainda não encontrar, buscar case-insensitive
        if (!maquina) {
            maquina = await Machine.findOne({ machineId: { $regex: new RegExp(`^${req.params.maquinaId}$`, 'i') } });
        }

        if (!maquina) {
            return res.status(404).json({
                success: false,
                message: 'Máquina não encontrada'
            });
        }

        // Buscar vínculos da máquina
        const vinculos = await VinculoProdutoMaquina.find({
            maquina: maquina._id,
            empresa: req.empresaId,
            ativo: true
        }).populate('produto', 'codigoProduto nomeProduto categoria');

        res.json({
            success: true,
            data: vinculos
        });
    } catch (error) {
        console.error('Erro ao listar vínculos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;

