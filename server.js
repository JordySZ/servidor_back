// server.js (backend Node.js con Express y Mongoose)

// Carga las variables de entorno desde el archivo .env
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// --- Importaciones de esquemas (NO modelos directamente aquí) y rutas ---
const ProcessSchemaInfo = require('./models/Process'); // Importa el objeto { schema, modelName }
const UsuarioRoutesFactory = require('./routes/usuarioRoutes'); // Importa la función que crea las rutas de usuario

const app = express(); // <-- ¡ESTA LÍNEA DEBE ESTAR AQUÍ!
const PORT = process.env.PORT || 3000;

// --- Middlewares globales ---
app.use(cors());
app.use(express.json());

// --- CONEXIÓN 1: Para Procesos (metadatos), Listas y Tarjetas ---
// Utiliza MONGODB_URI_PROCESSES del .env
const connProcesses = mongoose.createConnection(process.env.MONGODB_URI_PROCESSES, {
    // useNewUrlParser y useUnifiedTopology están deprecated en Mongoose 6+
    // Si usas Mongoose < 6.0, descomenta estas líneas:
    // useNewUrlParser: true,
    // useUnifiedTopology: true
});

connProcesses.on('connected', () => console.log('✅ BACKEND DEBUG: Conectado a MongoDB Atlas (DB: Procesos)'));
connProcesses.on('error', (err) => console.error('❌ BACKEND ERROR: Error de conexión a MongoDB (DB: Procesos):', err));

// --- CONEXIÓN 2: Para Usuarios ---
// Utiliza MONGODB_URI_USERS del .env
const connUsers = mongoose.createConnection(process.env.MONGODB_URI_USERS, {
    // Si usas Mongoose < 6.0, descomenta estas líneas:
    // useNewUrlParser: true,
    // useUnifiedTopology: true
});

connUsers.on('connected', () => console.log('✅ BACKEND DEBUG: Conectado a MongoDB Atlas (DB: Usuarios)'));
connUsers.on('error', (err) => console.error('❌ BACKEND ERROR: Error de conexión a MongoDB (DB: Usuarios):', err));

// --- Rutas específicas para usuarios ---
// Se colocan aquí porque dependen de 'app' y 'connUsers', que ya están definidos.
app.use('/usuarios', UsuarioRoutesFactory(connUsers));


// --- Modelos que usan la conexión 'Procesos' ---
// Aquí creamos el modelo ProcessMaster a partir de su esquema y la conexión connProcesses
const ProcessMaster = connProcesses.model(ProcessSchemaInfo.modelName, ProcessSchemaInfo.schema);


// --- Esquema base para las tarjetas ---
const cardBaseSchema = new mongoose.Schema({
    titulo: { type: String },
    descripcion: String,
    miembro: String,
    fechaInicio: Date,
    fechaVencimiento: Date,
    estado: {
        type: String,
        enum: ['pendiente', 'en_progreso', 'hecho'],
        default: 'pendiente'
    },
    fechaCompletado: Date,
    idLista: { type: mongoose.Schema.Types.ObjectId, required: true }, // Referencia al _id de la lista
}, { strict: false, timestamps: true });

// Función auxiliar para obtener o crear un modelo de Mongoose dinámicamente para Tarjetas
const getDynamicCardModel = (collectionName) => {
    const modelName = collectionName;
    if (connProcesses.models[modelName]) { // Usar connProcesses.models
        return connProcesses.model(modelName);
    }
    return connProcesses.model(modelName, cardBaseSchema, modelName); // Usar connProcesses.model
};

// --- Esquema para las Listas (columnas del tablero) ---
const listBaseSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
}, { timestamps: true });

// Función auxiliar para obtener o crear un modelo de Mongoose dinámicamente para Listas
const getDynamicListModel = (processName) => {
    const modelName = `${processName}_lists`;
    if (connProcesses.models[modelName]) { // Usar connProcesses.models
        return connProcesses.model(modelName);
    }
    return connProcesses.model(modelName, listBaseSchema, modelName); // Usar connProcesses.model
};

// --- Esquema para las gráficas ---
const graficaSchema = new mongoose.Schema({
    tipoGrafica: String,
    filtro: String,
    periodo: String,
}, { timestamps: true });

const getDynamicGraficaModel = (processName) => {
    const modelName = `${processName}_graficas`;
    if (connProcesses.models[modelName]) {
        return connProcesses.model(modelName);
    }
    return connProcesses.model(modelName, graficaSchema, modelName);
};

// --- RUTAS DE GESTIÓN DE PROCESOS (METADATOS y COLECCIONES ASOCIADAS) ---

// POST: Crear un nuevo proceso con metadatos (nombre, fechaInicio, fechaFin, estado)
app.post('/procesos', async (req, res) => {
    try {
        // Incluye 'estado' en la desestructuración del cuerpo de la solicitud
        const { nombre, fechaInicio, fechaFin, estado } = req.body;
        console.log(`✅ BACKEND DEBUG: Recibida petición POST /procesos con nombre: '${nombre}', fechaInicio: '${fechaInicio}', fechaFin: '${fechaFin}', estado: '${estado}'`);

        if (!nombre || !fechaInicio || !fechaFin) {
            console.log('❌ BACKEND ERROR: Faltan campos requeridos (nombre, fechaInicio, fechaFin).');
            return res.status(400).json({ error: "Faltan los parámetros 'nombre', 'fechaInicio' o 'fechaFin' para el proceso." });
        }

        // Validación adicional para el estado si es necesario
        const estadosPermitidos = ['echo', 'en proceso', 'pendiente'];
        if (estado && !estadosPermitidos.includes(estado)) {
            console.log(`❌ BACKEND ERROR: Estado inválido: ${estado}.`);
            return res.status(400).json({ error: `El estado proporcionado no es válido. Los valores permitidos son: ${estadosPermitidos.join(', ')}.` });
        }

        const newProcessData = {
            nombre_proceso: nombre,
            fecha_inicio: new Date(fechaInicio),
            fecha_fin: new Date(fechaFin),
            estado: estado || 'pendiente', // Asigna el estado recibido o 'pendiente' por defecto
        };

        const newProcessMaster = new ProcessMaster(newProcessData);
        await newProcessMaster.save();

        console.log(`✅ BACKEND DEBUG: Metadatos para el proceso '${nombre}' guardados en 'process_metadata'.`);

        const nombreColeccionProceso = nombre; // Esto parece ser el nombre base para las colecciones dinámicas

        const responseBody = {
            mensaje: `Proceso '${nombreColeccionProceso}' creado/registrado exitosamente.`,
            nombreColeccion: nombreColeccionProceso,
            proceso: newProcessMaster.toObject()
        };
        // Asegúrate de que las fechas se formateen como ISO strings para el frontend
        responseBody.proceso.fecha_inicio = newProcessMaster.fecha_inicio.toISOString();
        responseBody.proceso.fecha_fin = newProcessMaster.fecha_fin.toISOString();

        console.log('✅ BACKEND DEBUG: Enviando respuesta 201:', JSON.stringify(responseBody));
        res.status(201).json(responseBody);

    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al crear/registrar el proceso:", error);
        if (error.code === 11000) {
            console.log(`⚠️ BACKEND DEBUG: Intento de crear proceso duplicado: ${req.body.nombre}`);
            return res.status(409).json({ error: `El proceso con el nombre '${req.body.nombre}' ya existe.` });
        }
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ error: messages.join(', ') });
        }
        res.status(500).json({ error: "Error interno del servidor al crear/registrar el proceso." });
    }
});

// GET: Obtener todos los procesos (con metadatos como fechas y estado)
app.get('/procesos', async (req, res) => {
    try {
        console.log('✅ BACKEND DEBUG: Recibida petición GET /procesos para listar procesos desde process_metadata.');

        // Incluye 'estado' en la proyección
        const allProcesses = await ProcessMaster.find({}, 'nombre_proceso fecha_inicio fecha_fin estado').lean();

        const formattedProcesses = allProcesses.map(p => ({
            id: p._id.toString(),
            name: p.nombre_proceso,
            startDate: p.fecha_inicio.toISOString(),
            endDate: p.fecha_fin.toISOString(),
            estado: p.estado // Incluye el nuevo campo estado
        }));

        console.log(`✅ BACKEND DEBUG: Procesos encontrados en 'process_metadata': ${formattedProcesses.length}`);
        res.status(200).json(formattedProcesses);
    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al listar procesos desde process_metadata:", error);
        res.status(500).json({ error: "Error interno del servidor al listar procesos." });
    }
});

// PUT: Actualizar un proceso (solo sus metadatos en 'process_metadata')
app.put('/procesos/:processName', async (req, res) => {
    const { processName } = req.params;
    const { nombre, fechaInicio, fechaFin, descripcion, estado } = req.body;

    const updateData = {};
    if (nombre) updateData.nombre_proceso = nombre;
    
    // CAMBIO CLAVE AQUÍ: Asignar directamente la cadena ISO si existe
    if (fechaInicio) updateData.fecha_inicio = fechaInicio; 
    if (fechaFin) updateData.fecha_fin = fechaFin; 

    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (estado) {
        const estadosPermitidos = ['echo', 'en proceso', 'pendiente'];
        if (!estadosPermitidos.includes(estado)) {
            console.log(`❌ BACKEND ERROR: Estado inválido para actualización: ${estado}.`);
            return res.status(400).json({ error: `El estado proporcionado no es válido. Los valores permitidos son: ${estadosPermitidos.join(', ')}.` });
        }
        updateData.estado = estado;
    }

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No hay campos para actualizar.' });
    }

    try {
        // Aquí podrías agregar un console.log para ver qué `updateData` se envía a Mongoose
        console.log('✅ BACKEND DEBUG: Datos que se envían a Mongoose para actualizar:', updateData);

        const updatedProcess = await ProcessMaster.findOneAndUpdate(
            { nombre_proceso: processName },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedProcess) {
            console.log(`❌ BACKEND DEBUG: Proceso con nombre '${processName}' no encontrado para actualizar.`);
            return res.status(404).json({ error: "Proceso no encontrado para actualizar." });
        }

        console.log(`✅ BACKEND DEBUG: Proceso '${processName}' actualizado en 'process_metadata'.`, updatedProcess);

        const responseProcess = updatedProcess.toObject();
        // Aseguramos que las fechas se devuelvan como cadenas ISO desde el objeto actualizado
        responseProcess.fecha_inicio = updatedProcess.fecha_inicio.toISOString();
        responseProcess.fecha_fin = updatedProcess.fecha_fin.toISOString();

        res.status(200).json({
            message: 'Proceso actualizado exitosamente.',
            proceso: responseProcess
        });

    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al actualizar proceso:", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ error: messages.join(', ') });
        }
        if (error.code === 11000) {
            return res.status(409).json({ message: `Ya existe un proceso con el nombre '${nombre}'.` });
        }
        res.status(500).json({ error: "Error interno del servidor al actualizar el proceso." });
    }
});


// DELETE: Eliminar un proceso (metadatos y sus colecciones asociadas)
app.delete('/procesos/:processName', async (req, res) => {
    try {
        const processName = req.params.processName;
        console.log(`✅ BACKEND DEBUG: Recibida petición DELETE /procesos/${processName} para eliminar proceso.`);

        if (!processName) {
            console.log('❌ BACKEND ERROR: Nombre de proceso no especificado para eliminar.');
            return res.status(400).json({ error: "Nombre de proceso no especificado." });
        }

        const db = connProcesses.db;

        // Cambiado de 'process_master' a 'procesos_metadata' que es el nombre de tu colección
        const deletedProcessMaster = await ProcessMaster.findOneAndDelete({ nombre_proceso: processName });

        if (!deletedProcessMaster) {
            console.log(`⚠️ BACKEND DEBUG: Metadatos del proceso '${processName}' no encontrados en 'procesos_metadata', intentando eliminar solo colecciones asociadas.`);
        } else {
            console.log(`✅ BACKEND DEBUG: Metadatos del proceso '${processName}' eliminados de 'procesos_metadata'.`);
        }

        const listCollectionName = `${processName}_lists`;
        const listCollectionExists = await db.listCollections({ name: listCollectionName }).hasNext();

        if (listCollectionExists) {
            await db.dropCollection(listCollectionName);
            console.log(`✅ BACKEND DEBUG: Colección de listas '${listCollectionName}' eliminada.`);
        } else {
            console.log(`⚠️ BACKEND DEBUG: Colección de listas '${listCollectionName}' no encontrada, saltando eliminación.`);
        }

        // Confirmar el nombre exacto de la colección de tarjetas si es diferente.
        // Si las tarjetas están en la misma colección que las listas o si no hay una colección separada por proceso:
        // Asegúrate de que esta lógica coincida con cómo guardas las tarjetas.
        // Si el nombre de la colección de tarjetas es solo el nombre del proceso, entonces 'processName' está bien aquí.
        // Si las tarjetas se guardan en la colección `${processName}_cards`, entonces la línea de abajo está bien.
        const cardCollectionName = `${processName}`; // Ajustado para ser más explícito
        const cardCollectionExists = await db.listCollections({ name: cardCollectionName }).hasNext();

        if (cardCollectionExists) {
            await db.dropCollection(cardCollectionName);
            console.log(`✅ BACKEND DEBUG: Colección de tarjetas '${cardCollectionName}' eliminada.`);
        } else {
            console.log(`⚠️ BACKEND DEBUG: Colección de tarjetas '${cardCollectionName}' no encontrada, saltando eliminación.`);
        }

        if (!deletedProcessMaster && !listCollectionExists && !cardCollectionExists) {
             return res.status(404).json({ message: `Proceso '${processName}' no encontrado.` });
        }

        console.log(`✅ BACKEND DEBUG: Proceso '${processName}' y sus colecciones asociadas (si existían) eliminados exitosamente.`);
        res.status(200).json({ message: `Proceso '${processName}' y sus datos asociados han sido eliminados.` });

    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al eliminar proceso y sus colecciones:", error);
        res.status(500).json({ error: "Error interno del servidor al eliminar el proceso." });
    }
});


// --- RUTAS DE GESTIÓN DE LISTAS ---
// Middleware para adjuntar el modelo de lista dinámico a la solicitud
app.use('/procesos/:processName/lists', (req, res, next) => {
    const processName = req.params.processName;
    if (!processName) {
        console.log('❌ BACKEND ERROR: Nombre de proceso (colección) no especificado en la URL para operaciones de lista.');
        return res.status(400).json({ error: "Nombre de proceso (colección) no especificado en la URL." });
    }
    req.ListModel = getDynamicListModel(processName);
    console.log(`✅ BACKEND DEBUG: Middleware - Modelo de lista dinámico para '${processName}' adjuntado.`);
    next();
});

// GET: Obtener todas las listas para un proceso específico
app.get('/procesos/:processName/lists', async (req, res) => {
    try {
        console.log(`✅ BACKEND DEBUG: Recibida petición GET /procesos/${req.params.processName}/lists`);
        const lists = await req.ListModel.find({});
        console.log(`✅ BACKEND DEBUG: Listas encontradas para '${req.params.processName}': ${lists.length}`);
        res.status(200).json(lists);
    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al obtener listas:", error);
        res.status(500).json({ error: "Error interno del servidor al obtener listas." });
    }
});

// POST: Crear una nueva lista en un proceso específico
app.post('/procesos/:processName/lists', async (req, res) => {
    try {
        const newListData = req.body;
        console.log(`✅ BACKEND DEBUG: Recibida petición POST /procesos/${req.params.processName}/lists con datos:`, newListData);

        if (!newListData.titulo || newListData.titulo.trim() === '') {
            console.log('❌ BACKEND ERROR: El campo "titulo" es requerido para crear una lista.');
            return res.status(400).json({ error: "El campo 'titulo' es requerido para crear una lista." });
        }

        const newList = new req.ListModel({ titulo: newListData.titulo });
        await newList.save();
        console.log(`✅ BACKEND DEBUG: Lista creada exitosamente en '${req.params.processName}':`, newList);
        res.status(201).json(newList);
    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al crear lista:", error);
        res.status(500).json({ error: "Error interno del servidor al crear lista." });
    }
});

// PUT: Actualizar una lista existente en un proceso específico
app.put('/procesos/:processName/lists/:listId', async (req, res) => {
    try {
        const listId = req.params.listId;
        const updatedListData = req.body;
        console.log(`✅ BACKEND DEBUG: Recibida petición PUT /procesos/${req.params.processName}/lists/${listId} con datos:`, updatedListData);

        if (updatedListData._id) {
            delete updatedListData._id;
        }

        const updatedList = await req.ListModel.findByIdAndUpdate(listId, updatedListData, { new: true });

        if (!updatedList) {
            console.log(`❌ BACKEND DEBUG: Lista con ID ${listId} no encontrada en '${req.params.processName}'.`);
            return res.status(404).json({ error: "Lista no encontrada." });
        }
        console.log(`✅ BACKEND DEBUG: Lista actualizada exitosamente en '${req.params.processName}':`, updatedList);
        res.status(200).json(updatedList);
    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al actualizar lista:", error);
        res.status(500).json({ error: "Error interno del servidor al actualizar lista." });
    }
});

// DELETE: Eliminar una lista de un proceso específico
app.delete('/procesos/:processName/lists/:listId', async (req, res) => {
    try {
        const listId = req.params.listId;
        console.log(`✅ BACKEND DEBUG: Recibida petición DELETE /procesos/${req.params.processName}/lists/${listId}`);

        const deletedList = await req.ListModel.findByIdAndDelete(listId);
        if (!deletedList) {
            console.log(`❌ BACKEND DEBUG: Lista con ID ${listId} no encontrada en '${req.params.processName}'.`);
            return res.status(404).json({ error: "Lista no encontrada." });
        }

        const CardModel = getDynamicCardModel(req.params.processName);
        await CardModel.deleteMany({ idLista: listId });

        console.log(`✅ BACKEND DEBUG: Lista y sus tarjetas eliminadas exitosamente de '${req.params.processName}'.`);
        res.status(200).json({ mensaje: "Lista y sus tarjetas eliminadas exitosamente." });
    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al eliminar lista:", error);
        res.status(500).json({ error: "Error interno del servidor al eliminar lista." });
    }
});


// --- RUTAS DE GESTIÓN DE TARJETAS ---
// Middleware para adjuntar el modelo de tarjeta dinámico a la solicitud
app.use('/procesos/:processName/cards', (req, res, next) => {
    const processName = req.params.processName;
    if (!processName) {
        console.log('❌ BACKEND ERROR: Nombre de proceso (colección) no especificado en la URL para operaciones de tarjeta.');
        return res.status(400).json({ error: "Nombre de proceso (colección) no especificado en la URL." });
    }
    req.CardModel = getDynamicCardModel(processName);
    console.log(`✅ BACKEND DEBUG: Middleware - Modelo de tarjeta dinámico para '${processName}' adjuntado.`);
    next();
});

// GET: Obtener todas las tarjetas para un proceso (colección) específico
app.get('/procesos/:processName/cards', async (req, res) => {
    try {
        console.log(`✅ BACKEND DEBUG: Recibida petición GET /procesos/${req.params.processName}/cards`);
        const cards = await req.CardModel.find({
            idLista: { $exists: true }
        });
        console.log(`✅ BACKEND DEBUG: Tarjetas encontradas para '${req.params.processName}': ${cards.length}`);
        res.status(200).json(cards);
    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al obtener tarjetas:", error);
        res.status(500).json({ error: "Error interno del servidor al obtener tarjetas." });
    }
});

// POST: Crear una nueva tarjeta en un proceso (colección) específico
app.post('/procesos/:processName/cards', async (req, res) => {
    try {
        const newCardData = req.body;
        console.log(`✅ BACKEND DEBUG: Recibida petición POST /procesos/${req.params.processName}/cards con datos:`, newCardData);

        if (newCardData._id) {
            delete newCardData._id;
            console.log('⚠️ BACKEND DEBUG: Campo _id eliminado del cuerpo de la tarjeta entrante para nueva creación.');
        }

        if (!newCardData.titulo || newCardData.titulo.trim() === '') {
            console.log('❌ BACKEND ERROR: El campo "titulo" es requerido para crear una tarjeta.');
            return res.status(400).json({ error: "El campo 'titulo' es requerido para crear una tarjeta." });
        }
        if (!newCardData.idLista) {
            console.log('❌ BACKEND ERROR: El campo "idLista" es requerido para crear una tarjeta.');
            return res.status(400).json({ error: "El campo 'idLista' es requerido para crear una tarjeta." });
        }

        newCardData.idLista = new mongoose.Types.ObjectId(newCardData.idLista);

        const newCard = new req.CardModel(newCardData);
        await newCard.save();
        console.log(`✅ BACKEND DEBUG: Tarjeta creada exitosamente en '${req.params.processName}':`, newCard);

        const responseCard = newCard.toObject();
        responseCard.idLista = responseCard.idLista.toString();
        res.status(201).json(responseCard);
    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al crear tarjeta:", error);
        res.status(500).json({ error: "Error interno del servidor al crear tarjeta." });
    }
});

// PUT: Actualizar una tarjeta en un proceso (colección) específico
app.put('/procesos/:processName/cards/:cardId', async (req, res) => {
    try {
        const cardId = req.params.cardId;
        const updatedCardData = req.body;
        console.log(`✅ BACKEND DEBUG: Recibida petición PUT /procesos/${req.params.processName}/cards/${cardId} con datos:`, updatedCardData);

        if (updatedCardData._id) {
            delete updatedCardData._id;
            console.log('⚠️ BACKEND DEBUG: Campo _id eliminado del cuerpo de la tarjeta a actualizar para evitar error de cast.');
        }
        if (updatedCardData.idLista) {
            updatedCardData.idLista = new mongoose.Types.ObjectId(updatedCardData.idLista);
        }

        const updatedCard = await req.CardModel.findByIdAndUpdate(cardId, updatedCardData, { new: true });

        if (!updatedCard) {
            console.log(`❌ BACKEND DEBUG: Tarjeta con ID ${cardId} no encontrada en '${req.params.processName}'.`);
            return res.status(404).json({ error: "Tarjeta no encontrada." });
        }
        console.log(`✅ BACKEND DEBUG: Tarjeta actualizada exitosamente en '${req.params.processName}':`, updatedCard);

        const responseCard = updatedCard.toObject();
        responseCard.idLista = responseCard.idLista.toString();
        res.status(200).json(responseCard);
    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al actualizar tarjeta:", error);
        res.status(500).json({ error: "Error interno del servidor al actualizar tarjeta." });
    }
});

// DELETE: Eliminar una tarjeta de un proceso (colección) específico
app.delete('/procesos/:processName/cards/:cardId', async (req, res) => {
    try {
        const cardId = req.params.cardId;
        console.log(`✅ BACKEND DEBUG: Recibida petición DELETE /procesos/${req.params.processName}/cards/${cardId}`);
        const deletedCard = await req.CardModel.findByIdAndDelete(cardId);

        if (!deletedCard) {
            console.log(`❌ BACKEND DEBUG: Tarjeta con ID ${cardId} no encontrada en '${req.params.processName}'.`);
            return res.status(404).json({ error: "Tarjeta no encontrada." });
        }
        console.log(`✅ BACKEND DEBUG: Tarjeta eliminada exitosamente de '${req.params.processName}':`, deletedCard);
        res.status(200).json({ mensaje: "Tarjeta eliminada exitosamente." });
    } catch (error) {
        console.error("❌ BACKEND ERROR: Error al eliminar tarjeta:", error);
        res.status(500).json({ error: "Error interno del servidor al eliminar tarjeta." });
    }
});

// --- RUTAS DE GESTIÓN DE GRÁFICAS ---
app.use('/procesos/:processName/graficas', (req, res, next) => {
    const processName = req.params.processName;
    if (!processName) {
        return res.status(400).json({ error: "Nombre de proceso no especificado." });
    }
    req.GraficaModel = getDynamicGraficaModel(processName);
    next();
});

// GET: Obtener todas las gráficas de un proceso
app.get('/procesos/:processName/graficas', async (req, res) => {
    try {
        const graficas = await req.GraficaModel.find({});
        res.status(200).json(graficas);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener gráficas." });
    }
});

// POST: Crear una nueva gráfica
app.post('/procesos/:processName/graficas', async (req, res) => {
    try {
        const nuevaGrafica = new req.GraficaModel(req.body);
        await nuevaGrafica.save();
        res.status(201).json(nuevaGrafica);
    } catch (error) {
        res.status(500).json({ error: "Error al crear gráfica." });
    }
});

// PUT: Actualizar una gráfica
app.put('/procesos/:processName/graficas/:graficaId', async (req, res) => {
    try {
        const updated = await req.GraficaModel.findByIdAndUpdate(
            req.params.graficaId,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ error: "Gráfica no encontrada." });
        res.status(200).json(updated.toObject ? updated.toObject() : updated);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar gráfica." });
    }
});

// DELETE: Eliminar una gráfica
app.delete('/procesos/:processName/graficas/:graficaId', async (req, res) => {
    try {
        const deleted = await req.GraficaModel.findByIdAndDelete(req.params.graficaId);
        if (!deleted) return res.status(404).json({ error: "Gráfica no encontrada." });
        res.status(200).json({ mensaje: "Gráfica eliminada exitosamente." });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar gráfica." });
    }
});
// GET: Obtener los detalles de un proceso específico por su nombre
app.get('/procesos/:processName', async (req, res) => {
    try {
        const processName = req.params.processName;
        console.log(`✅ BACKEND DEBUG: Recibida petición GET /procesos/${processName} para obtener detalles del proceso.`);

        // Busca el proceso en la colección 'process_metadata' por el campo 'nombre_proceso'
        const processDetails = await ProcessMaster.findOne({ nombre_proceso: processName }).lean();

        if (!processDetails) {
            console.log(`❌ BACKEND DEBUG: Proceso con nombre '${processName}' no encontrado.`);
            return res.status(404).json({ message: 'Proceso no encontrado.' });
        }

        // Formatea la respuesta para que coincida con el modelo 'Process' de Flutter
        // Asegúrate de que los nombres de las claves aquí coincidan con lo que tu Process.fromJson espera
        const formattedProcess = {
            id: processDetails._id.toString(),
            name: processDetails.nombre_proceso,
            startDate: processDetails.fecha_inicio.toISOString(), // Formato ISO 8601
            endDate: processDetails.fecha_fin.toISOString(),     // Formato ISO 8601
            estado: processDetails.estado,
            // Agrega cualquier otro campo que tu modelo Process de Flutter espere
        };

        console.log(`✅ BACKEND DEBUG: Detalles del proceso '${processName}' encontrados y formateados.`);
        res.status(200).json(formattedProcess);

    } catch (error) {
        console.error(`❌ BACKEND ERROR: Error al obtener el proceso '${req.params.processName}':`, error);
        res.status(500).json({ message: 'Error interno del servidor al obtener el proceso.', error: error.message });
    }
});
// --- Inicio del servidor ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
