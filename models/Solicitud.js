const mongoose = require('mongoose');

const solicitudAperturaSchema = new mongoose.Schema({
    nombreTienda: {
        type: String,
        required: [true, 'El nombre de la tienda es obligatorio'],
        trim: true
    },
    direccion: {
        type: String,
        required: [true, 'La dirección es obligatoria'],
        trim: true
    },
    justificacion: {
        type: String,
        required: [true, 'La justificación es obligatoria'],
        trim: true
    },
    estado: {
        type: String,
        enum: ['pendiente', 'aprobada', 'rechazada'],
        default: 'pendiente'
    },
    fechaCreacion: {
        type: Date,
        default: Date.now
    }
});

const SolicitudAperturaSchemaInfo = {
    modelName: 'SolicitudApertura',
    schema: solicitudAperturaSchema
};

module.exports = SolicitudAperturaSchemaInfo;