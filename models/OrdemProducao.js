const mongoose = require('mongoose');

const ordemProducaoSchema = new mongoose.Schema({
    numeroOrdem: {
        type: String,
        required: false,
        unique: true,
        trim: true,
        sparse: true
    },
    produto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Produto',
        required: [true, 'Produto é obrigatório']
    },
    vinculoProdutoMaquina: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VinculoProdutoMaquina',
        required: [true, 'Vínculo produto-máquina é obrigatório']
    },
    maquina: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
        required: [true, 'Máquina é obrigatória']
    },
    quantidade: {
        type: Number,
        required: [true, 'Quantidade é obrigatória'],
        min: [1, 'Quantidade deve ser maior que zero']
    },
    quantidadeProduzida: {
        type: Number,
        default: 0,
        min: [0, 'Quantidade produzida não pode ser negativa']
    },
    dataFim: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['em-producao', 'finalizada', 'cancelada'],
        default: 'em-producao'
    },
    observacoes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Observações não podem exceder 1000 caracteres']
    },
    empresa: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    criadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
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
ordemProducaoSchema.index({ empresa: 1 });
ordemProducaoSchema.index({ maquina: 1 });
ordemProducaoSchema.index({ status: 1 });
ordemProducaoSchema.index({ createdAt: -1 });
ordemProducaoSchema.index({ numeroOrdem: 1 });
// Índice composto para consultas frequentes em relatórios
ordemProducaoSchema.index({ empresa: 1, maquina: 1, status: 1, createdAt: -1 });

// Middleware para popular dados relacionados apenas em queries find
ordemProducaoSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function(next) {
    this.populate({
        path: 'produto',
        select: 'codigoProduto nomeProduto categoria'
    }).populate({
        path: 'maquina',
        select: 'machineId nome status'
    }).populate({
        path: 'vinculoProdutoMaquina',
        select: '_id tempoCiclo tempoSetup producaoIdeal'
    });
    next();
});

// Middleware para gerar número da ordem automaticamente
// Usa 'validate' em vez de 'save' para garantir que roda antes da validação
ordemProducaoSchema.pre('validate', async function(next) {
    // Só gerar se for novo documento e não tiver numeroOrdem
    if (this.isNew && !this.numeroOrdem) {
        const ano = new Date().getFullYear();
        try {
            // Tentar gerar via contador atômico por empresa/ano
            const mongoose = require('mongoose');
            let Counter;
            try {
                Counter = mongoose.model('Counter');
            } catch (e) {
                Counter = require('./Counter');
            }

            if (!this.empresa) {
                throw new Error('Empresa não definida para geração de numeroOrdem');
            }
            const key = `${this.empresa.toString()}:${ano}`;

            const result = await Counter.findOneAndUpdate(
                { _id: key },
                { $inc: { seq: 1 }, $set: { updatedAt: new Date() } },
                { upsert: true, returnDocument: 'after' }
            );

            const seq = result?.seq || 1;
            this.numeroOrdem = `OP${ano}${String(seq).padStart(4, '0')}`;
            return next();
        } catch (error) {
            console.warn('Counter indisponível; usando fallback por contagem. Motivo:', error.message);
            try {
                // Fallback: contagem existente
                const OrdemProducaoModel = this.constructor;
                const count = await OrdemProducaoModel.countDocuments({ numeroOrdem: { $regex: `^OP${ano}` } });
                this.numeroOrdem = `OP${ano}${String(count + 1).padStart(4, '0')}`;
                return next();
            } catch (err) {
                console.error('Erro no fallback de numeroOrdem:', err);
                const timestamp = Date.now();
                this.numeroOrdem = `OP${ano}${timestamp.toString().slice(-4)}`;
                return next();
            }
        }
    }
    next();
});

module.exports = mongoose.model('OrdemProducao', ordemProducaoSchema);

