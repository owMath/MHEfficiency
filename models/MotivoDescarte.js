const mongoose = require('mongoose');

const motivoDescarteSchema = new mongoose.Schema({
    codigo: {
        type: String,
        required: false, // Tornar opcional - será gerado automaticamente
        trim: true,
        uppercase: true,
        unique: true,
        minlength: [3, 'Código deve ter pelo menos 3 caracteres'],
        maxlength: [20, 'Código não pode exceder 20 caracteres']
    },
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
        trim: true,
        minlength: [2, 'Classe deve ter pelo menos 2 caracteres'],
        maxlength: [50, 'Classe não pode exceder 50 caracteres']
    },
    descricao: {
        type: String,
        required: false, // Tornar opcional
        trim: true,
        maxlength: [500, 'Descrição não pode exceder 500 caracteres'],
        default: '' // Valor padrão vazio
    },
    gravidade: {
        type: String,
        required: [true, 'Gravidade é obrigatória'],
        enum: ['baixa', 'media', 'alta', 'critica'],
        lowercase: true,
        default: 'baixa'
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
        default: '#ef4444',
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
motivoDescarteSchema.index({ ativo: 1 });
motivoDescarteSchema.index({ classe: 1 });
motivoDescarteSchema.index({ gravidade: 1 });
// codigo já tem índice único automático devido ao unique: true
motivoDescarteSchema.index({ nome: 1 });

// Middleware para gerar código automático se não fornecido
motivoDescarteSchema.pre('save', async function(next) {
    if (!this.codigo) {
        // Gerar código automático baseado no nome
        const baseCode = this.nome.substring(0, 3).toUpperCase();
        let counter = 1;
        let newCode = `${baseCode}${counter.toString().padStart(2, '0')}`;
        
        // Verificar se código já existe
        while (await this.constructor.findOne({ codigo: newCode })) {
            counter++;
            newCode = `${baseCode}${counter.toString().padStart(2, '0')}`;
        }
        
        this.codigo = newCode;
    }
    next();
});

module.exports = mongoose.model('MotivoDescarte', motivoDescarteSchema);
