const express = require('express');
const router = express.Router();
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
            success: false, 
            message: 'Acesso negado. Apenas empresas podem gerenciar produtos.' 
        });
    }
    next();
};

// GET /api/produtos/machines - Listar máquinas da empresa
router.get('/machines', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        // Buscar máquinas da empresa, incluindo aquelas sem empresa definida (legados)
        const machines = await Machine.find({ 
            $or: [
                { empresa: req.user._id },
                { empresa: { $exists: false } },
                { empresa: null }
            ]
        });

        // Transformar dados para estrutura esperada pelo frontend
        const machinesFormatted = machines.map(machine => ({
            _id: machine._id,
            machineId: machine.machineId,
            // Se não tem campo nome, usar machineId como nome
            nome: machine.nome || machine.machineId,
            tipo: machine.tipo || 'simulador',
            status: machine.status || 'ativo'
        }));

        res.json({
            success: true,
            data: machinesFormatted
        });
    } catch (error) {
        console.error('❌ Erro ao buscar máquinas:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// GET /api/produtos/categorias/list - Listar categorias únicas
router.get('/categorias/list', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const categorias = await Produto.distinct('categoria', { 
            empresa: req.user._id, 
            ativo: true 
        });

        res.json({
            success: true,
            data: categorias
        });
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// GET /api/produtos - Listar todos os produtos da empresa
router.get('/', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', categoria = '', maquina = '' } = req.query;
        
        const query = { 
            empresa: req.user._id,
            ativo: true 
        };

        // Filtros de busca
        if (search) {
            query.$or = [
                { nomeProduto: { $regex: search, $options: 'i' } },
                { codigoProduto: { $regex: search, $options: 'i' } },
                { categoria: { $regex: search, $options: 'i' } }
            ];
        }

        if (categoria) {
            query.categoria = categoria;
        }

        if (maquina) {
            // Buscar máquina pelo machineId para obter o _id
            const maquinaFiltro = await Machine.findOne({ 
                machineId: maquina, 
                empresa: req.user._id,
                'configuracoes.status': 'ativo'
            });
            if (maquinaFiltro) {
                query.maquina = maquinaFiltro._id;
            }
        }

        const produtos = await Produto.find(query)
            .populate('maquina', 'machineId configuracoes.nome configuracoes.status')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Produto.countDocuments(query);

        res.json({
            success: true,
            data: produtos,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// GET /api/produtos/:id - Buscar produto específico
router.get('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const produto = await Produto.findOne({ 
            _id: req.params.id, 
            empresa: req.user._id 
        }).populate('maquina', 'machineId configuracoes.nome configuracoes.status');

        if (!produto) {
            return res.status(404).json({ 
                success: false, 
                message: 'Produto não encontrado' 
            });
        }

        res.json({
            success: true,
            data: produto
        });
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// POST /api/produtos - Criar novo produto
router.post('/', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const {
            nomeProduto,
            categoria,
            maquina,
            unidadeMedida,
            peso,
            dimensoes,
            cor,
            materialPrincipal,
            fornecedor,
            precoUnitario,
            estoqueMinimo,
            descricao,
            observacoes
        } = req.body;

        // Validar campos obrigatórios
        if (!nomeProduto || !maquina) {
            return res.status(400).json({
                success: false,
                message: 'Nome do produto e máquina são obrigatórios'
            });
        }

        // Verificar se a máquina existe (tentar tanto com uppercase quanto como recebido)
        // Primeiro tentar buscar exatamente como recebido
        let maquinaExiste = await Machine.findOne({ machineId: maquina });
        
        // Se não encontrar, tentar em uppercase
        if (!maquinaExiste) {
            const maquinaIdUpper = maquina.toString().toUpperCase().trim();
            maquinaExiste = await Machine.findOne({ machineId: maquinaIdUpper });
        }
        
        // Se ainda não encontrar, buscar case-insensitive
        if (!maquinaExiste) {
            maquinaExiste = await Machine.findOne({ machineId: { $regex: new RegExp(`^${maquina}$`, 'i') } });
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

        // Criar produto
        const produto = new Produto({
            nomeProduto,
            categoria,
            maquina: maquinaExiste._id,
            unidadeMedida,
            peso: peso || 0,
            dimensoes,
            cor,
            materialPrincipal,
            fornecedor,
            precoUnitario: precoUnitario || 0,
            estoqueMinimo: estoqueMinimo || 0,
            descricao,
            observacoes,
            empresa: req.user._id
        });

        await produto.save();
        await produto.populate('maquina', 'machineId nome status');

        res.status(201).json({
            success: true,
            message: 'Produto criado com sucesso',
            data: produto
        });
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Código do produto já existe'
            });
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos',
                errors
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// PUT /api/produtos/:id - Atualizar produto
router.put('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const {
            nomeProduto,
            categoria,
            maquina,
            unidadeMedida,
            peso,
            dimensoes,
            cor,
            materialPrincipal,
            fornecedor,
            precoUnitario,
            estoqueMinimo,
            descricao,
            observacoes
        } = req.body;

        // Validar campos obrigatórios
        if (!nomeProduto || !maquina) {
            return res.status(400).json({
                success: false,
                message: 'Nome do produto e máquina são obrigatórios'
            });
        }

        // Verificar se a máquina existe (tentar tanto com uppercase quanto como recebido)
        let maquinaExiste = await Machine.findOne({ machineId: maquina });
        
        // Se não encontrar, tentar em uppercase
        if (!maquinaExiste) {
            const maquinaIdUpper = maquina.toString().toUpperCase().trim();
            maquinaExiste = await Machine.findOne({ machineId: maquinaIdUpper });
        }
        
        // Se ainda não encontrar, buscar case-insensitive
        if (!maquinaExiste) {
            maquinaExiste = await Machine.findOne({ machineId: { $regex: new RegExp(`^${maquina}$`, 'i') } });
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

        const produto = await Produto.findOneAndUpdate(
            { _id: req.params.id, empresa: req.user._id },
            {
                nomeProduto,
                categoria,
                maquina: maquinaExiste._id,
                unidadeMedida,
                peso: peso || 0,
                dimensoes,
                cor,
                materialPrincipal,
                fornecedor,
                precoUnitario: precoUnitario || 0,
                estoqueMinimo: estoqueMinimo || 0,
                descricao,
                observacoes
            },
            { new: true, runValidators: true }
        ).populate('maquina', 'machineId configuracoes.nome configuracoes.status');

        if (!produto) {
            return res.status(404).json({ 
                success: false, 
                message: 'Produto não encontrado' 
            });
        }

        res.json({
            success: true,
            message: 'Produto atualizado com sucesso',
            data: produto
        });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos',
                errors
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// DELETE /api/produtos/:id - Excluir produto (hard delete)
router.delete('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const produto = await Produto.findOne({
            _id: req.params.id,
            empresa: req.user._id
        });

        if (!produto) {
            return res.status(404).json({ 
                success: false, 
                message: 'Produto não encontrado' 
            });
        }

        // Hard delete - remover fisicamente do banco
        await Produto.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Produto excluído com sucesso'
        });
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

module.exports = router;
