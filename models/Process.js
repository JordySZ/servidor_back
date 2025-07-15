const mongoose = require('mongoose');

const processSchema = new mongoose.Schema({
nombre_proceso: {
    type: String,
    required: [true, 'El nombre del proceso es obligatorio.'],
    unique: true,
    trim: true
  },
  fecha_inicio: {
    type: Date,
    required: [true, 'La fecha de inicio es obligatoria.']
  },
  fecha_fin: {
    type: Date,
    required: [true, 'La fecha de fin es obligatoria.']
  },
  // --- NUEVO CAMPO: ESTADO ---
  estado: {
    type: String,
    enum: ['echo', 'en proceso', 'pendiente'], // Define los valores permitidos
    default: 'pendiente', // Establece 'pendiente' como valor por defecto
    required: [true, 'El estado del proceso es obligatorio.'] // Aunque tenga default, es buena práctica mantenerlo requerido.
  },
  // -------------------------

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

processSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Process', processSchema, 'procesos_metadata');