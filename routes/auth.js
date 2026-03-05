/**
 * routes/auth.js
 *
 * One-time OAuth flow to capture the Admin API access token.
 *
 * Step 1: Visit http://localhost:3000/auth?shop=ki-tools-2.myshopify.com
 * Step 2: Approve the app in Shopify
 * Step 3: You'll be redirected here → the token is printed in your terminal
 *         AND saved automatically to your .env file.
 */

const express = require("express");
const fetch   = require("node-fetch");
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");

const router = express.Router();

const CLIENT_ID     = process.env.SHOPIFY_API_KEY;
const CLIENT_SECRET = process.env.SHOPIFY_API_SECRET;
// Must match EXACTLY what you register in Dev Dashboard → Configuration → Redirect URLs
const REDIRECT_URI  = process.env.SHOPIFY_REDIRECT_URI || "http://localhost:3000/auth/callback";
const SCOPES        = "write_products,read_products";

// ── Step 1: Kick off OAuth ──────────────────────────────────────────────────
router.get("/auth", (req, res) => {
  const shop  = req.query.shop || process.env.SHOPIFY_STORE_DOMAIN;
  const nonce = crypto.randomBytes(16).toString("hex");

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${nonce}`;

  console.log("\n🔑 Starting OAuth flow...");
  console.log(`   Redirecting to: ${authUrl}\n`);
  res.redirect(authUrl);
});

// ── Step 2: Receive the code, exchange for token ────────────────────────────
router.get("/auth/callback", async (req, res) => {
  const { code, shop } = req.query;

  if (!code || !shop) {
    return res.status(400).send("Missing code or shop param.");
  }

  try {
    // Exchange code for permanent access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });

    const data = await tokenRes.json();

    if (!data.access_token) {
      throw new Error(JSON.stringify(data));
    }

    const token = data.access_token;

    // Inject directly into process so it works instantly without a server restart
    process.env.SHOPIFY_ACCESS_TOKEN = token;

    // ── Save to .env file automatically ──
    const envPath    = path.join(__dirname, "..", ".env");
    let   envContent = fs.readFileSync(envPath, "utf8");

    if (envContent.includes("SHOPIFY_ACCESS_TOKEN=")) {
      envContent = envContent.replace(
        /SHOPIFY_ACCESS_TOKEN=.*/,
        `SHOPIFY_ACCESS_TOKEN=${token}`
      );
    } else {
      envContent += `\nSHOPIFY_ACCESS_TOKEN=${token}`;
    }

    fs.writeFileSync(envPath, envContent);

    // ── Print to terminal ──
    console.log("\n✅ ACCESS TOKEN CAPTURED AND SAVED TO .env!");
    console.log(`   Token: ${token}`);
    console.log("   Restart the server with: npm start\n");

    // ── Show success page ──
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Token Captured!</title>
          <style>
            body { font-family: sans-serif; max-width: 600px; margin: 80px auto; padding: 0 20px; }
            .box { background: #e8f5e9; border: 1px solid #4caf50; border-radius: 8px; padding: 24px; }
            code { background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-size: 13px; word-break: break-all; }
            h2 { color: #2e7d32; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>✅ Access Token Captured!</h2>
            <p>Your Admin API token has been saved automatically. You do <strong>not</strong> need to restart the server.</p>
            <p><strong>Token:</strong><br/><code>${token}</code></p>
            <p>You can now open the dashboard UI directly in your Shopify Admin or at <a href="/">the home page</a>.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("[AUTH ERROR]", err.message);
    res.status(500).send(`<pre>Error during token exchange:\n${err.message}</pre>`);
  }
});

module.exports = router;
