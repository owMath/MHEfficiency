const mongoose = require('mongoose');

const vinculoProdutoMaquinaSchema = new mongoose.Schema({
    configuracaoProduto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ConfiguracaoProduto',
        required: [true, 'Configuração do produto é obrigatória']
    },
    produto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Produto',
        required: [true, 'Produto é obrigatório']
    },
    maquina: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
        required: [true, 'Máquina é obrigatória']
    },
    tempoCiclo: {
        type: Number,
        min: [0, 'Tempo de ciclo não pode ser negativo'],
        default: 0,
        comment: 'Tempo de ciclo em segundos'
    },
    tempoSetup: {
        type: Number,
        min: [0, 'Tempo de setup não pode ser negativo'],
        default: 0,
        comment: 'Tempo de setup em segundos'
    },
    producaoIdeal: {
        type: Number,
        min: [0, 'Produção ideal não pode ser negativa'],
        default: 0,
        comment: 'Produção ideal em unidades por hora'
    },
    observacoes: {
        type: String,
        trim: true,
        maxlength: [500, 'Observações não podem exceder 500 caracteres']
    },
    empresa: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ativo: {
        type: Boolean,
        default: true
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
vinculoProdutoMaquinaSchema.index({ produto: 1, maquina: 1 });
vinculoProdutoMaquinaSchema.index({ empresa: 1 });
vinculoProdutoMaquinaSchema.index({ ativo: 1 });
// Composto para filtros em tela
vinculoProdutoMaquinaSchema.index({ empresa: 1, ativo: 1 });

// Índice único para evitar vínculos duplicados
vinculoProdutoMaquinaSchema.index({ produto: 1, maquina: 1, empresa: 1 }, { unique: true });

// Middleware para popular dados relacionados
vinculoProdutoMaquinaSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'produto',
        select: 'codigoProduto nomeProduto categoria'
    }).populate({
        path: 'maquina',
        select: 'machineId nome status'
    }).populate({
        path: 'configuracaoProduto',
        select: 'tempoCiclo tempoSetup producaoIdeal'
    });
    next();
});

module.exports = mongoose.model('VinculoProdutoMaquina', vinculoProdutoMaquinaSchema);
