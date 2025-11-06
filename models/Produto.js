const mongoose = require('mongoose');

const produtoSchema = new mongoose.Schema({
    codigoProduto: {
        type: String,
        unique: true,
        trim: true,
        uppercase: true
    },
    nomeProduto: {
        type: String,
        required: [true, 'Nome do produto é obrigatório'],
        trim: true,
        maxlength: [100, 'Nome do produto não pode exceder 100 caracteres']
    },
    categoria: {
        type: String,
        trim: true,
        maxlength: [50, 'Categoria não pode exceder 50 caracteres']
    },
    maquina: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
        required: [true, 'Máquina é obrigatória']
    },
    unidadeMedida: {
        type: String,
        trim: true,
        maxlength: [20, 'Unidade de medida não pode exceder 20 caracteres']
    },
    peso: {
        type: Number,
        min: [0, 'Peso não pode ser negativo'],
        default: 0
    },
    dimensoes: {
        type: String,
        trim: true,
        maxlength: [50, 'Dimensões não podem exceder 50 caracteres']
    },
    cor: {
        type: String,
        trim: true,
        maxlength: [30, 'Cor não pode exceder 30 caracteres']
    },
    materialPrincipal: {
        type: String,
        trim: true,
        maxlength: [50, 'Material principal não pode exceder 50 caracteres']
    },
    fornecedor: {
        type: String,
        trim: true,
        maxlength: [100, 'Fornecedor não pode exceder 100 caracteres']
    },
    precoUnitario: {
        type: Number,
        min: [0, 'Preço unitário não pode ser negativo'],
        default: 0
    },
    estoqueMinimo: {
        type: Number,
        min: [0, 'Estoque mínimo não pode ser negativo'],
        default: 0
    },
    descricao: {
        type: String,
        trim: true,
        maxlength: [500, 'Descrição não pode exceder 500 caracteres']
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
produtoSchema.index({ codigoProduto: 1 });
produtoSchema.index({ empresa: 1 });
produtoSchema.index({ maquina: 1 });
produtoSchema.index({ categoria: 1 });
produtoSchema.index({ ativo: 1 });
// Composto por empresa e criação para listagens
produtoSchema.index({ empresa: 1, createdAt: -1 });

// Middleware para gerar código do produto automaticamente
produtoSchema.pre('save', async function(next) {
    if (this.isNew) {
        try {
            // Se não tem código ou está vazio, gerar um novo
            if (!this.codigoProduto || this.codigoProduto.trim() === '') {
                const count = await this.constructor.countDocuments({ empresa: this.empresa });
                this.codigoProduto = `PROD${String(count + 1).padStart(3, '0')}`;
            }
            // Validação soft de duplicidade por empresa (sem índice único ainda)
            if (this.codigoProduto && this.empresa) {
                const exists = await this.constructor.findOne({
                    _id: { $ne: this._id },
                    empresa: this.empresa,
                    codigoProduto: this.codigoProduto
                }).lean();
                if (exists) {
                    return next(new Error('Já existe um produto com este código para a empresa.'));
                }
            }
        } catch (error) {
            next(error);
        }
    }
    next();
});

module.exports = mongoose.model('Produto', produtoSchema);
