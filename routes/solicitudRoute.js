const express = require('express');
const router = express.Router();
const db = require('../db');
const SolicitudAperturaSchemaInfo = require('../model/Solicitud');
const multer = require('multer');

// Configuración de Multer para manejar archivos en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Crear modelo de SolicitudApertura
const SolicitudApertura = db.model(SolicitudAperturaSchemaInfo.modelName, SolicitudAperturaSchemaInfo.schema);

// Crear nueva solicitud (ahora con soporte para archivos)
router.post('/', upload.single('archivo'), async (req, res) => {
    try {
        const { nombreTienda, direccion, justificacion } = req.body;
        const archivo = req.file; // Archivo subido mediante Multer

        const nuevaSolicitud = new SolicitudApertura({
            nombreTienda,
            direccion,
            justificacion,
            ...(archivo && { // Solo agregamos el archivo si se subió uno
                archivo: {
                    data: archivo.buffer,
                    contentType: archivo.mimetype,
                    nombreOriginal: archivo.originalname
                }
            })
        });

        await nuevaSolicitud.save();
        res.status(201).json(nuevaSolicitud);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Obtener todas las solicitudes (sin cambios)
router.get('/', async (req, res) => {
    try {
        const solicitudes = await SolicitudApertura.find();
        res.json(solicitudes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener una solicitud por ID (ahora con soporte para descargar archivo)
router.get('/:id', async (req, res) => {
    try {
        const solicitud = await SolicitudApertura.findById(req.params.id);
        if (!solicitud) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        
        // Si el cliente pide específicamente el archivo (ej: /solicitudes/123?descargar=true)
        if (req.query.descargar && solicitud.archivo && solicitud.archivo.data) {
            res.set({
                'Content-Type': solicitud.archivo.contentType,
                'Content-Disposition': `attachment; filename="${solicitud.archivo.nombreOriginal || 'archivo'}"`
            });
            return res.send(solicitud.archivo.data);
        }
        
        res.json(solicitud);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar estado de una solicitud (sin cambios)
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

// Eliminar una solicitud (sin cambios)
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