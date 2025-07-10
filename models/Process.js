// backend/models/Process.js
const mongoose = require('mongoose');

const processSchema = new mongoose.Schema({
  nombre_proceso: {
    type: String,
    required: [true, 'El nombre del proceso es obligatorio.'],
    unique: true, // Asegura que no haya procesos con el mismo nombre
    trim: true // Elimina espacios en blanco al inicio y final
  },
  fecha_inicio: {
    type: Date,
    required: [true, 'La fecha de inicio es obligatoria.']
  },
  fecha_fin: {
    type: Date,
    required: [true, 'La fecha de fin es obligatoria.']
  },
  // Campos adicionales que podrías querer añadir en el futuro
  
  createdAt: {
    type: Date,
    default: Date.now // Fecha de creación automática
  },
  updatedAt: {
    type: Date,
    default: Date.now // Fecha de última actualización (se actualiza en pre-save hook)
  }
});

// Middleware para actualizar 'updatedAt' antes de cada save
processSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Exporta el modelo, especificando el nombre de la colección real
// La colección se llamará 'procesos_metadata' en tu base de datos
module.exports = mongoose.model('Process', processSchema, 'procesos_metadata');