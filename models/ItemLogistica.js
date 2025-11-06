const mongoose = require('mongoose');

const itemLogisticaSchema = new mongoose.Schema({
    codigo: {
        type: String,
        required: [true, 'Código do item é obrigatório'],
        trim: true,
        uppercase: true,
        maxlength: [50, 'Código não pode exceder 50 caracteres']
    },
    nome: {
        type: String,
        required: [true, 'Nome do item é obrigatório'],
        trim: true,
        maxlength: [100, 'Nome não pode exceder 100 caracteres']
    },
    categoria: {
        type: String,
        trim: true,
        maxlength: [50, 'Categoria não pode exceder 50 caracteres']
    },
    quantidadeAtual: {
        type: Number,
        required: [true, 'Quantidade atual é obrigatória'],
        min: [0, 'Quantidade não pode ser negativa'],
        default: 0
    },
    quantidadeMinima: {
        type: Number,
        required: [true, 'Quantidade mínima é obrigatória'],
        min: [0, 'Quantidade mínima não pode ser negativa'],
        default: 0
    },
    quantidadeMaxima: {
        type: Number,
        min: [0, 'Quantidade máxima não pode ser negativa'],
        default: null
    },
    unidadeMedida: {
        type: String,
        trim: true,
        maxlength: [20, 'Unidade de medida não pode exceder 20 caracteres'],
        default: 'unidade'
    },
    localizacao: {
        type: String,
        trim: true,
        maxlength: [100, 'Localização não pode exceder 100 caracteres']
    },
    fornecedor: {
        type: String,
        trim: true,
        maxlength: [100, 'Fornecedor não pode exceder 100 caracteres']
    },
    custoUnitario: {
        type: Number,
        min: [0, 'Custo unitário não pode ser negativo'],
        default: 0
    },
    precoVenda: {
        type: Number,
        min: [0, 'Preço de venda não pode ser negativo'],
        default: null
    },
    dataUltimaCompra: {
        type: Date,
        default: null
    },
    dataValidade: {
        type: Date,
        default: null
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
    status: {
        type: String,
        enum: ['ativo', 'inativo', 'esgotado', 'vencido'],
        default: 'ativo'
    },
    precisaAtencao: {
        type: Boolean,
        default: false
    },
    motivoAtencao: {
        type: String,
        enum: ['estoque_baixo', 'estoque_alto', 'vencimento_proximo', 'sem_movimentacao', null],
        default: null
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
itemLogisticaSchema.index({ codigo: 1, empresa: 1 });
itemLogisticaSchema.index({ empresa: 1 });
itemLogisticaSchema.index({ status: 1 });
itemLogisticaSchema.index({ precisaAtencao: 1 });
itemLogisticaSchema.index({ 'dataValidade': 1 });
// Composto por empresa, status e flag de atenção para dashboards
itemLogisticaSchema.index({ empresa: 1, status: 1, precisaAtencao: 1 });

// Middleware para atualizar precisaAtencao antes de salvar
itemLogisticaSchema.pre('save', function(next) {
    const quantidadeAtual = this.quantidadeAtual || 0;
    const quantidadeMinima = this.quantidadeMinima || 0;
    const quantidadeMaxima = this.quantidadeMaxima;
    
    // Resetar flags
    this.precisaAtencao = false;
    this.motivoAtencao = null;
    
    // Verificar se precisa de atenção baseado na quantidade
    if (quantidadeAtual < 0) {
        this.precisaAtencao = true;
        this.motivoAtencao = 'estoque_baixo';
        this.status = 'esgotado';
    } else if (quantidadeAtual <= quantidadeMinima) {
        this.precisaAtencao = true;
        this.motivoAtencao = 'estoque_baixo';
        if (this.status === 'ativo') {
            this.status = 'ativo'; // Manter ativo mesmo com estoque baixo
        }
    } else if (quantidadeMaxima && quantidadeAtual >= quantidadeMaxima) {
        this.precisaAtencao = true;
        this.motivoAtencao = 'estoque_alto';
    }
    
    // Verificar validade (se expirou)
    if (this.dataValidade && new Date(this.dataValidade) < new Date()) {
        this.status = 'vencido';
        this.precisaAtencao = true;
        if (!this.motivoAtencao) {
            this.motivoAtencao = 'vencimento_proximo';
        }
    }
    
    next();
});

// Replicar a lógica também para updates via findOneAndUpdate
itemLogisticaSchema.pre('findOneAndUpdate', async function(next) {
    try {
        const update = this.getUpdate() || {};
        const $set = update.$set || (update.$set = {});

        // Buscar documento atual para basear cálculo
        const current = await this.model.findOne(this.getQuery());
        if (!current) return next();

        const getField = (field) => {
            if (field in update) return update[field];
            if (field in $set) return $set[field];
            return current[field];
        };

        const quantidadeAtual = getField('quantidadeAtual') || 0;
        const quantidadeMinima = getField('quantidadeMinima') || 0;
        const quantidadeMaxima = getField('quantidadeMaxima');
        const dataValidade = getField('dataValidade');

        let precisaAtencao = false;
        let motivoAtencao = null;
        let status = getField('status') || current.status || 'ativo';

        if (quantidadeAtual < 0) {
            precisaAtencao = true;
            motivoAtencao = 'estoque_baixo';
            status = 'esgotado';
        } else if (quantidadeAtual <= quantidadeMinima) {
            precisaAtencao = true;
            motivoAtencao = 'estoque_baixo';
            if (status === 'ativo') {
                status = 'ativo';
            }
        } else if (quantidadeMaxima && quantidadeAtual >= quantidadeMaxima) {
            precisaAtencao = true;
            motivoAtencao = 'estoque_alto';
        }

        if (dataValidade && new Date(dataValidade) < new Date()) {
            status = 'vencido';
            precisaAtencao = true;
            if (!motivoAtencao) {
                motivoAtencao = 'vencimento_proximo';
            }
        }

        $set.precisaAtencao = precisaAtencao;
        $set.motivoAtencao = motivoAtencao;
        $set.status = status;

        this.setUpdate(update);
        this.setOptions({ runValidators: true });
        next();
    } catch (err) {
        next(err);
    }
});

// Schema para solicitações de compra
const solicitacaoCompraSchema = new mongoose.Schema({
    itemLogistica: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemLogistica',
        required: true
    },
    quantidade: {
        type: Number,
        required: [true, 'Quantidade é obrigatória'],
        min: [1, 'Quantidade deve ser maior que zero']
    },
    prioridade: {
        type: String,
        enum: ['baixa', 'media', 'alta', 'urgente'],
        default: 'media'
    },
    motivo: {
        type: String,
        trim: true,
        maxlength: [500, 'Motivo não pode exceder 500 caracteres']
    },
    status: {
        type: String,
        enum: ['pendente', 'aprovada', 'em_compra', 'recebida', 'cancelada'],
        default: 'pendente'
    },
    dataSolicitacao: {
        type: Date,
        default: Date.now
    },
    dataPrevisaoEntrega: {
        type: Date,
        default: null
    },
    dataRecebimento: {
        type: Date,
        default: null
    },
    solicitante: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    empresa: {
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

// Índices
solicitacaoCompraSchema.index({ empresa: 1 });
solicitacaoCompraSchema.index({ status: 1 });
solicitacaoCompraSchema.index({ dataSolicitacao: -1 });

const ItemLogistica = mongoose.model('ItemLogistica', itemLogisticaSchema);
const SolicitacaoCompra = mongoose.model('SolicitacaoCompra', solicitacaoCompraSchema);

module.exports = { ItemLogistica, SolicitacaoCompra };

