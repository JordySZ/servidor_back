const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
 await mongoose.connect(process.env.MONGODB_URI, {
  dbName: "Procesos",
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
    console.log("MongoDB conectado correctamente.");
  } catch (error) {
    console.error("Error conectando a MongoDB:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
