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
    },
    archivo: {  // Nuevo campo para el archivo
        data: Buffer,        // Almacena el contenido del archivo
        contentType: String, // Tipo MIME (ej: 'application/pdf')
        nombreOriginal: String // Nombre original del archivo (opcional)
    }
});

const SolicitudAperturaSchemaInfo = {
    modelName: 'SolicitudApertura',
    schema: solicitudAperturaSchema
};

module.exports = SolicitudAperturaSchemaInfo;