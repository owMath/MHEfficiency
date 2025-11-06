const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Machine = require('../models/Machine');
const LinhaProducao = require('../models/LinhaProducao');
const { enviarEmailRecuperacaoSenha } = require('../utils/emailSender');
const router = express.Router();

// Middleware para verificar token JWT
const verificarToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ 
            error: 'Token de acesso necessário',
            message: 'Faça login para acessar este recurso'
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_aqui');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ 
            error: 'Token inválido',
            message: 'Token expirado ou inválido'
        });
    }
};

// Middleware para verificar permissões de supervisor
const verificarSupervisor = (req, res, next) => {
    if (req.user.tipoUsuario !== 'empresa' || req.user.status !== 'ativo') {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas empresas ativas têm acesso de supervisor'
        });
    }
    next();
};

// Rota de cadastro de operador
router.post('/cadastro/operador', async (req, res) => {
    try {
        const { nome, email, senha, cargo, telefone, empresaVinculada } = req.body;
        
        // Validações básicas
        if (!nome || !email || !senha || !cargo || !telefone || !empresaVinculada) {
            return res.status(400).json({
                error: 'Dados incompletos',
                message: 'Todos os campos são obrigatórios'
            });
        }
        
        // Verificar se empresa existe e está ativa
        const empresa = await User.findOne({ 
            _id: empresaVinculada, 
            tipoUsuario: 'empresa', 
            status: 'ativo' 
        });
        
        if (!empresa) {
            return res.status(400).json({
                error: 'Empresa inválida',
                message: 'Empresa não encontrada ou inativa'
            });
        }
        
        // Verificar se email já existe
        const usuarioExistente = await User.findOne({ email });
        if (usuarioExistente) {
            return res.status(409).json({
                error: 'Email já cadastrado',
                message: 'Este email já está sendo usado'
            });
        }
        
        // Criar operador
        const operador = new User({
            nome,
            email,
            senha,
            tipoUsuario: 'operador',
            status: 'pendente', // Operador fica pendente até aprovação
            operador: {
                cargo,
                telefone,
                empresaVinculada
            }
        });
        
        await operador.save();
        
        res.status(201).json({
            success: true,
            message: 'Operador cadastrado com sucesso! Aguarde aprovação da empresa.',
            data: {
                id: operador._id,
                nome: operador.nome,
                email: operador.email,
                status: operador.status
            }
        });
        
    } catch (error) {
        console.error('Erro no cadastro de operador:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao processar cadastro'
        });
    }
});

// Rota de cadastro de empresa
router.post('/cadastro/empresa', async (req, res) => {
    try {
        const { 
            nome, 
            email, 
            senha, 
            nomeEmpresa, 
            cnpj, 
            telefone, 
            endereco,
            linhaProducao
        } = req.body;
        
        // Validações básicas
        if (!nome || !email || !senha || !nomeEmpresa || !cnpj || !telefone || !endereco) {
            return res.status(400).json({
                error: 'Dados incompletos',
                message: 'Todos os campos são obrigatórios'
            });
        }
        
        // Verificar se email já existe
        const usuarioExistente = await User.findOne({ email });
        if (usuarioExistente) {
            return res.status(409).json({
                error: 'Email já cadastrado',
                message: 'Este email já está sendo usado'
            });
        }
        
        // Verificar se CNPJ já existe
        const cnpjExistente = await User.findOne({ 'empresa.cnpj': cnpj });
        if (cnpjExistente) {
            return res.status(409).json({
                error: 'CNPJ já cadastrado',
                message: 'Este CNPJ já está sendo usado'
            });
        }
        
        // Criar empresa
        const empresa = new User({
            nome,
            email,
            senha,
            tipoUsuario: 'empresa',
            status: 'ativo', // Empresa recebe acesso imediato
            empresa: {
                nome: nomeEmpresa,
                cnpj,
                telefone,
                endereco
            }
        });
        
        await empresa.save();
        
        // Criar linha de produção se fornecida
        let linhaProducaoCriada = null;
        if (linhaProducao && linhaProducao.nome && linhaProducao.maquinas && linhaProducao.maquinas.length > 0) {
            const maquinasIdsBuscar = linhaProducao.maquinas;
            
            // Buscar as máquinas selecionadas
            const maquinasExistentes = await Machine.find({ 
                machineId: { $in: maquinasIdsBuscar } 
            });
            
            if (maquinasExistentes.length !== linhaProducao.maquinas.length) {
                return res.status(400).json({
                    error: 'Máquinas inválidas',
                    message: `Algumas máquinas selecionadas não existem. Máquinas encontradas: ${maquinasExistentes.length} de ${linhaProducao.maquinas.length}`
                });
            }
            
            // Criar linha de produção
            linhaProducaoCriada = new LinhaProducao({
                nome: linhaProducao.nome,
                descricao: linhaProducao.descricao || '',
                empresa: empresa._id,
                maquinas: maquinasExistentes.map(m => m._id),
                status: 'ativo'
            });
            
            await linhaProducaoCriada.save();
            
            // Atualizar empresa com a linha de produção
            empresa.empresa.linhasProducao.push(linhaProducaoCriada._id);
            await empresa.save();
            
            // Atualizar máquinas com a linha de produção e empresa
            await Machine.updateMany(
                { machineId: { $in: maquinasIdsBuscar } },
                { 
                    $set: { 
                        linhaProducao: linhaProducaoCriada._id,
                        empresa: empresa._id
                    } 
                }
            );
        }
        
        // Gerar token JWT para empresa
        const token = jwt.sign(
            { 
                id: empresa._id, 
                email: empresa.email, 
                tipoUsuario: empresa.tipoUsuario,
                status: empresa.status
            },
            process.env.JWT_SECRET || 'sua_chave_secreta_aqui',
            { expiresIn: '24h' }
        );
        
        res.status(201).json({
            success: true,
            message: 'Empresa cadastrada com sucesso! Acesso liberado.',
            data: {
                id: empresa._id,
                nome: empresa.nome,
                email: empresa.email,
                tipoUsuario: empresa.tipoUsuario,
                empresa: empresa.empresa,
                status: empresa.status,
                linhaProducao: linhaProducaoCriada
            },
            token
        });
        
    } catch (error) {
        console.error('Erro no cadastro de empresa:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao processar cadastro'
        });
    }
});

// Rota de login
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        
        if (!email || !senha) {
            return res.status(400).json({
                error: 'Dados incompletos',
                message: 'Email e senha são obrigatórios'
            });
        }
        
        // Buscar usuário
        const usuario = await User.findOne({ email });
        if (!usuario) {
            return res.status(401).json({
                error: 'Credenciais inválidas',
                message: 'Email ou senha incorretos'
            });
        }
        
        // Verificar se usuário está bloqueado
        if (usuario.estaBloqueado()) {
            return res.status(423).json({
                error: 'Conta bloqueada',
                message: 'Muitas tentativas de login. Tente novamente mais tarde.'
            });
        }
        
        // Verificar senha
        const senhaValida = await usuario.verificarSenha(senha);
        if (!senhaValida) {
            await usuario.incrementarTentativas();
            return res.status(401).json({
                error: 'Credenciais inválidas',
                message: 'Email ou senha incorretos'
            });
        }
        
        // Resetar tentativas de login
        await usuario.resetarTentativas();
        
        // Verificar status do usuário
        if (usuario.status === 'pendente') {
            return res.status(403).json({
                error: 'Conta pendente',
                message: 'Sua conta está aguardando aprovação',
                status: 'pendente'
            });
        }
        
        if (usuario.status === 'inativo') {
            return res.status(403).json({
                error: 'Conta inativa',
                message: 'Sua conta foi desativada'
            });
        }
        
        // Gerar token JWT
        const token = jwt.sign(
            { 
                id: usuario._id, 
                email: usuario.email, 
                tipoUsuario: usuario.tipoUsuario,
                status: usuario.status
            },
            process.env.JWT_SECRET || 'sua_chave_secreta_aqui',
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            data: {
                id: usuario._id,
                nome: usuario.nome,
                email: usuario.email,
                tipoUsuario: usuario.tipoUsuario,
                status: usuario.status,
                empresa: usuario.empresa,
                operador: usuario.operador
            },
            token
        });
        
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao processar login'
        });
    }
});

// Rota para obter dados do usuário logado
router.get('/usuario', verificarToken, async (req, res) => {
    try {
        const usuario = await User.findById(req.user.id);
        if (!usuario) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                message: 'Usuário não existe'
            });
        }
        
        res.json({
            success: true,
            data: {
                id: usuario._id,
                nome: usuario.nome,
                email: usuario.email,
                tipoUsuario: usuario.tipoUsuario,
                status: usuario.status,
                empresa: usuario.empresa,
                operador: usuario.operador,
                ultimoLogin: usuario.ultimoLogin,
                permissoes: usuario.permissoes || []
            }
        });
        
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao buscar dados do usuário'
        });
    }
});

// Rota para listar todos os usuários da empresa (operadores + empresa)
router.get('/usuarios-empresa', verificarToken, verificarSupervisor, async (req, res) => {
    try {
        // Buscar operadores vinculados à empresa (todos os status) com dados da máquina
        const operadores = await User.find({
            tipoUsuario: 'operador',
            'operador.empresaVinculada': req.user.id
        }).populate('operador.machineId', 'machineId nome tipo status').select('nome email operador.cargo operador.telefone operador.machineId status createdAt updatedAt');
        
        // Buscar dados da empresa atual
        const empresa = await User.findById(req.user.id).select('nome email status createdAt updatedAt');
        
        // Combinar todos os usuários
        const todosUsuarios = [];
        
        if (empresa) {
            todosUsuarios.push(empresa);
        }
        
        todosUsuarios.push(...operadores);
        
        res.json({
            success: true,
            data: todosUsuarios
        });
        
    } catch (error) {
        console.error('Erro ao buscar usuários da empresa:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao buscar usuários da empresa'
        });
    }
});

// Rota para listar operadores pendentes (apenas para empresas)
router.get('/operadores-pendentes', verificarToken, verificarSupervisor, async (req, res) => {
    try {
        const operadoresPendentes = await User.find({
            tipoUsuario: 'operador',
            status: 'pendente',
            'operador.empresaVinculada': req.user.id
        }).select('nome email operador.cargo operador.telefone createdAt');
        
        res.json({
            success: true,
            data: operadoresPendentes
        });
        
    } catch (error) {
        console.error('Erro ao buscar operadores pendentes:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao buscar operadores pendentes'
        });
    }
});

// Rota para listar empresas ativas (para cadastro de operadores)
router.get('/empresas-ativas', async (req, res) => {
    try {
        const empresas = await User.find({
            tipoUsuario: 'empresa',
            status: 'ativo'
        }).select('_id empresa.nome empresa.cnpj');
        
        res.json({
            success: true,
            data: empresas
        });
        
    } catch (error) {
        console.error('Erro ao buscar empresas ativas:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao buscar empresas'
        });
    }
});

// Rota para salvar permissões de usuário
router.patch('/usuario/:id/permissoes', verificarToken, verificarSupervisor, async (req, res) => {
    try {
        const { permissoes } = req.body;
        
        if (!Array.isArray(permissoes)) {
            return res.status(400).json({
                error: 'Permissões inválidas',
                message: 'Permissões devem ser um array'
            });
        }
        
        const usuario = await User.findOneAndUpdate(
            { 
                _id: req.params.id,
                $or: [
                    { tipoUsuario: 'operador', 'operador.empresaVinculada': req.user.id },
                    { _id: req.user.id } // Empresa pode editar suas próprias permissões
                ]
            },
            { permissoes },
            { new: true }
        );
        
        if (!usuario) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                message: 'Usuário não encontrado ou sem permissão para editar'
            });
        }
        
        res.json({
            success: true,
            message: 'Permissões atualizadas com sucesso',
            data: {
                id: usuario._id,
                nome: usuario.nome,
                permissoes: usuario.permissoes
            }
        });
        
    } catch (error) {
        console.error('Erro ao salvar permissões:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao processar solicitação'
        });
    }
});

// Rota para obter permissões de usuário
router.get('/usuario/:id/permissoes', verificarToken, verificarSupervisor, async (req, res) => {
    try {
        const usuario = await User.findOne({
            _id: req.params.id,
            $or: [
                { tipoUsuario: 'operador', 'operador.empresaVinculada': req.user.id },
                { _id: req.user.id }
            ]
        }).select('nome email permissoes');
        
        if (!usuario) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                message: 'Usuário não encontrado ou sem permissão para visualizar'
            });
        }
        
        res.json({
            success: true,
            data: {
                id: usuario._id,
                nome: usuario.nome,
                permissoes: usuario.permissoes || []
            }
        });
        
    } catch (error) {
        console.error('Erro ao buscar permissões:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao buscar permissões'
        });
    }
});

// Rota para aprovar/rejeitar operador
router.patch('/operador/:id/status', verificarToken, verificarSupervisor, async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['ativo', 'inativo'].includes(status)) {
            return res.status(400).json({
                error: 'Status inválido',
                message: 'Status deve ser "ativo" ou "inativo"'
            });
        }
        
        const operador = await User.findOneAndUpdate(
            { 
                _id: req.params.id,
                tipoUsuario: 'operador',
                'operador.empresaVinculada': req.user.id
            },
            { status },
            { new: true }
        );
        
        if (!operador) {
            return res.status(404).json({
                error: 'Operador não encontrado',
                message: 'Operador não encontrado ou não vinculado à sua empresa'
            });
        }
        
        res.json({
            success: true,
            message: `Operador ${status === 'ativo' ? 'aprovado' : 'rejeitado'} com sucesso`,
            data: {
                id: operador._id,
                nome: operador.nome,
                email: operador.email,
                status: operador.status
            }
        });
        
    } catch (error) {
        console.error('Erro ao alterar status do operador:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao processar solicitação'
        });
    }
});

// Rota para atualizar dados do operador (incluindo machineId e turnoId)
router.patch('/operador/:id', verificarToken, verificarSupervisor, async (req, res) => {
    try {
        const { nome, email, cargo, telefone, machineId, turnoId } = req.body;
        const Turno = require('../models/Turno');
        
        // Verificar se email já existe em outro usuário
        if (email) {
            const emailExistente = await User.findOne({ 
                email, 
                _id: { $ne: req.params.id } 
            });
            
            if (emailExistente) {
                return res.status(409).json({
                    error: 'Email já cadastrado',
                    message: 'Este email já está sendo usado por outro usuário'
                });
            }
        }
        
        // Preparar dados para atualização
        const updateData = {
            nome,
            email,
            'operador.cargo': cargo,
            'operador.telefone': telefone
        };
        
        // Verificar se a máquina pertence à empresa
        if (machineId && machineId.trim() !== '') {
            const machine = await Machine.findOne({
                _id: machineId,
                empresa: req.user.id
            });
            
            if (!machine) {
                return res.status(400).json({
                    error: 'Máquina inválida',
                    message: 'Máquina não encontrada ou não pertence à sua empresa'
                });
            }
            
            updateData['operador.machineId'] = machineId;
        } else {
            // Se machineId está vazio, definir como null
            updateData['operador.machineId'] = null;
        }
        
        // Verificar se o turno pertence à empresa
        if (turnoId && turnoId.trim() !== '') {
            const turno = await Turno.findOne({
                _id: turnoId,
                empresa: req.user.id
            });
            
            if (!turno) {
                return res.status(400).json({
                    error: 'Turno inválido',
                    message: 'Turno não encontrado ou não pertence à sua empresa'
                });
            }
            
            updateData['operador.turnoId'] = turnoId;
        } else {
            // Se turnoId está vazio, definir como null
            updateData['operador.turnoId'] = null;
        }
        
        const operador = await User.findOneAndUpdate(
            { 
                _id: req.params.id,
                tipoUsuario: 'operador',
                'operador.empresaVinculada': req.user.id
            },
            updateData,
            { new: true }
        );
        
        if (!operador) {
            return res.status(404).json({
                error: 'Operador não encontrado',
                message: 'Operador não encontrado ou não vinculado à sua empresa'
            });
        }
        
        res.json({
            success: true,
            message: 'Operador atualizado com sucesso',
            data: {
                id: operador._id,
                nome: operador.nome,
                email: operador.email,
                operador: operador.operador
            }
        });
        
    } catch (error) {
        console.error('Erro ao atualizar operador:', error);
        
        // Tratar erro de email duplicado do MongoDB
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'Email já cadastrado',
                message: 'Este email já está sendo usado por outro usuário'
            });
        }
        
        // Tratar erros de validação do Mongoose
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Dados inválidos',
                message: Object.values(error.errors).map(err => err.message).join(', ')
            });
        }
        
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao processar solicitação'
        });
    }
});

// Rota para listar máquinas da empresa
router.get('/maquinas-empresa', verificarToken, verificarSupervisor, async (req, res) => {
    try {
        // Buscar máquinas da empresa, incluindo máquinas legadas (sem empresa definida)
        const maquinas = await Machine.find({
            $or: [
                { empresa: req.user.id },
                { empresa: { $exists: false } },
                { empresa: null }
            ]
        }).select('machineId nome tipo status linhaProducao');
        
        res.json({
            success: true,
            data: maquinas
        });
        
    } catch (error) {
        console.error('Erro ao buscar máquinas da empresa:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao buscar máquinas da empresa'
        });
    }
});

// Rota para operadores carregarem máquinas da empresa vinculada
router.get('/maquinas-operador', verificarToken, async (req, res) => {
    try {
        // Buscar dados completos do usuário para obter empresa vinculada
        const usuario = await User.findById(req.user.id);
        
        if (!usuario) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                message: 'Usuário não existe'
            });
        }

        let empresaId = null;
        
        if (usuario.tipoUsuario === 'empresa') {
            // Se for empresa, usar seu próprio ID
            empresaId = usuario._id;
        } else if (usuario.tipoUsuario === 'operador' && usuario.operador && usuario.operador.empresaVinculada) {
            // Se for operador, usar ID da empresa vinculada
            empresaId = usuario.operador.empresaVinculada;
        } else {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Usuário não tem empresa vinculada'
            });
        }

        // Buscar máquinas da empresa, incluindo máquinas legadas (sem empresa definida)
        const maquinas = await Machine.find({
            $or: [
                { empresa: empresaId },
                { empresa: { $exists: false } },
                { empresa: null }
            ]
        }).select('machineId nome tipo status linhaProducao');
        
        res.json({
            success: true,
            data: maquinas
        });
        
    } catch (error) {
        console.error('Erro ao buscar máquinas do operador:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao buscar máquinas'
        });
    }
});

// Rota para alterar senha do usuário logado
router.patch('/alterar-senha', verificarToken, async (req, res) => {
    try {
        const { senhaAtual, novaSenha } = req.body;
        
        if (!senhaAtual || !novaSenha) {
            return res.status(400).json({
                error: 'Dados incompletos',
                message: 'Senha atual e nova senha são obrigatórias'
            });
        }
        
        if (novaSenha.length < 6) {
            return res.status(400).json({
                error: 'Senha inválida',
                message: 'A nova senha deve ter pelo menos 6 caracteres'
            });
        }
        
        // Buscar usuário com senha
        const usuario = await User.findById(req.user.id).select('+senha');
        if (!usuario) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                message: 'Usuário não existe'
            });
        }
        
        // Verificar senha atual
        const senhaValida = await usuario.verificarSenha(senhaAtual);
        if (!senhaValida) {
            return res.status(401).json({
                error: 'Senha incorreta',
                message: 'A senha atual está incorreta'
            });
        }
        
        // Atualizar senha
        usuario.senha = novaSenha;
        await usuario.save();
        
        res.json({
            success: true,
            message: 'Senha alterada com sucesso'
        });
        
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao processar alteração de senha'
        });
    }
});

// Rota para atualizar dados do perfil do usuário logado
router.patch('/perfil', verificarToken, async (req, res) => {
    try {
        const { nome, email } = req.body;
        
        if (!nome || !email) {
            return res.status(400).json({
                error: 'Dados incompletos',
                message: 'Nome e email são obrigatórios'
            });
        }
        
        // Verificar se email já existe em outro usuário
        const emailExistente = await User.findOne({ 
            email, 
            _id: { $ne: req.user.id } 
        });
        
        if (emailExistente) {
            return res.status(409).json({
                error: 'Email já cadastrado',
                message: 'Este email já está sendo usado por outro usuário'
            });
        }
        
        // Atualizar dados do usuário
        const usuario = await User.findByIdAndUpdate(
            req.user.id,
            { nome, email },
            { new: true }
        );
        
        if (!usuario) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                message: 'Usuário não existe'
            });
        }
        
        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso',
            data: {
                id: usuario._id,
                nome: usuario.nome,
                email: usuario.email,
                tipoUsuario: usuario.tipoUsuario,
                status: usuario.status,
                ultimoLogin: usuario.ultimoLogin,
                createdAt: usuario.createdAt
            }
        });
        
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao processar atualização do perfil'
        });
    }
});

// Rota para solicitar recuperação de senha
router.post('/esqueci-senha', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                error: 'Email obrigatório',
                message: 'Por favor, informe seu email'
            });
        }
        
        // Buscar usuário
        const usuario = await User.findOne({ email });
        
        // Sempre retornar sucesso para não revelar se o email existe ou não
        if (!usuario) {
            return res.json({
                success: true,
                message: 'Se o email existir em nosso sistema, você receberá um link de recuperação'
            });
        }
        
        // Gerar token de reset
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
        
        // Salvar token no usuário
        usuario.resetToken = resetToken;
        usuario.resetTokenExpiry = resetTokenExpiry;
        await usuario.save();
        
        // Enviar email de recuperação
        try {
            await enviarEmailRecuperacaoSenha({
                para: usuario.email,
                nome: usuario.nome,
                token: resetToken
            });
        } catch (emailError) {
            console.error('Erro ao enviar email:', emailError);
            // Limpar token se falhar o envio
            usuario.resetToken = null;
            usuario.resetTokenExpiry = null;
            await usuario.save();
            
            return res.status(500).json({
                error: 'Erro ao enviar email',
                message: 'Não foi possível enviar o email de recuperação. Tente novamente mais tarde.'
            });
        }
        
        res.json({
            success: true,
            message: 'Se o email existir em nosso sistema, você receberá um link de recuperação'
        });
        
    } catch (error) {
        console.error('Erro ao solicitar recuperação de senha:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao processar solicitação de recuperação'
        });
    }
});

// Rota para redefinir senha com token
router.post('/redefinir-senha', async (req, res) => {
    try {
        const { token, novaSenha } = req.body;
        
        if (!token || !novaSenha) {
            return res.status(400).json({
                error: 'Dados incompletos',
                message: 'Token e nova senha são obrigatórios'
            });
        }
        
        if (novaSenha.length < 6) {
            return res.status(400).json({
                error: 'Senha inválida',
                message: 'A nova senha deve ter pelo menos 6 caracteres'
            });
        }
        
        // Buscar usuário com token válido
        const usuario = await User.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: new Date() }
        });
        
        if (!usuario) {
            return res.status(400).json({
                error: 'Token inválido ou expirado',
                message: 'O token de recuperação é inválido ou expirou. Solicite um novo link.'
            });
        }
        
        // Atualizar senha
        usuario.senha = novaSenha;
        usuario.resetToken = null;
        usuario.resetTokenExpiry = null;
        await usuario.save();
        
        res.json({
            success: true,
            message: 'Senha redefinida com sucesso!'
        });
        
    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: 'Erro ao processar redefinição de senha'
        });
    }
});

module.exports = router;
