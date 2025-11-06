const mongoose = require('mongoose');

const linhaProducaoSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'Nome da linha de produção é obrigatório'],
        trim: true,
        maxlength: [100, 'Nome da linha não pode exceder 100 caracteres']
    },
    descricao: {
        type: String,
        trim: true,
        maxlength: [500, 'Descrição não pode exceder 500 caracteres']
    },
    empresa: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Empresa é obrigatória']
    },
    maquinas: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine'
    }],
    status: {
        type: String,
        enum: ['ativo', 'inativo'],
        default: 'ativo'
    },
    configuracoes: {
        capacidadeMaxima: {
            type: Number,
            default: 5 // Máximo de 5 máquinas por linha
        },
        intervaloMonitoramento: {
            type: Number,
            default: 10000 // 10 segundos
        }
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

// Validação para garantir que não exceda a capacidade máxima
linhaProducaoSchema.pre('save', function(next) {
    if (this.maquinas.length > this.configuracoes.capacidadeMaxima) {
        return next(new Error(`Linha de produção não pode ter mais de ${this.configuracoes.capacidadeMaxima} máquinas`));
    }
    next();
});

// Índices para performance
linhaProducaoSchema.index({ empresa: 1 });
linhaProducaoSchema.index({ status: 1 });
linhaProducaoSchema.index({ nome: 1, empresa: 1 }, { unique: true }); // Nome único por empresa

module.exports = mongoose.model('LinhaProducao', linhaProducaoSchema);
