// backend/models/UsuarioSchema.js (Cambia el nombre de tu archivo de 'usuarios.js' a 'UsuarioSchema.js')
const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    correo: { type: String, required: true, unique: true },
    contraseña: { type: String, required: true },
    rol: { type: String, enum: ['Gerencia', 'Usuario', 'Supervisor'], required: true },
    ciudad: {
        type: String,
        enum: ['Quito', 'Calderón', 'Tumbaco', 'Pomasqui', 'Centro Historico'],
        required: true,
    },
    area: {
        type: String,
        enum: ['Ventas', 'Marketing', 'TI', 'Recursos Humanos', 'Operaciones'],
        required: true,
    },
}, { timestamps: true, collection: 'usuarios' }); // Asegúrate de especificar la colección

// Exporta un objeto con el esquema y el nombre del modelo
module.exports = {
    schema: UsuarioSchema,
    modelName: 'Usuario'
};