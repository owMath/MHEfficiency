const express = require('express');
const router = express.Router();
const VinculoProdutoMaquina = require('../models/VinculoProdutoMaquina');
const ConfiguracaoProduto = require('../models/ConfiguracaoProduto');
const Produto = require('../models/Produto');
const Machine = require('../models/Machine');
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

// GET /api/vinculos-produto-maquina - Listar vínculos com paginação e busca
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

        // Buscar vínculos
        const vinculos = await VinculoProdutoMaquina.find(filtros)
            .populate('produto', 'codigoProduto nomeProduto categoria')
            .populate('maquina', 'machineId nome status')
            .populate('configuracaoProduto', 'tempoCiclo tempoSetup producaoIdeal')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Contar total
        const total = await VinculoProdutoMaquina.countDocuments(filtros);

        res.json({
            success: true,
            data: vinculos,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total: total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Erro ao listar vínculos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET /api/vinculos-produto-maquina/:id - Buscar vínculo por ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // Determinar ID da empresa (permite tanto empresa quanto operador)
        let empresaId = null;
        if (req.user.tipoUsuario === 'empresa') {
            empresaId = req.user._id;
        } else if (req.user.tipoUsuario === 'operador' && req.user.operador && req.user.operador.empresaVinculada) {
            if (typeof req.user.operador.empresaVinculada === 'string') {
                empresaId = req.user.operador.empresaVinculada;
            } else if (req.user.operador.empresaVinculada._id) {
                empresaId = req.user.operador.empresaVinculada._id;
            } else if (req.user.operador.empresaVinculada.toString) {
                empresaId = req.user.operador.empresaVinculada.toString();
            }
        }

        if (!empresaId) {
            return res.status(403).json({
                success: false,
                message: 'Usuário não tem empresa vinculada'
            });
        }

        const vinculo = await VinculoProdutoMaquina.findOne({
            _id: req.params.id,
            empresa: empresaId,
            ativo: true
        }).populate('produto', 'codigoProduto nomeProduto categoria')
          .populate('maquina', 'machineId nome status')
          .populate('configuracaoProduto', 'tempoCiclo tempoSetup producaoIdeal');

        if (!vinculo) {
            return res.status(404).json({
                success: false,
                message: 'Vínculo não encontrado'
            });
        }

        res.json({
            success: true,
            data: vinculo
        });
    } catch (error) {
        console.error('Erro ao buscar vínculo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// POST /api/vinculos-produto-maquina - Criar novo vínculo
router.post('/', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { configuracaoProduto, produto, maquina, observacoes } = req.body;

        // Validar se a configuração do produto existe e pertence à empresa
        const configuracaoExiste = await ConfiguracaoProduto.findOne({
            _id: configuracaoProduto,
            empresa: req.user._id,
            ativo: true
        }).populate('produto', 'codigoProduto nomeProduto maquina');

        if (!configuracaoExiste) {
            return res.status(400).json({
                success: false,
                message: 'Configuração do produto não encontrada ou não pertence à sua empresa'
            });
        }

        // Verificar se o produto existe e pertence à empresa
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

        // Verificar se a máquina existe (tentar buscar por _id, depois por machineId)
        let maquinaExiste = null;
        
        // Se maquina parece ser um ObjectId válido, tentar buscar por _id
        if (maquina.match(/^[0-9a-fA-F]{24}$/)) {
            maquinaExiste = await Machine.findById(maquina);
        } else {
            // Se não é ObjectId, provavelmente é machineId (string)
            // Tentar buscar exatamente como recebido
            maquinaExiste = await Machine.findOne({ machineId: maquina });
            
            // Se não encontrar, tentar em uppercase
            if (!maquinaExiste) {
                const maquinaIdUpper = maquina.toString().toUpperCase().trim();
                maquinaExiste = await Machine.findOne({ machineId: maquinaIdUpper });
            }
            
            // Se ainda não encontrar, buscar case-insensitive
            if (!maquinaExiste) {
                maquinaExiste = await Machine.findOne({ machineId: { $regex: new RegExp(`^${maquina}$`, 'i') } });
            }
        }

        if (!maquinaExiste) {
            return res.status(400).json({
                success: false,
                message: 'Máquina não encontrada'
            });
        }

        // Se a máquina tem empresa definida, verificar se pertence à empresa do usuário
        // Máquinas sem empresa (legadas) são permitidas
        if (maquinaExiste.empresa && maquinaExiste.empresa.toString() !== req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Máquina não pertence à sua empresa'
            });
        }

        // Verificar se já existe vínculo para este produto e máquina
        const vinculoExistente = await VinculoProdutoMaquina.findOne({
            produto: produto,
            maquina: maquinaExiste._id,
            empresa: req.user._id
        });

        if (vinculoExistente) {
            return res.status(400).json({
                success: false,
                message: 'Já existe um vínculo para este produto e máquina'
            });
        }

        // Criar novo vínculo
        const novoVinculo = new VinculoProdutoMaquina({
            configuracaoProduto,
            produto,
            maquina: maquinaExiste._id,
            tempoCiclo: configuracaoExiste.tempoCiclo, // Manter em segundos
            tempoSetup: configuracaoExiste.tempoSetup, // Manter em segundos
            producaoIdeal: configuracaoExiste.producaoIdeal,
            observacoes: observacoes || '',
            empresa: req.user._id
        });

        await novoVinculo.save();

        // Popular dados relacionados para retorno
        await novoVinculo.populate('produto', 'codigoProduto nomeProduto categoria');
        await novoVinculo.populate('maquina', 'machineId nome status');
        await novoVinculo.populate('configuracaoProduto', 'tempoCiclo tempoSetup producaoIdeal');

        res.status(201).json({
            success: true,
            message: 'Vínculo criado com sucesso',
            data: novoVinculo
        });
    } catch (error) {
        console.error('Erro ao criar vínculo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// PUT /api/vinculos-produto-maquina/:id - Atualizar vínculo
router.put('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { observacoes } = req.body;

        const vinculo = await VinculoProdutoMaquina.findOne({
            _id: req.params.id,
            empresa: req.user._id,
            ativo: true
        });

        if (!vinculo) {
            return res.status(404).json({
                success: false,
                message: 'Vínculo não encontrado'
            });
        }

        // Atualizar apenas observações (as especificações técnicas vêm da configuração)
        vinculo.observacoes = observacoes !== undefined ? observacoes : vinculo.observacoes;

        await vinculo.save();

        // Popular dados relacionados para retorno
        await vinculo.populate('produto', 'codigoProduto nomeProduto categoria');
        await vinculo.populate('maquina', 'machineId nome status');
        await vinculo.populate('configuracaoProduto', 'tempoCiclo tempoSetup producaoIdeal');

        res.json({
            success: true,
            message: 'Vínculo atualizado com sucesso',
            data: vinculo
        });
    } catch (error) {
        console.error('Erro ao atualizar vínculo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// DELETE /api/vinculos-produto-maquina/:id - Excluir vínculo (hard delete)
router.delete('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const vinculo = await VinculoProdutoMaquina.findOne({
            _id: req.params.id,
            empresa: req.user._id
        });

        if (!vinculo) {
            return res.status(404).json({
                success: false,
                message: 'Vínculo não encontrado'
            });
        }

        // Hard delete - remover fisicamente do banco
        await VinculoProdutoMaquina.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Vínculo excluído com sucesso'
        });
    } catch (error) {
        console.error('Erro ao excluir vínculo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;
