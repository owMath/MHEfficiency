const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const EmpresaConfig = require('../models/EmpresaConfig');
const User = require('../models/User');

// Middleware para verificar autenticação
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso necessário' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }
        
        if (user.status === 'inativo') {
            return res.status(401).json({ error: 'Usuário inválido ou inativo' });
        }
        
        // Permitir usuários pendentes para configurações da empresa
        if (user.status === 'pendente' && user.tipoUsuario !== 'empresa') {
            return res.status(401).json({ error: 'Usuário aguardando aprovação' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido' });
    }
};

// ===== ROTA TEMPORÁRIA PARA DEBUG =====

// Rota para verificar status do usuário atual
router.get('/debug/user-status', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                nome: user.nome,
                email: user.email,
                tipoUsuario: user.tipoUsuario,
                status: user.status,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para corrigir status do usuário atual
router.post('/debug/fix-user-status', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const oldStatus = user.status;
        user.status = 'ativo';
        await user.save();

        res.json({
            success: true,
            message: 'Status do usuário corrigido',
            oldStatus,
            newStatus: user.status,
            user: {
                id: user._id,
                nome: user.nome,
                email: user.email,
                tipoUsuario: user.tipoUsuario,
                status: user.status
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== ROTAS PARA INFORMAÇÕES DA EMPRESA =====

// GET - Buscar configurações da empresa
router.get('/empresa', authenticateToken, async (req, res) => {
    try {
        // Se já existe configuração específica, usar ela
        let config = await EmpresaConfig.findOne({ empresaId: req.user._id });
        
        if (config) {
            return res.json({
                success: true,
                data: config
            });
        }
        
        // Se não existe configuração específica, usar dados do cadastro do usuário
        if (req.user.tipoUsuario === 'empresa' && req.user.empresa) {
            const empresaData = {
                nome: req.user.empresa.nome || '',
                cnpj: req.user.empresa.cnpj || '',
                razaoSocial: req.user.empresa.nome || '', // Usar nome como razão social se não tiver
                moedaPadrao: 'BRL',
                cep: req.user.empresa.endereco?.cep || '',
                endereco: req.user.empresa.endereco?.rua || '',
                numero: req.user.empresa.endereco?.numero || '',
                bairro: req.user.empresa.endereco?.bairro || '',
                cidade: req.user.empresa.endereco?.cidade || '',
                estado: req.user.empresa.endereco?.estado || '',
                telefone: req.user.empresa.telefone || '',
                celular: req.user.empresa.telefone || '', // Usar telefone como celular se não tiver
                email: req.user.email || '',
                website: ''
            };
            
            return res.json({
                success: true,
                data: empresaData
            });
        }
        
        return res.status(404).json({ error: 'Configurações da empresa não encontradas' });
    } catch (error) {
        console.error('Erro ao buscar configurações da empresa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST/PUT - Salvar configurações da empresa
router.post('/empresa', authenticateToken, async (req, res) => {
    try {
        const dadosEmpresa = req.body;
        
        // Validar dados obrigatórios
        if (!dadosEmpresa.nome || !dadosEmpresa.email) {
            return res.status(400).json({ 
                error: 'Nome da empresa e e-mail são obrigatórios' 
            });
        }

        // Verificar se já existe configuração
        let config = await EmpresaConfig.findOne({ empresaId: req.user._id });
        
        if (config) {
            // Atualizar configuração existente
            Object.assign(config, dadosEmpresa);
            config.atualizadoPor = req.user._id;
            await config.save();
        } else {
            // Criar nova configuração
            config = new EmpresaConfig({
                ...dadosEmpresa,
                empresaId: req.user._id,
                atualizadoPor: req.user._id
            });
            await config.save();
        }

        // Também atualizar dados básicos do usuário se necessário
        if (req.user.tipoUsuario === 'empresa') {
            const updateUser = {};
            
            // Atualizar email se mudou
            if (dadosEmpresa.email !== req.user.email) {
                updateUser.email = dadosEmpresa.email;
            }
            
            // Atualizar dados da empresa no usuário
            if (!req.user.empresa) {
                req.user.empresa = {};
            }
            
            req.user.empresa.nome = dadosEmpresa.nome;
            req.user.empresa.cnpj = dadosEmpresa.cnpj;
            req.user.empresa.telefone = dadosEmpresa.telefone || dadosEmpresa.celular;
            
            if (!req.user.empresa.endereco) {
                req.user.empresa.endereco = {};
            }
            
            req.user.empresa.endereco.cep = dadosEmpresa.cep;
            req.user.empresa.endereco.rua = dadosEmpresa.endereco;
            req.user.empresa.endereco.numero = dadosEmpresa.numero;
            req.user.empresa.endereco.bairro = dadosEmpresa.bairro;
            req.user.empresa.endereco.cidade = dadosEmpresa.cidade;
            req.user.empresa.endereco.estado = dadosEmpresa.estado;
            
            await req.user.save();
        }

        res.json({
            success: true,
            message: 'Configurações da empresa salvas com sucesso',
            data: config
        });
    } catch (error) {
        console.error('Erro ao salvar configurações da empresa:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                error: 'Dados inválidos',
                details: Object.values(error.errors).map(err => err.message)
            });
        }
        
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
