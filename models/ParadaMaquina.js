const mongoose = require('mongoose');

const paradaMaquinaSchema = new mongoose.Schema({
    machineId: {
        type: String,
        required: [true, 'MachineId é obrigatório'],
        trim: true,
        uppercase: true
    },
    type: {
        type: String,
        default: 'machine_stop',
        trim: true
    },
    reason: {
        type: String,
        required: [true, 'Motivo da parada é obrigatório'],
        trim: true,
        maxlength: [200, 'Motivo não pode exceder 200 caracteres']
    },
    motivoParada: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MotivoParada',
        default: null
    },
    duration_seconds: {
        type: Number,
        required: [true, 'Duração em segundos é obrigatória'],
        min: [1, 'Duração deve ser maior que 0']
    },
    duration: {
        type: Number,
        min: [1, 'Duração deve ser maior que 0']
    },
    classified: {
        type: Boolean,
        default: false
    },
    operator: {
        type: String,
        trim: true,
        default: 'N/A'
    },
    empresa: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Tornar opcional para dados existentes
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    observacoes: {
        type: String,
        trim: true,
        maxlength: [500, 'Observações não podem exceder 500 caracteres']
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            // Campo derivado: duração total em segundos
            const dur1 = typeof ret.duration_seconds === 'number' ? ret.duration_seconds : null;
            const dur2 = typeof ret.duration === 'number' ? ret.duration : null;
            ret.durationTotalSeconds = dur1 ?? dur2 ?? null;
            delete ret.__v;
            return ret;
        }
    }
});

// Índices para performance
paradaMaquinaSchema.index({ machineId: 1 });
paradaMaquinaSchema.index({ empresa: 1 });
paradaMaquinaSchema.index({ timestamp: -1 });
paradaMaquinaSchema.index({ classified: 1 });
paradaMaquinaSchema.index({ reason: 1 });
// Composto por empresa e tempo para filtros temporais
paradaMaquinaSchema.index({ empresa: 1, timestamp: -1 });

module.exports = mongoose.model('ParadaMaquina', paradaMaquinaSchema, 'paradas_maquina');
