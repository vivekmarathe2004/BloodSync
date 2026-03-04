const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const donorRoutes = require("./routes/donorRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const adminRoutes = require("./routes/adminRoutes");
const publicRoutes = require("./routes/publicRoutes");
const errorHandler = require("./middleware/errorHandler");
const { ensureSchema } = require("./database/ensureSchema");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: (origin, callback) => {
      const configuredOrigin = process.env.CLIENT_URL || "http://localhost:5000";
      const isLocalhostOrigin =
        !!origin &&
        /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

      if (!origin || origin === configuredOrigin || isLocalhostOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "..", "client")));
const clientRoot = path.join(__dirname, "..", "client");

app.get("/camps", (req, res) => {
  res.sendFile(path.join(clientRoot, "camps.html"));
});
app.get("/admin/camps", (req, res) => {
  res.sendFile(path.join(clientRoot, "admin", "camps.html"));
});
app.get("/donor/camps", (req, res) => {
  res.sendFile(path.join(clientRoot, "donor", "camps.html"));
});
app.get("/hospital/camps", (req, res) => {
  res.sendFile(path.join(clientRoot, "hospital", "camps.html"));
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/donor", donorRoutes);
app.use("/api/hospital", hospitalRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);

const startServer = async () => {
  await ensureSchema();

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});
