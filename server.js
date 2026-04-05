const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")
const morgan = require("morgan")

dotenv.config()

const app = express()

const normalizeOrigin = (value) =>
  typeof value === "string" ? value.trim().replace(/\/+$/, "") : ""

const parseClientOrigins = () => {
  const raw = process.env.CLIENT_URL
  if (!raw || !raw.trim()) return null
  return raw
    .split(",")
    .map((s) => normalizeOrigin(s))
    .filter(Boolean)
}

const clientOrigins = parseClientOrigins()

const corsOptions = {
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
}

if (clientOrigins && clientOrigins.length > 0) {
  corsOptions.origin = (origin, callback) => {
    if (!origin) return callback(null, true)
    const o = normalizeOrigin(origin)
    if (clientOrigins.includes(o)) return callback(null, true)
    console.warn(`[cors] blocked origin: ${origin}`)
    callback(null, false)
  }
} else {
  // Reflect request origin so credentials + browser preflight work (dev or before CLIENT_URL is set)
  corsOptions.origin = true
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(morgan("dev"))

app.get("/health", (req, res) => {
  // mongoose: 0=disconnected 1=connected 2=connecting 3=disconnecting
  const readyState = mongoose.connection.readyState
  const dbOk = readyState === 1
  res.status(200).json({
    status: "ok",
    db: dbOk ? "connected" : "disconnected",
    mongoReadyState: readyState,
    mongoConfigured: Boolean(process.env.MONGODB_URI),
  })
})

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

const PORT = process.env.PORT || 5000

if (!process.env.MONGODB_URI) {
  console.error(
    "Missing MONGODB_URI — add it in Render → Environment. Signup/login will fail until it is set.",
  )
} else {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected successfully at", new Date().toISOString()))
    .catch((err) => {
      console.error(
        "MongoDB connection error — check Atlas IP allowlist (0.0.0.0/0) and MONGODB_URI:",
        err.message,
      )
    })
}

if (!process.env.JWT_SECRET) {
  console.warn("Missing JWT_SECRET — add it in Render; register/login will return errors until set.")
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} at ${new Date().toISOString()}`)
})
