const mongoose = require('mongoose');

const empresaConfigSchema = new mongoose.Schema({
    // Informações principais
    nome: {
        type: String,
        required: true,
        trim: true
    },
    cnpj: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                return !v || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(v);
            },
            message: 'CNPJ deve estar no formato 00.000.000/0000-00'
        }
    },
    razaoSocial: {
        type: String,
        trim: true
    },
    moedaPadrao: {
        type: String,
        enum: ['BRL', 'USD', 'EUR'],
        default: 'BRL'
    },
    
    // Endereço
    cep: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                return !v || /^\d{5}-\d{3}$/.test(v);
            },
            message: 'CEP deve estar no formato 00000-000'
        }
    },
    endereco: {
        type: String,
        trim: true
    },
    numero: {
        type: String,
        trim: true
    },
    bairro: {
        type: String,
        trim: true
    },
    cidade: {
        type: String,
        trim: true
    },
    estado: {
        type: String,
        trim: true,
        enum: ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
    },
    
    // Contato
    telefone: {
        type: String,
        trim: true
    },
    celular: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: 'E-mail inválido'
        }
    },
    website: {
        type: String,
        trim: true
    },
    
    // Metadados
    empresaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    ultimaAtualizacao: {
        type: Date,
        default: Date.now
    },
    atualizadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Índices para melhor performance
// empresaId já tem índice único definido na linha 94
empresaConfigSchema.index({ email: 1 });
empresaConfigSchema.index({ cnpj: 1 });

// Middleware para atualizar timestamp
empresaConfigSchema.pre('save', function(next) {
    this.ultimaAtualizacao = new Date();
    next();
});

module.exports = mongoose.model('EmpresaConfig', empresaConfigSchema);
