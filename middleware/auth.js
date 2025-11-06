const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware para verificar token JWT
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Token de acesso necessário',
                message: 'Faça login para acessar este recurso'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_aqui');
        
        // Buscar usuário no banco para garantir que ainda existe e está ativo
        const user = await User.findById(decoded.userId);
        if (!user || user.status !== 'ativo') {
            return res.status(401).json({ 
                success: false,
                error: 'Usuário inválido',
                message: 'Usuário não encontrado ou inativo'
            });
        }
        
        req.user = {
            _id: user._id,
            nome: user.nome,
            email: user.email,
            tipo: user.tipoUsuario,
            status: user.status,
            empresa: user.empresa
        };
        
        next();
    } catch (error) {
        console.error('Erro na autenticação:', error);
        res.status(401).json({ 
            success: false,
            error: 'Token inválido',
            message: 'Token expirado ou inválido'
        });
    }
};

module.exports = auth;
