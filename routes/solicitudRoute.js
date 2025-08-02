const express = require('express');
const router = express.Router();
const db = require('../db');
const SolicitudAperturaSchemaInfo = require('../model/Solicitud');

// Crear modelo de SolicitudApertura
const SolicitudApertura = db.model(SolicitudAperturaSchemaInfo.modelName, SolicitudAperturaSchemaInfo.schema);

// Crear nueva solicitud
router.post('/', async (req, res) => {
    try {
        const nuevaSolicitud = new SolicitudApertura(req.body);
        await nuevaSolicitud.save();
        res.status(201).json(nuevaSolicitud);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Obtener todas las solicitudes
router.get('/', async (req, res) => {
    try {
        const solicitudes = await SolicitudApertura.find();
        res.json(solicitudes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener una solicitud por ID
router.get('/:id', async (req, res) => {
    try {
        const solicitud = await SolicitudApertura.findById(req.params.id);
        if (!solicitud) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        res.json(solicitud);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar estado de una solicitud
router.patch('/:id', async (req, res) => {
    try {
        const solicitud = await SolicitudApertura.findByIdAndUpdate(
            req.params.id,
            { estado: req.body.estado },
            { new: true }
        );
        if (!solicitud) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        res.json(solicitud);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Eliminar una solicitud
router.delete('/:id', async (req, res) => {
    try {
        const solicitud = await SolicitudApertura.findByIdAndDelete(req.params.id);
        if (!solicitud) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        res.json({ message: 'Solicitud eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;