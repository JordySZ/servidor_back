const express = require('express');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const router = express.Router();

// Registro (ya lo tienes)
router.post('/registro', async (req, res) => {
  try {
    const { nombre, apellido, correo, contraseña, rol, ciudad, area } = req.body;

    if (!nombre || !apellido || !correo || !contraseña || !rol || !ciudad || !area) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const contraseñaHash = await bcrypt.hash(contraseña, 10);

    const nuevoUsuario = new Usuario({
      nombre,
      apellido,
      correo,
      contraseña: contraseñaHash,
      rol,
      ciudad,
      area,
    });

    await nuevoUsuario.save();

    res.status(201).json({ mensaje: 'Usuario creado exitosamente' });
  } catch (error) {
    if (error.code === 11000) {
      // Error de clave duplicada (correo repetido)
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
    const { email, contraseña } = req.body;

    if (!email || !contraseña) {
      return res.status(400).json({ msg: 'Email y contraseña son requeridos' });
    }

    // Buscar usuario por correo
    const usuario = await Usuario.findOne({ correo: email });
    if (!usuario) {
      return res.status(401).json({ msg: 'Usuario no encontrado' });
    }

    // Comparar contraseñas
    const esValido = await bcrypt.compare(contraseña, usuario.contraseña);
    if (!esValido) {
      return res.status(401).json({ msg: 'Contraseña incorrecta' });
    }

    // Si es válido, retorna éxito (puedes agregar token JWT aquí luego)
    return res.status(200).json({ msg: 'Login exitoso' });
  } catch (error) {
    return res.status(500).json({ msg: 'Error en el servidor', detalle: error.message });
  }
});

// Obtener usuarios (sin contraseña)
router.get('/', async (req, res) => {
  try {
    const usuarios = await Usuario.find({}, '-contraseña');
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const usuario = await Usuario.findByIdAndDelete(req.params.id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario', detalle: error.message });
  }
});



module.exports = router;
