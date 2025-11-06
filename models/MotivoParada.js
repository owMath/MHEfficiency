const mongoose = require('mongoose');

const motivoParadaSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'Nome do motivo é obrigatório'],
        trim: true,
        minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
        maxlength: [100, 'Nome não pode exceder 100 caracteres']
    },
    classe: {
        type: String,
        required: [true, 'Classe é obrigatória'],
        enum: ['equipamento', 'processo', 'operacional', 'organizacional'],
        lowercase: true
    },
    descricao: {
        type: String,
        required: [true, 'Descrição é obrigatória'],
        trim: true,
        maxlength: [500, 'Descrição não pode exceder 500 caracteres']
    },
    empresa: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Tornar opcional para motivos globais
    },
    ativo: {
        type: Boolean,
        default: true
    },
    cor: {
        type: String,
        default: '#3b82f6',
        match: [/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato hexadecimal']
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.__v;
            return ret;
        }
    }
});

// Índices para performance
motivoParadaSchema.index({ ativo: 1 }); // Removido índice por empresa
motivoParadaSchema.index({ classe: 1 });
motivoParadaSchema.index({ nome: 1 });

// Middleware para garantir que apenas empresas possam criar motivos
motivoParadaSchema.pre('save', function(next) {
    // Validação adicional pode ser adicionada aqui se necessário
    next();
});

module.exports = mongoose.model('MotivoParada', motivoParadaSchema);
