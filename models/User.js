const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'Nome é obrigatório'],
        trim: true,
        minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
        maxlength: [100, 'Nome não pode exceder 100 caracteres']
    },
    email: {
        type: String,
        required: [true, 'Email é obrigatório'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
    },
    senha: {
        type: String,
        required: [true, 'Senha é obrigatória'],
        minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
    },
    tipoUsuario: {
        type: String,
        enum: ['operador', 'empresa'],
        required: [true, 'Tipo de usuário é obrigatório']
    },
    status: {
        type: String,
        enum: ['ativo', 'pendente', 'inativo'],
        default: 'pendente'
    },
    empresa: {
        nome: {
            type: String,
            required: function() {
                return this.tipoUsuario === 'empresa';
            },
            trim: true,
            maxlength: [200, 'Nome da empresa não pode exceder 200 caracteres']
        },
        cnpj: {
            type: String,
            required: function() {
                return this.tipoUsuario === 'empresa';
            },
            match: [/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido']
        },
        telefone: {
            type: String,
            required: function() {
                return this.tipoUsuario === 'empresa';
            },
            match: [/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone inválido']
        },
        endereco: {
            rua: {
                type: String,
                required: function() {
                    return this.tipoUsuario === 'empresa';
                },
                trim: true
            },
            numero: {
                type: String,
                required: function() {
                    return this.tipoUsuario === 'empresa';
                },
                trim: true
            },
            bairro: {
                type: String,
                required: function() {
                    return this.tipoUsuario === 'empresa';
                },
                trim: true
            },
            cidade: {
                type: String,
                required: function() {
                    return this.tipoUsuario === 'empresa';
                },
                trim: true
            },
            estado: {
                type: String,
                required: function() {
                    return this.tipoUsuario === 'empresa';
                },
                trim: true,
                maxlength: [2, 'Estado deve ter 2 caracteres']
            },
            cep: {
                type: String,
                required: function() {
                    return this.tipoUsuario === 'empresa';
                },
                match: [/^\d{5}-\d{3}$/, 'CEP inválido']
            }
        },
        linhasProducao: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LinhaProducao'
        }]
    },
    operador: {
        cargo: {
            type: String,
            required: function() {
                return this.tipoUsuario === 'operador';
            },
            trim: true
        },
        telefone: {
            type: String,
            required: function() {
                return this.tipoUsuario === 'operador';
            },
            match: [/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone inválido']
        },
        empresaVinculada: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: function() {
                return this.tipoUsuario === 'operador';
            }
        },
        machineId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Machine',
            default: null
        },
        turnoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Turno',
            default: null
        }
    },
    ultimoLogin: {
        type: Date,
        default: null
    },
    tentativasLogin: {
        type: Number,
        default: 0
    },
    bloqueadoAte: {
        type: Date,
        default: null
    },
    resetToken: {
        type: String,
        default: null
    },
    resetTokenExpiry: {
        type: Date,
        default: null
    },
    permissoes: [{
        type: String,
        enum: [
            'dashboard', 'paradas', 'producao', 'descartes', 'sinal-maquina', 
            'tempo-real', 'relatorios', 'logistica', 'maquinas', 'previsao-oee',
            'config-sistema', 'config-oee', 'perfil', 'motivos-parada', 
            'motivos-descarte', 'cadastro-produtos', 'produto-maquina', 
            'config-produtos', 'config-turno', 'usuarios', 'aprovacao-operadores',
            'mtbf', 'mttr'
        ]
    }]
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.senha;
            delete ret.__v;
            return ret;
        }
    }
});

// Middleware para hash da senha antes de salvar
userSchema.pre('save', async function(next) {
    if (!this.isModified('senha')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.senha = await bcrypt.hash(this.senha, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para verificar senha
userSchema.methods.verificarSenha = async function(senhaCandidata) {
    return await bcrypt.compare(senhaCandidata, this.senha);
};

// Método para verificar se usuário está bloqueado
userSchema.methods.estaBloqueado = function() {
    return this.bloqueadoAte && this.bloqueadoAte > new Date();
};

// Método para incrementar tentativas de login
userSchema.methods.incrementarTentativas = function() {
    this.tentativasLogin += 1;
    
    // Bloquear por 30 minutos após 5 tentativas
    if (this.tentativasLogin >= 5) {
        this.bloqueadoAte = new Date(Date.now() + 30 * 60 * 1000);
    }
    
    return this.save();
};

// Método para resetar tentativas de login
userSchema.methods.resetarTentativas = function() {
    this.tentativasLogin = 0;
    this.bloqueadoAte = null;
    this.ultimoLogin = new Date();
    return this.save();
};

// Índices para performance
// email já tem índice único definido na linha 15
userSchema.index({ tipoUsuario: 1 });
userSchema.index({ status: 1 });
// Índice único parcial para empresa.cnpj (apenas quando tipoUsuario é 'empresa')
userSchema.index(
    { 'empresa.cnpj': 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { tipoUsuario: 'empresa' }
    }
);

module.exports = mongoose.model('User', userSchema);
