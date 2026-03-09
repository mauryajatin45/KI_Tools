/**
 * server.js — Shopify Back-in-Stock Waitlist App
 * Express entry point. Mounts all routes and configures middleware.
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const subscribeRoutes = require("./routes/subscribe");
const waitlistRoutes  = require("./routes/waitlist");
const authRoutes      = require("./routes/auth");
const webhookRoutes = require("./routes/webhooks");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Serve the built React dashboard as the embedded app UI.
// Shopify loads the app URL in an iframe — this serves the Polaris dashboard.
// The dashboard/ folder must be built first: npm run build:dashboard
// ---------------------------------------------------------------------------
const dashboardPath = path.join(__dirname, "dashboard", "dist");
app.use(express.static(dashboardPath));

// ---------------------------------------------------------------------------
// CORS — allow requests from ANY origin (storefronts, preview links, etc)
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Bypass-Tunnel-Reminder"],
  })
);

app.use(express.json());

// ---------------------------------------------------------------------------
// Global Request Logger
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", store: process.env.SHOPIFY_STORE_DOMAIN });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/", authRoutes);          // GET  /auth  +  GET  /auth/callback
app.use("/api", subscribeRoutes);   // POST /api/subscribe  (public, from storefront)
app.use("/api", waitlistRoutes);    // GET  /api/waitlists
                                    // GET  /api/waitlist/export-csv
                                    // POST /api/waitlist/mark-sent
app.use("/webhooks", webhookRoutes); // POST /webhooks/inventory

// ---------------------------------------------------------------------------
// SPA fallback — serve index.html for all non-API routes.
// This makes the React dashboard work when Shopify loads the embedded app
// at any path inside the admin iframe.
// ---------------------------------------------------------------------------
app.get("*", (req, res) => {
  const indexPath = path.join(dashboardPath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      // Dashboard not built yet — show a helpful message
      res.status(200).send(
        "<h2>Dashboard not built yet.</h2><p>Run: <code>npm run build:dashboard</code></p>"
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Waitlist server running on http://localhost:${PORT}`);
  console.log(`   Store: https://${process.env.SHOPIFY_STORE_DOMAIN}\n`);
});
