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
  estado: {
    type: String,
    enum: ['echo', 'en proceso', 'pendiente'],
    default: 'pendiente',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para actualizar la fecha de modificación
processSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método mejorado para renombrar colecciones asociadas
processSchema.statics.renameAssociatedCollections = async function(oldName, newName, dbConnection) {
  const collectionsToCheck = [
    `${oldName}_lists`,
    `${oldName}_cards`,  // Añadido para colección de tarjetas
    `${oldName}_graficas`,
    oldName // Colección principal si existe
  ];
  
  // Verificar qué colecciones existen realmente
  const existingCollections = [];
  for (const coll of collectionsToCheck) {
    try {
      const collInfo = await dbConnection.listCollections({ name: coll }).next();
      if (collInfo) {
        existingCollections.push(coll);
      }
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound') {
        throw err;
      }
    }
  }
  
  const results = [];
  
  // Renombrar solo las colecciones que existen
  for (const oldColl of existingCollections) {
    try {
      const newColl = oldColl.replace(oldName, newName);
      await dbConnection.renameCollection(oldColl, newColl);
      results.push({
        success: true,
        message: `Colección renombrada: ${oldColl} → ${newColl}`,
        oldCollection: oldColl,
        newCollection: newColl
      });
    } catch (err) {
      results.push({
        success: false,
        message: `Error al renombrar ${oldColl}: ${err.message}`,
        error: err
      });
    }
  }
  
  return results;
};

// Método para verificar colecciones asociadas
processSchema.statics.checkAssociatedCollections = async function(processName, dbConnection) {
  const collectionsToCheck = [
    `${processName}_lists`,
    `${processName}_cards`,
    `${processName}_graficas`,
    processName
  ];

  const results = {};
  
  for (const coll of collectionsToCheck) {
    try {
      const exists = await dbConnection.listCollections({ name: coll }).next();
      results[coll] = !!exists;
    } catch (err) {
      results[coll] = false;
    }
  }
  
  return results;
};

module.exports = mongoose.model('Process', processSchema, 'procesos_metadata');