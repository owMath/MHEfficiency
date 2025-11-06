const mongoose = require('mongoose');

const turnoSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'Nome do turno é obrigatório'],
        trim: true,
        minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
        maxlength: [100, 'Nome não pode exceder 100 caracteres']
    },
    horarioInicio: {
        type: String,
        required: [true, 'Horário de início é obrigatório'],
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário de início inválido (formato: HH:MM)']
    },
    horarioFim: {
        type: String,
        required: [true, 'Horário de fim é obrigatório'],
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário de fim inválido (formato: HH:MM)']
    },
    duracaoHoras: {
        type: Number,
        min: [0, 'Duração não pode ser negativa'],
        max: [24, 'Duração não pode ser maior que 24 horas']
    },
    diasSemana: {
        type: [Number],
        required: [true, 'Dias da semana são obrigatórios'],
        validate: {
            validator: function(v) {
                return v.length > 0 && v.every(day => day >= 0 && day <= 6);
            },
            message: 'Dias da semana devem ser números de 0 (domingo) a 6 (sábado)'
        }
    },
    empresa: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['ativo', 'inativo'],
        default: 'ativo'
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

// Calcular duração antes de salvar
turnoSchema.pre('save', function(next) {
    if (this.horarioInicio && this.horarioFim) {
        const [inicioH, inicioM] = this.horarioInicio.split(':').map(Number);
        const [fimH, fimM] = this.horarioFim.split(':').map(Number);
        
        let inicioMinutos = inicioH * 60 + inicioM;
        let fimMinutos = fimH * 60 + fimM;
        
        // Se o fim é menor que o início, assume que vai para o próximo dia
        if (fimMinutos < inicioMinutos) {
            fimMinutos += 24 * 60;
        }
        
        const horas = (fimMinutos - inicioMinutos) / 60;
        // Armazena como Number com 2 casas (ex.: 8.50)
        this.duracaoHoras = Math.round(horas * 100) / 100;
    }
    next();
});

// Recalcular duração também em updates via findOneAndUpdate
turnoSchema.pre('findOneAndUpdate', function(next) {
    try {
        const update = this.getUpdate() || {};
        const $set = update.$set || (update.$set = {});

        // Se algum horário foi alterado, recalcula
        const inicio = $set.horarioInicio ?? update.horarioInicio;
        const fim = $set.horarioFim ?? update.horarioFim;

        if (inicio || fim) {
            // Precisamos dos valores finais considerados no update
            const resolveField = (field, current) => {
                if (field in $set) return $set[field];
                if (field in update) return update[field];
                return current;
            };

            // Buscar documento atual para obter valores não alterados
            this.model.findOne(this.getQuery()).then(doc => {
                if (!doc) return next();
                const horarioInicio = resolveField('horarioInicio', doc.horarioInicio);
                const horarioFim = resolveField('horarioFim', doc.horarioFim);

                if (horarioInicio && horarioFim) {
                    const [inicioH, inicioM] = String(horarioInicio).split(':').map(Number);
                    const [fimH, fimM] = String(horarioFim).split(':').map(Number);
                    let inicioMin = inicioH * 60 + inicioM;
                    let fimMin = fimH * 60 + fimM;
                    if (fimMin < inicioMin) fimMin += 24 * 60;
                    const horas = (fimMin - inicioMin) / 60;
                    $set.duracaoHoras = Math.round(horas * 100) / 100;
                    this.setUpdate(update);
                }
                next();
            }).catch(err => next(err));
            return; // evitar cair no next() abaixo antes do async
        }
        this.setUpdate(update);
        next();
    } catch (err) {
        next(err);
    }
});

// Índices para performance
turnoSchema.index({ empresa: 1, status: 1 });
turnoSchema.index({ nome: 1 });
turnoSchema.index({ empresa: 1 });

module.exports = mongoose.model('Turno', turnoSchema);

