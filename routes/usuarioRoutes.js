// backend/routes/usuarioRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // ¡Asegúrate de tener jwt instalado si lo usas! (npm install jsonwebtoken)

// Importa el objeto que contiene el esquema y el nombre del modelo
const UsuarioSchemaInfo = require('../models/Usuario'); // ¡Importa el archivo 'usuarios.js'!

// Exporta una función que toma la conexión de usuarios como argumento
module.exports = (connUsers) => {
    const router = express.Router();

    // Dentro de esta función, crea el modelo Usuario usando la conexión específica (connUsers)
    const Usuario = connUsers.model(UsuarioSchemaInfo.modelName, UsuarioSchemaInfo.schema);

    // Registro
    router.post('/registro', async (req, res) => {
        try {
            const { nombre, apellido, correo, contraseña, rol, ciudad, area } = req.body;

            if (!nombre || !apellido || !correo || !contraseña || !rol || !ciudad || !area) {
                return res.status(400).json({ error: 'Faltan campos obligatorios' });
            }

            const contraseñaHash = await bcrypt.hash(contraseña, 10);

            const nuevoUsuario = new Usuario({ // Usa el modelo 'Usuario' que acabamos de definir
                nombre,
                apellido,
                correo,
                contraseña: contraseñaHash,
                rol,
                ciudad,
                area,
            });

            await nuevoUsuario.save();

            // Opcional: Generar un token JWT después del registro
            // const token = jwt.sign(
            //     { id: nuevoUsuario._id, rol: nuevoUsuario.rol },
            //     process.env.JWT_SECRET,
            //     { expiresIn: '1h' }
            // );

            res.status(201).json({ mensaje: 'Usuario creado exitosamente' /*, token */ });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({ error: 'El correo ya está registrado' });
            }
            res.status(400).json({
                error: 'Error al crear el usuario',
                detalle: error.message,
            });
        }
    });

    // Login: autenticación
    router.post('/login', async (req, res) => {
        try {
            const { correo, contraseña } = req.body; // Cambié 'email' a 'correo' para que coincida con tu esquema

            if (!correo || !contraseña) {
                return res.status(400).json({ msg: 'Correo y contraseña son requeridos' });
            }

            const usuario = await Usuario.findOne({ correo }); // Usa el modelo 'Usuario'
            if (!usuario) {
                return res.status(401).json({ msg: 'Usuario no encontrado' });
            }

            const esValido = await bcrypt.compare(contraseña, usuario.contraseña);
            if (!esValido) {
                return res.status(401).json({ msg: 'Contraseña incorrecta' });
            }

            // Generar token JWT para el login
            const token = jwt.sign(
                { id: usuario._id, rol: usuario.rol, nombre: usuario.nombre, correo: usuario.correo },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            return res.status(200).json({
                msg: 'Login exitoso',
                usuario: {
                    nombre: usuario.nombre,
                    rol: usuario.rol,
                    correo: usuario.correo,
                },
                token // Envía el token JWT al cliente
            });
        } catch (error) {
            return res.status(500).json({ msg: 'Error en el servidor', detalle: error.message });
        }
    });

    // Obtener usuarios (sin contraseña)
    router.get('/', async (req, res) => {
        try {
            const usuarios = await Usuario.find({}, '-contraseña'); // Usa el modelo 'Usuario'
            res.json(usuarios);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener usuarios' });
        }
    });

    // Eliminar usuario
    router.delete('/:id', async (req, res) => {
        try {
            const usuario = await Usuario.findByIdAndDelete(req.params.id); // Usa el modelo 'Usuario'
            if (!usuario) {
                return res.status(404).json({ mensaje: 'Usuario no encontrado' });
            }
            res.json({ mensaje: 'Usuario eliminado correctamente' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar usuario', detalle: error.message });
        }
    });

    // Actualizar usuario
    router.put('/:id', async (req, res) => {
        try {
            const { nombre, apellido, correo, contraseña, rol, ciudad, area } = req.body;

            const usuario = await Usuario.findById(req.params.id); // Usa el modelo 'Usuario'
            if (!usuario) {
                return res.status(404).json({ mensaje: 'Usuario no encontrado' });
            }

            if (nombre) usuario.nombre = nombre;
            if (apellido) usuario.apellido = apellido;
            if (correo) usuario.correo = correo;
            if (rol) usuario.rol = rol;
            if (ciudad) usuario.ciudad = ciudad;
            if (area) usuario.area = area;

            if (contraseña) {
                const contraseñaHash = await bcrypt.hash(contraseña, 10);
                usuario.contraseña = contraseñaHash;
            }

            await usuario.save();

            res.json({ mensaje: 'Usuario actualizado correctamente' });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({ error: 'El correo ya está registrado por otro usuario' });
            }
            res.status(500).json({ error: 'Error al actualizar usuario', detalle: error.message });
        }
    });

    return router; // Retorna el router configurado
};