const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
    machineId: {
        type: String,
        required: [true, 'MachineId é obrigatório'],
        unique: true,
        trim: true,
        uppercase: true
    },
    nome: {
        type: String,
        required: [true, 'Nome da máquina é obrigatório'],
        trim: true,
        maxlength: [100, 'Nome da máquina não pode exceder 100 caracteres']
    },
    tipo: {
        type: String,
        enum: ['simulador', 'real'],
        default: 'simulador'
    },
    status: {
        type: String,
        enum: ['ativo', 'inativo', 'manutencao'],
        default: 'ativo'
    },
    linhaProducao: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LinhaProducao',
        default: null
    },
    empresa: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ultimaAtualizacao: {
        type: Date,
        default: Date.now
    },
    configuracoes: {
        intervaloAtualizacao: {
            type: Number,
            default: 5000 // 5 segundos
        },
        timeout: {
            type: Number,
            default: 30000 // 30 segundos
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

// Índices para performance
// machineId já tem índice único definido na linha 7
machineSchema.index({ empresa: 1 });
machineSchema.index({ linhaProducao: 1 });
machineSchema.index({ status: 1 });

module.exports = mongoose.model('Machine', machineSchema);
