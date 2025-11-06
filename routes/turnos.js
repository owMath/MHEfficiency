const express = require('express');
const router = express.Router();
const Turno = require('../models/Turno');
const User = require('../models/User');

// Middleware para verificar autenticação
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso necessário' });
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_aqui');
        
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
            message: 'Apenas empresas ativas podem gerenciar turnos'
        });
    }
    next();
};

// GET /api/turnos - Buscar turnos
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, search } = req.query;
        
        let filters = { empresa: req.user.id };
        
        if (status && status !== 'Todos') {
            filters.status = status === 'ativo' ? 'ativo' : 'inativo';
        }
        
        let query = Turno.find(filters);
        
        if (search) {
            query = query.find({
                nome: { $regex: search, $options: 'i' }
            });
        }
        
        const turnos = await query
            .sort({ createdAt: -1 })
            .limit(1000);
        
        res.json({
            success: true,
            data: turnos,
            count: turnos.length
        });
    } catch (error) {
        console.error('Erro ao buscar turnos:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar os turnos'
        });
    }
});

// GET /api/turnos/:id - Buscar turno específico
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const turno = await Turno.findOne({ 
            _id: req.params.id,
            empresa: req.user.id
        });
        
        if (!turno) {
            return res.status(404).json({ 
                error: 'Turno não encontrado',
                message: 'O turno especificado não foi encontrado'
            });
        }
        
        res.json({
            success: true,
            data: turno
        });
    } catch (error) {
        console.error('Erro ao buscar turno:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar o turno'
        });
    }
});

// POST /api/turnos - Criar novo turno
router.post('/', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { nome, horarioInicio, horarioFim, diasSemana } = req.body;
        
        if (!nome || !horarioInicio || !horarioFim || !diasSemana || !Array.isArray(diasSemana) || diasSemana.length === 0) {
            return res.status(400).json({
                error: 'Dados incompletos',
                message: 'Nome, horários e dias da semana são obrigatórios'
            });
        }
        
        // Verificar se já existe turno com o mesmo nome na empresa
        const turnoExistente = await Turno.findOne({ 
            nome: nome,
            empresa: req.user.id,
            status: 'ativo'
        });
        
        if (turnoExistente) {
            return res.status(409).json({
                error: 'Turno já existe',
                message: 'Já existe um turno ativo com este nome'
            });
        }
        
        const novoTurno = new Turno({
            nome,
            horarioInicio,
            horarioFim,
            diasSemana,
            empresa: req.user.id
        });
        
        await novoTurno.save();
        
        res.status(201).json({ 
            success: true,
            message: 'Turno criado com sucesso',
            data: novoTurno
        });
    } catch (error) {
        console.error('Erro ao criar turno:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível criar o turno'
        });
    }
});

// PUT /api/turnos/:id - Atualizar turno
router.put('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const { nome, horarioInicio, horarioFim, diasSemana, status } = req.body;
        
        const turno = await Turno.findOne({ 
            _id: req.params.id,
            empresa: req.user.id
        });
        
        if (!turno) {
            return res.status(404).json({ 
                error: 'Turno não encontrado',
                message: 'O turno especificado não foi encontrado'
            });
        }
        
        // Verificar se já existe outro turno com o mesmo nome (se nome foi alterado)
        if (nome && nome !== turno.nome) {
            const turnoExistente = await Turno.findOne({ 
                nome: nome,
                empresa: req.user.id,
                status: 'ativo',
                _id: { $ne: req.params.id }
            });
            
            if (turnoExistente) {
                return res.status(409).json({
                    error: 'Turno já existe',
                    message: 'Já existe um turno ativo com este nome'
                });
            }
        }
        
        // Atualizar campos
        if (nome) turno.nome = nome;
        if (horarioInicio) turno.horarioInicio = horarioInicio;
        if (horarioFim) turno.horarioFim = horarioFim;
        if (diasSemana && Array.isArray(diasSemana) && diasSemana.length > 0) {
            turno.diasSemana = diasSemana;
        }
        if (status) turno.status = status;
        
        await turno.save();
        
        res.json({ 
            success: true,
            message: 'Turno atualizado com sucesso',
            data: turno
        });
    } catch (error) {
        console.error('Erro ao atualizar turno:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível atualizar o turno'
        });
    }
});

// DELETE /api/turnos/:id - Excluir turno
router.delete('/:id', authenticateToken, verificarEmpresa, async (req, res) => {
    try {
        const turno = await Turno.findOne({ 
            _id: req.params.id,
            empresa: req.user.id
        });
        
        if (!turno) {
            return res.status(404).json({ 
                error: 'Turno não encontrado',
                message: 'O turno especificado não foi encontrado'
            });
        }
        
        // Verificar se há operadores vinculados a este turno
        const operadoresVinculados = await User.find({
            tipoUsuario: 'operador',
            'operador.empresaVinculada': req.user.id,
            'operador.turnoId': req.params.id
        });
        
        if (operadoresVinculados.length > 0) {
            // Desvincular operadores deste turno
            await User.updateMany(
                { 'operador.turnoId': req.params.id },
                { $unset: { 'operador.turnoId': '' } }
            );
        }
        
        await Turno.findByIdAndDelete(req.params.id);
        
        res.json({ 
            success: true,
            message: 'Turno excluído com sucesso'
        });
    } catch (error) {
        console.error('Erro ao excluir turno:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível excluir o turno'
        });
    }
});

// GET /api/turnos/:id/operadores - Buscar operadores vinculados ao turno
router.get('/:id/operadores', authenticateToken, async (req, res) => {
    try {
        const turno = await Turno.findOne({ 
            _id: req.params.id,
            empresa: req.user.id
        });
        
        if (!turno) {
            return res.status(404).json({ 
                error: 'Turno não encontrado',
                message: 'O turno especificado não foi encontrado'
            });
        }
        
        const operadores = await User.find({
            tipoUsuario: 'operador',
            'operador.empresaVinculada': req.user.id,
            'operador.turnoId': req.params.id
        }).select('nome email operador.cargo operador.telefone status');
        
        res.json({
            success: true,
            data: operadores,
            count: operadores.length
        });
    } catch (error) {
        console.error('Erro ao buscar operadores do turno:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: 'Não foi possível carregar os operadores do turno'
        });
    }
});

module.exports = router;

