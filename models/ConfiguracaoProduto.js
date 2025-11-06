const mongoose = require('mongoose');

const configuracaoProdutoSchema = new mongoose.Schema({
    produto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Produto',
        required: [true, 'Produto é obrigatório'],
        unique: true // Cada produto só pode ter uma configuração
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
    temperatura: {
        type: Number,
        default: 0,
        comment: 'Temperatura em graus Celsius'
    },
    pressao: {
        type: Number,
        min: [0, 'Pressão não pode ser negativa'],
        default: 0,
        comment: 'Pressão em bar'
    },
    velocidade: {
        type: Number,
        min: [0, 'Velocidade não pode ser negativa'],
        default: 0,
        comment: 'Velocidade em rpm'
    },
    materiaisNecessarios: {
        type: String,
        trim: true,
        maxlength: [1000, 'Materiais necessários não podem exceder 1000 caracteres']
    },
    instrucoesFabricacao: {
        type: String,
        trim: true,
        maxlength: [1000, 'Instruções de fabricação não podem exceder 1000 caracteres']
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
configuracaoProdutoSchema.index({ produto: 1 });
configuracaoProdutoSchema.index({ empresa: 1 });
configuracaoProdutoSchema.index({ ativo: 1 });

// Middleware para popular dados do produto
configuracaoProdutoSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'produto',
        select: 'codigoProduto nomeProduto categoria descricao maquina',
        populate: {
            path: 'maquina',
            select: 'machineId configuracoes.nome configuracoes.status'
        }
    });
    next();
});

module.exports = mongoose.model('ConfiguracaoProduto', configuracaoProdutoSchema);
