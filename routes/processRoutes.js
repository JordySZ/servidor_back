// backend/routes/processRoutes.js
const express = require('express');
const router = express.Router();
const Process = require('../models/Process'); // Importa el modelo de Proceso
const mongoose = require('mongoose'); // Agrega esta línea para acceder a mongoose y la conexión a la DB

// --- ENDPOINT: CREAR UN NUEVO PROCESO CON FECHAS Y ESTADO ---
// POST /api/procesos
router.post('/procesos', async (req, res) => {
  // Ahora también esperamos el campo 'estado' en el cuerpo de la solicitud
  const { nombre, fechaInicio, fechaFin, estado } = req.body;

  if (!nombre || !fechaInicio || !fechaFin) { // 'estado' tiene un valor por defecto, así que no es estrictamente necesario validarlo aquí si el default es suficiente
    return res.status(400).json({ message: 'Faltan campos requeridos: nombre, fechaInicio, fechaFin.' });
  }

  // Opcional: Si quieres validar el 'estado' explícitamente y que no sea solo el default
  const estadosPermitidos = ['echo', 'en proceso', 'pendiente'];
  if (estado && !estadosPermitidos.includes(estado)) {
    return res.status(400).json({ message: `El estado proporcionado no es válido. Los valores permitidos son: ${estadosPermitidos.join(', ')}.` });
  }

  try {
    // 1. Verificar si ya existe un proceso con ese nombre
    const existingProcess = await Process.findOne({ name: nombre });
    if (existingProcess) {
      return res.status(409).json({
        message: 'Ya existe un proceso con este nombre.',
        nombreColeccion: `${nombre}_lists`,
        procesoExistente: existingProcess
      });
    }

    // 2. Crear un nuevo documento en la colección 'procesos_metadata'
    const newProcess = new Process({
      nombre_proceso: nombre,
      fecha_inicio: new Date(fechaInicio),
      fecha_fin: new Date(fechaFin),
      estado: estado || 'pendiente', // Asigna el estado recibido o 'pendiente' por defecto
    });
    await newProcess.save();

    console.log(`[BACKEND] Proceso '${nombre}' y metadatos guardados.`);
    const collectionNameForLists = `${nombre}_lists`;

    res.status(201).json({
      message: 'Proceso creado exitosamente',
      nombreColeccion: collectionNameForLists,
      proceso: newProcess
    });

  } catch (err) {
    console.error('[BACKEND ERROR] Error al crear proceso:', err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(el => el.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    res.status(500).json({ message: 'Error interno del servidor al crear el proceso.' });
  }
});

// --- ENDPOINT: OBTENER TODOS LOS PROCESOS (CON FECHAS Y ESTADO) ---
// GET /api/procesos
router.get('/procesos', async (req, res) => {
  try {
    // Ahora también selecciona el campo 'estado'
    const allProcesses = await Process.find({}, 'nombre_proceso fecha_inicio fecha_fin descripcion estado').lean();

    const formattedProcesses = allProcesses.map(p => ({
      id: p._id,
      name: p.nombre_proceso,
      startDate: p.fecha_inicio.toISOString(),
      endDate: p.fecha_fin.toISOString(),
      description: p.descripcion,
      estado: p.estado // Incluye el nuevo campo estado
    }));

    console.log(`[BACKEND] Se solicitaron todos los procesos. Encontrados: ${formattedProcesses.length}`);
    res.status(200).json(formattedProcesses);

  } catch (err) {
    console.error('[BACKEND ERROR] Error al obtener procesos:', err);
    res.status(500).json({ message: 'Error interno del servidor al obtener procesos.' });
  }
});

// --- ENDPOINT: ELIMINAR UN PROCESO (metadatos y sus colecciones asociadas) ---
// DELETE /api/procesos/:processName
router.delete('/procesos/:processName', async (req, res) => {
  const { processName } = req.params;

  try {
    // 1. Encontrar y eliminar el documento de metadatos del proceso
    const deletedProcess = await Process.findOneAndDelete({ nombre_proceso: processName });

    if (!deletedProcess) {
      return res.status(404).json({ message: 'Proceso no encontrado.' });
    }

    console.log(`[BACKEND] Metadatos del proceso '${processName}' eliminados.`);

    // 2. Eliminar la colección de listas y tarjetas asociada a este proceso
    const db = mongoose.connection.db; // Accede a la base de datos nativa de MongoDB
    const listsCollectionName = `${processName}_lists`;
    const cardsCollectionName = `${processName}_cards`; // Si tienes una colección de tarjetas separada por proceso

    // Intenta eliminar la colección de listas
    const listDropResult = await db.collection(listsCollectionName).drop()
      .then(result => `Colección '${listsCollectionName}' eliminada.`)
      .catch(err => {
        if (err.codeName === 'NamespaceNotFound') {
          return `Colección '${listsCollectionName}' no encontrada (ya eliminada o no existía).`;
        }
        throw err;
      });
    console.log(`[BACKEND] ${listDropResult}`);

    // Si tienes colecciones de tarjetas nombradas por proceso, también eliminarlas:
    const cardDropResult = await db.collection(cardsCollectionName).drop()
      .then(result => `Colección '${cardsCollectionName}' eliminada.`)
      .catch(err => {
        if (err.codeName === 'NamespaceNotFound') {
          return `Colección '${cardsCollectionName}' no encontrada (ya eliminada o no existía).`;
        }
        throw err;
      });
    console.log(`[BACKEND] ${cardDropResult}`);

    res.status(200).json({
      message: `Proceso '${processName}' y sus datos asociados eliminados exitosamente.`,
      deletedProcess: deletedProcess
    });

  } catch (err) {
    console.error('[BACKEND ERROR] Error al eliminar proceso:', err);
    res.status(500).json({ message: 'Error interno del servidor al eliminar el proceso.' });
  }
});

// --- ENDPOINT: ACTUALIZAR UN PROCESO (INCLUYENDO EL ESTADO) ---
// PUT /api/procesos/:processName
// PUT /api/procesos/:processName
router.put('/procesos/:oldName', async (req, res) => {
  const { oldName } = req.params;
  const { nombre: newName, fechaInicio, fechaFin, estado } = req.body;
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // 1. Validaciones
    if (!newName && !fechaInicio && !fechaFin && !estado) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No hay campos para actualizar.' });
    }

    const estadosPermitidos = ['echo', 'en proceso', 'pendiente'];
    if (estado && !estadosPermitidos.includes(estado)) {
      await session.abortTransaction();
      return res.status(400).json({ 
        message: `Estado inválido. Valores permitidos: ${estadosPermitidos.join(', ')}` 
      });
    }

    // 2. Preparar datos de actualización
    const updateData = { updatedAt: Date.now() };
    if (newName) updateData.nombre_proceso = newName;
    if (fechaInicio) updateData.fecha_inicio = new Date(fechaInicio);
    if (fechaFin) updateData.fecha_fin = new Date(fechaFin);
    if (estado) updateData.estado = estado;

    // 3. Actualizar metadatos
    const updatedProcess = await Process.findOneAndUpdate(
      { nombre_proceso: oldName },
      { $set: updateData },
      { new: true, runValidators: true, session }
    );

    if (!updatedProcess) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Proceso no encontrado.' });
    }

    // 4. Renombrar colecciones si el nombre cambió
    if (newName && newName !== oldName) {
      const renameResults = await Process.renameProcessCollections(
        oldName,
        newName,
        mongoose.connection.db
      );
      
      console.log('Resultados del renombrado:', renameResults);
    }

    await session.commitTransaction();
    
    res.status(200).json({
      message: 'Proceso actualizado exitosamente',
      proceso: updatedProcess
    });

  } catch (err) {
    await session.abortTransaction();
    console.error('[BACKEND ERROR] Error al actualizar proceso:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(el => el.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    
    res.status(500).json({ 
      message: 'Error interno al actualizar el proceso.',
      error: err.message 
    });
  } finally {
    session.endSession();
  }
});
module.exports = router;