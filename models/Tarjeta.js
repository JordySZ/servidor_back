// backend-usuarios/models/Tarjeta.js
const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  titulo: { type: String, default: '' },
  miembro: {
    type: String,
    enum: ['DSI', 'Infraestructura', 'Contabilidad', 'Operaciones', 'Redes', 'Trade', 'DragonTaill'],
    default: ''
  },
  fechaInicio: { type: Date, default: null },
  fechaVencimiento: { type: Date, default: null },
  estado: {
    type: String,
    enum: ['hecho', 'enProceso', 'porHacer'],
    default: 'porHacer',
  },
  // *** NUEVOS CAMPOS AÑADIDOS ***
  fechaCompletado: { type: Date, default: null }, // Para registrar el momento exacto en que se marcó como 'hecho'
  mensajeTiempoCompletado: { type: String, default: null }, // Para guardar el mensaje calculado
  // ******************************
}, { timestamps: true });

module.exports = Card = mongoose.model('Cards', cardSchema);