const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: {
        type: String, // chave: `${empresaId}:${ano}` ou variante
        required: true
    },
    seq: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    updatedAt: {
        type: Date,
        default: Date.now
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

module.exports = mongoose.model('Counter', counterSchema);


