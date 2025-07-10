// backend/routes/processRoutes.js
const express = require('express');
const router = express.Router();
const Process = require('../models/Process'); // Importa el modelo de Proceso

// --- ENDPOINT: CREAR UN NUEVO PROCESO CON FECHAS ---
// POST /api/procesos
router.post('/procesos', async (req, res) => {
  const { nombre, fechaInicio, fechaFin } = req.body;

  if (!nombre || !fechaInicio || !fechaFin) {
    return res.status(400).json({ message: 'Faltan campos requeridos: nombre, fechaInicio, fechaFin.' });
  }

  try {
    // 1. Verificar si ya existe un proceso con ese nombre
    const existingProcess = await Process.findOne({ nombre_proceso: nombre });
    if (existingProcess) {
      return res.status(409).json({
        message: 'Ya existe un proceso con este nombre.',
        nombreColeccion: `${nombre}_lists`, // Devuelve el nombre de la colección de listas asociada
        procesoExistente: existingProcess
      });
    }

    // 2. Crear un nuevo documento en la colección 'procesos_metadata'
    const newProcess = new Process({
      nombre_proceso: nombre,
      fecha_inicio: new Date(fechaInicio), // Asegúrate de que las fechas lleguen en un formato parseable (ej. ISO string)
      fecha_fin: new Date(fechaFin),
    });
    await newProcess.save();

    // 3. (Opcional) Si tu lógica actual requiere explícitamente crear una colección vacía
    // MongoDB crea colecciones dinámicamente al insertar el primer documento,
    // por lo que usualmente no es necesario llamar a db.createCollection() aquí.
    // La clave aquí es que el nombre de la colección de listas siga el patrón `${nombre}_lists`.

    console.log(`[BACKEND] Proceso '${nombre}' y metadatos guardados.`);
    const collectionNameForLists = `${nombre}_lists`;

    res.status(201).json({
      message: 'Proceso creado exitosamente',
      nombreColeccion: collectionNameForLists, // Nombre de la colección de listas asociada
      proceso: newProcess // Devuelve el documento completo del proceso creado
    });

  } catch (err) {
    console.error('[BACKEND ERROR] Error al crear proceso:', err);
    // Manejo de errores de validación de Mongoose
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(el => el.message);
        return res.status(400).json({ message: errors.join(', ') });
    }
    res.status(500).json({ message: 'Error interno del servidor al crear el proceso.' });
  }
});

// --- ENDPOINT: OBTENER TODOS LOS PROCESOS (CON FECHAS) ---
// GET /api/procesos
router.get('/procesos', async (req, res) => {
  try {
    // Busca todos los procesos y selecciona solo los campos necesarios
    const allProcesses = await Process.find({}, 'nombre_proceso fecha_inicio fecha_fin descripcion').lean();

    // Puedes formatear la respuesta si lo deseas, o enviar los documentos tal cual
    const formattedProcesses = allProcesses.map(p => ({
      id: p._id, // Incluir el ID si es necesario para el frontend
      name: p.nombre_proceso,
      startDate: p.fecha_inicio.toISOString(), // Formatear a ISO string para Flutter
      endDate: p.fecha_fin.toISOString(),       // Formatear a ISO string para Flutter
      description: p.descripcion
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
    // ATENCIÓN: Esta parte es CRÍTICA y DESTRUCTIVA. Asegúrate de entender lo que haces.
    // Se asume que la colección de listas se llama `${processName}_lists`
    // Y que las tarjetas están dentro de esa colección de listas (o una subcolección)
    const db = mongoose.connection.db; // Accede a la base de datos nativa de MongoDB
    const listsCollectionName = `${processName}_lists`; // Nombre de la colección de listas
    const cardsCollectionName = `${processName}_cards`; // Si tienes una colección de tarjetas separada por proceso, ej. para getCards

    // Intenta eliminar la colección de listas
    const listDropResult = await db.collection(listsCollectionName).drop()
        .then(result => `Colección '${listsCollectionName}' eliminada.`)
        .catch(err => {
            if (err.codeName === 'NamespaceNotFound') {
                return `Colección '${listsCollectionName}' no encontrada (ya eliminada o no existía).`;
            }
            throw err; // Re-lanza otros errores
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


// --- ENDPOINT: ACTUALIZAR UN PROCESO ---
// PUT /api/procesos/:processName
router.put('/procesos/:processName', async (req, res) => {
  const { processName } = req.params;
  const { nombre, fechaInicio, fechaFin, descripcion } = req.body; // Puedes actualizar el nombre si quieres, pero es complicado si es clave de colección

  if (!nombre && !fechaInicio && !fechaFin && !descripcion) {
      return res.status(400).json({ message: 'No hay campos para actualizar.' });
  }

  try {
      const updateData = {};
      if (nombre) updateData.nombre_proceso = nombre; // Cuidado con cambiar el nombre si está ligado a otras colecciones
      if (fechaInicio) updateData.fecha_inicio = new Date(fechaInicio);
      if (fechaFin) updateData.fecha_fin = new Date(fechaFin);
      if (descripcion) updateData.descripcion = descripcion;

      // 'nombre_proceso' es el identificador único para buscar
      const updatedProcess = await Process.findOneAndUpdate(
          { nombre_proceso: processName },
          { $set: updateData },
          { new: true, runValidators: true } // 'new: true' devuelve el documento actualizado; 'runValidators: true' ejecuta las validaciones del esquema
      );

      if (!updatedProcess) {
          return res.status(404).json({ message: 'Proceso no encontrado para actualizar.' });
      }

      console.log(`[BACKEND] Proceso '${processName}' actualizado.`);
      res.status(200).json({
          message: 'Proceso actualizado exitosamente.',
          proceso: updatedProcess
      });

  } catch (err) {
      console.error('[BACKEND ERROR] Error al actualizar proceso:', err);
      if (err.name === 'ValidationError') {
          const errors = Object.values(err.errors).map(el => el.message);
          return res.status(400).json({ message: errors.join(', ') });
      }
      res.status(500).json({ message: 'Error interno del servidor al actualizar el proceso.' });
  }
});


module.exports = router;