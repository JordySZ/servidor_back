const express = require('express');
const router = express.Router();
const Card = require('../models/Tarjeta');

// Lista de miembros permitidos (debe coincidir con el enum del modelo)
const MIEMBROS_PERMITIDOS = ['DSI', 'Infraestructura', 'Contabilidad', 'Operaciones', 'Redes', 'Trade', 'DragonTaill'];

// Helper function to ensure date strings are treated as UTC
const ensureUtcDate = (dateString) => {
    if (!dateString) return null;
    if (dateString.endsWith('Z') || dateString.includes('+00:00')) {
        return new Date(dateString);
    }
    return new Date(`${dateString}Z`);
};

// Validar el campo miembro
const validarMiembro = (miembro) => {
    if (miembro && !MIEMBROS_PERMITIDOS.includes(miembro)) {
        throw new Error(`El miembro debe ser uno de los siguientes: ${MIEMBROS_PERMITIDOS.join(', ')}`);
    }
    return true;
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

    try {
        // Validar el campo miembro si está presente
        if (req.body.miembro) {
            validarMiembro(req.body.miembro);
        }

        // --- DEBUGGING LOGS ---
        console.log('\n--- NODE.JS DEBUG: POST Request Received ---');
        console.log('Request Body COMPLETO:', req.body);
        console.log('Fecha de Vencimiento STRING RECIBIDA:', req.body.fechaVencimiento);
        console.log('Fecha de Inicio STRING RECIBIDA:', req.body.fechaInicio);
        // --- END DEBUGGING LOGS ---

        const newCard = new Card({
            id: req.body.id,
            titulo: req.body.titulo,
            miembro: req.body.miembro || '',
            fechaInicio: ensureUtcDate(req.body.fechaInicio),
            fechaVencimiento: ensureUtcDate(req.body.fechaVencimiento),
            estado: req.body.estado || 'porHacer',
        });

        const savedCard = await newCard.save();
        console.log('Tarjeta creada exitosamente:', savedCard);
        res.status(201).json(savedCard);
    } catch (err) {
        console.error("Error al crear tarjeta:", err);
        res.status(400).json({ 
            message: 'Error al crear tarjeta', 
            error: err.message,
            ...(err.message.includes('El miembro debe ser') && { 
                miembrosPermitidos: MIEMBROS_PERMITIDOS 
            })
        });
    }
});

// PUT: Actualizar una tarjeta por su ID de Flutter
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        // Validar el campo miembro si está presente en la actualización
        if (updates.miembro !== undefined) {
            validarMiembro(updates.miembro);
        }

        // --- DEBUGGING LOGS ---
        console.log('\n--- NODE.JS DEBUG: PUT Request Received ---');
        console.log('Request Body COMPLETO:', req.body);
        console.log('Fecha de Vencimiento STRING RECIBIDA (PUT):', req.body.fechaVencimiento);
        console.log('Fecha de Inicio STRING RECIBIDA (PUT):', req.body.fechaInicio);
        // --- END DEBUGGING LOGS ---

        // Aplicar la conversión segura a UTC para las fechas
        if (updates.fechaInicio !== undefined) {
            updates.fechaInicio = ensureUtcDate(updates.fechaInicio);
        }
        if (updates.fechaVencimiento !== undefined) {
            updates.fechaVencimiento = ensureUtcDate(updates.fechaVencimiento);
        }

        const updatedCard = await Card.findOneAndUpdate(
            { id: id },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedCard) {
            return res.status(404).json({ message: 'Tarjeta no encontrada' });
        }
        res.status(200).json(updatedCard);
    } catch (err) {
        console.error("Error al actualizar tarjeta:", err);
        res.status(400).json({ 
            message: 'Error al actualizar tarjeta', 
            error: err.message,
            ...(err.message.includes('El miembro debe ser') && { 
                miembrosPermitidos: MIEMBROS_PERMITIDOS 
            })
        });
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