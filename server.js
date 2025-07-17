const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")
const morgan = require("morgan")

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())
app.use(morgan("dev"))

app.use("/api/auth", require("./routes/auth"))
app.use("/api/users", require("./routes/users"))
app.use("/api/posts", require("./routes/posts"))
app.use("/api/notes", require("./routes/notes"))

app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 400) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} SUCCESS`);
    }
  });
  next();
});

app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ERROR:`, err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected successfully at", new Date().toISOString()))
  .catch((err) => {
    console.error("MongoDB connection error at", new Date().toISOString(), err)
  })

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} at ${new Date().toISOString()}`)
})
