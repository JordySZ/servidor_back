const express = require('express');
const router = express.Router();
const Card = require('../models/Tarjeta');

// Helper function to ensure date strings are treated as UTC
const ensureUtcDate = (dateString) => {
    if (!dateString) return null;
    // Check if the string already explicitly indicates UTC (Z or +00:00)
    if (dateString.endsWith('Z') || dateString.includes('+00:00')) {
        return new Date(dateString);
    }
    // If not, assume it's meant to be UTC and append 'Z'
    // This is a safeguard if Flutter's .toUtc().toIso8601String() somehow loses the 'Z'
    return new Date(`${dateString}Z`);
};

// GET: Obtener todas las tarjetas
router.get('/', async (req, res) => {
    try {
        const cards = await Card.find();
        res.status(200).json(cards);
    } catch (err) {
        console.error("Error al obtener tarjetas:", err);
        res.status(500).json({
            message: 'Error interno del servidor al obtener tarjetas',
            error: err.message
        });
    }
});

// GET: Obtener una tarjeta por su ID de Flutter
router.get('/:id', async (req, res) => {
    try {
        const card = await Card.findOne({ id: req.params.id });
        if (!card) {
            return res.status(404).json({ message: 'Tarjeta no encontrada' });
        }
        res.status(200).json(card);
    } catch (err) {
        console.error("Error al obtener tarjeta por ID:", err);
        res.status(500).json({
            message: 'Error interno del servidor al obtener tarjeta',
            error: err.message
        });
    }
});

// POST: Crear una nueva tarjeta
router.post('/', async (req, res) => {
    if (!req.body.id || !req.body.titulo) {
        return res.status(400).json({ message: 'ID y título de la tarjeta son requeridos.' });
    }

    // --- DEBUGGING LOGS ---
    console.log('\n--- NODE.JS DEBUG: POST Request Received ---');
    console.log('Request Body COMPLETO:', req.body);
    console.log('Fecha de Vencimiento STRING RECIBIDA (del frontend):', req.body.fechaVencimiento);
    console.log('Fecha de Inicio STRING RECIBIDA (del frontend):', req.body.fechaInicio);
    // --- END DEBUGGING LOGS ---

    const newCard = new Card({
        id: req.body.id,
        titulo: req.body.titulo,
        miembro: req.body.miembro || '',
      
        // Usar la función auxiliar para asegurar que las fechas se traten como UTC
        fechaInicio: ensureUtcDate(req.body.fechaInicio),
        fechaVencimiento: ensureUtcDate(req.body.fechaVencimiento),
        estado: req.body.estado || 'porHacer',
    });

    // --- DEBUGGING LOGS ---
    console.log('Fecha de Vencimiento PARSEADA (objeto Date):', newCard.fechaVencimiento?.toString());
    console.log('Fecha de Vencimiento PARSEADA (toISOString - DEBE SER UTC):', newCard.fechaVencimiento?.toISOString());
    console.log('Fecha de Inicio PARSEADA (toISOString - DEBE SER UTC):', newCard.fechaInicio?.toISOString());
    // --- END DEBUGGING LOGS ---

    try {
        const savedCard = await newCard.save();
        console.log('Tarjeta creada exitosamente. Objeto retornado por Mongoose (Fechas en UTC):', savedCard);
        res.status(201).json(savedCard);
    } catch (err) {
        console.error("Error al crear tarjeta:", err);
        res.status(400).json({ message: 'Error al crear tarjeta', error: err.message });
    }
});

// PUT: Actualizar una tarjeta por su ID de Flutter
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        // --- DEBUGGING LOGS ---
        console.log('\n--- NODE.JS DEBUG: PUT Request Received ---');
        console.log('Request Body COMPLETO:', req.body);
        console.log('Fecha de Vencimiento STRING RECIBIDA (del frontend - PUT):', req.body.fechaVencimiento);
        console.log('Fecha de Inicio STRING RECIBIDA (del frontend - PUT):', req.body.fechaInicio);
        // --- END DEBUGGING LOGS ---

        // Aplicar la conversión segura a UTC para las fechas si existen en el body
        if (updates.fechaInicio !== undefined) {
            updates.fechaInicio = ensureUtcDate(updates.fechaInicio);
            console.log('Fecha de Inicio PARSEADA (toISOString - PUT):', updates.fechaInicio?.toISOString());
        }
        if (updates.fechaVencimiento !== undefined) {
            updates.fechaVencimiento = ensureUtcDate(updates.fechaVencimiento);
            console.log('Fecha de Vencimiento PARSEADA (toISOString - PUT):', updates.fechaVencimiento?.toISOString());
        }

        const updatedCard = await Card.findOneAndUpdate(
            { id: id },
            { $set: updates },
            { new: true, runValidators: true }
        );

        console.log('Tarjeta actualizada exitosamente. Objeto retornado por Mongoose (Fechas en UTC):', updatedCard);

        if (!updatedCard) {
            return res.status(404).json({ message: 'Tarjeta no encontrada' });
        }
        res.status(200).json(updatedCard);
    } catch (err) {
        console.error("Error al actualizar tarjeta:", err);
        res.status(400).json({ message: 'Error al actualizar tarjeta', error: err.message });
    }
});

// DELETE: Eliminar una tarjeta por su ID de Flutter
router.delete('/:id', async (req, res) => {
    try {
        const deletedCard = await Card.findOneAndDelete({ id: req.params.id });
        if (!deletedCard) {
            return res.status(404).json({ message: 'Tarjeta no encontrada' });
        }
        res.status(200).json({ message: 'Tarjeta eliminada con éxito' });
    } catch (err) {
        console.error("Error al eliminar tarjeta:", err);
        res.status(500).json({
            message: 'Error interno del servidor al eliminar tarjeta',
            error: err.message
        });
    }
});

module.exports = router;