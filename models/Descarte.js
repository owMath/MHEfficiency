const mongoose = require('mongoose');

const descarteSchema = new mongoose.Schema({
    dataHora: {
        type: Date,
        required: true,
        default: Date.now
    },
    maquina: {
        type: String,
        required: true,
        trim: true
    },
    categoria: {
        type: String,
        required: true,
        trim: true,
        minlength: [2, 'Categoria deve ter pelo menos 2 caracteres'],
        maxlength: [50, 'Categoria não pode exceder 50 caracteres']
    },
    motivo: {
        type: String,
        required: true,
        trim: true
    },
    quantidade: {
        type: Number,
        required: true,
        min: 1
    },
    severidade: {
        type: String,
        required: true,
        enum: ['baixa', 'media', 'alta', 'critica']
    },
    registradoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    descricao: {
        type: String,
        default: '',
        trim: true
    },
    empresa: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmpresaConfig',
        required: true
    },
    ativo: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Índices para melhor performance
descarteSchema.index({ dataHora: -1 });
descarteSchema.index({ maquina: 1 });
descarteSchema.index({ categoria: 1 });
descarteSchema.index({ severidade: 1 });
descarteSchema.index({ empresa: 1 });
descarteSchema.index({ ativo: 1 });
// Composto por empresa e data para relatórios
descarteSchema.index({ empresa: 1, dataHora: -1 });

// Middleware para gerar código automático se não fornecido
descarteSchema.pre('save', function(next) {
    if (!this.isNew) return next();
    
    // Aqui você pode implementar lógica para gerar códigos automáticos
    // Por enquanto, vamos usar o ID do documento
    next();
});

module.exports = mongoose.model('Descarte', descarteSchema);
