/**
 * routes/subscribe.js
 *
 * POST /api/subscribe
 * Public route — called directly from the Halo theme JavaScript.
 * No authentication required (storefront-facing).
 *
 * Body: { product_id: string, email: string, product_title: string }
 */

const express            = require("express");
const { getWaitlist, updateWaitlist } = require("../lib/shopify");

const router = express.Router();

// Simple email regex check
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// Handle CORS preflight explicitly for this route
router.options("/subscribe", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Bypass-Tunnel-Reminder");
  res.sendStatus(200);
});

router.post("/subscribe", async (req, res, next) => {
  // Force CORS headers on the actual response regardless of global config
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Bypass-Tunnel-Reminder");
  try {
    const { product_id, email, product_title } = req.body;

    // --- Validation ---
    if (!product_id || !email) {
      return res.status(400).json({
        success: false,
        error: "product_id and email are required.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid email address.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // --- Load existing waitlist ---
    const entries = await getWaitlist(product_id);

    // --- Prevent duplicate subscriptions ---
    // User is only a duplicate if they have an active "waiting" status.
    const alreadySubscribed = entries.some(
      (e) => e.email.toLowerCase() === normalizedEmail && e.status === "waiting"
    );
    if (alreadySubscribed) {
      return res.status(200).json({
        success: true,
        message: "You are already on the waitlist for this product.",
        duplicate: true,
      });
    }

    // --- Push new entry ---
    const newEntry = {
      email:         normalizedEmail,
      product_title: product_title || "Unknown Product",
      date:          new Date().toISOString().split("T")[0], // YYYY-MM-DD
      status:        "waiting",
    };

    entries.push(newEntry);

    // --- Save back to Shopify metafield ---
    await updateWaitlist(product_id, entries);

    console.log(`[SUBSCRIBE] ${normalizedEmail} → product ${product_id}`);

    return res.status(200).json({
      success: true,
      message: "You've been added to the waitlist! We'll notify you when it's back.",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
