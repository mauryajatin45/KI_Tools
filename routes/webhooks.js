const express = require("express");
const router = express.Router();

/**
 * POST /webhooks/inventory
 * Triggered by Shopify when an inventory level changes.
 */
router.post("/inventory", async (req, res, next) => {
  try {
    const { inventory_item_id, available } = req.body;

    console.log(`[WEBHOOK] Inventory Update | Item: ${inventory_item_id} | Available: ${available}`);

    // If inventory is not positive, we don't care
    if (available <= 0) {
      return res.status(200).send("No restock needed.");
    }

    // 1. We need the actual Product ID. The webhook gives us inventory_item_id.
    // Let's use the Admin API to get the Product ID linked to this inventory item.
    const { getProductIdFromInventoryItem, getWaitlist, updateWaitlist } = require("../lib/shopify");
    const productId = await getProductIdFromInventoryItem(inventory_item_id);

    if (!productId) {
      console.log(`[WEBHOOK] Could not find Product ID for inventory item: ${inventory_item_id}`);
      return res.status(200).send("Product not found.");
    }

    console.log(`[WEBHOOK] Stock increased for Product ${productId}. Checking waitlist...`);

    // 2. Fetch the waitlist
    const entries = await getWaitlist(productId);
    
    // 3. Filter for subscribers with status: "waiting"
    const waitingSubscribers = entries.filter((e) => e.status === "waiting");

    if (waitingSubscribers.length === 0) {
      console.log(`[WEBHOOK] No one is waiting for Product ${productId}.`);
      return res.status(200).send("No subscribers.");
    }

    console.log(`[WEBHOOK] Found ${waitingSubscribers.length} subscribers waiting. Sending emails...`);

    // 4. Send emails via Resend
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    for (let subscriber of waitingSubscribers) {
      if (process.env.RESEND_API_KEY) {
        try {
          await resend.emails.send({
            from: 'Restock Alert <onboarding@resend.dev>', // UPDATE THIS AFTER DOMAIN VERIFICATION
            to: subscriber.email,
            subject: `Good news! ${subscriber.product_title} is back in stock`,
            html: `<p>Hi there,</p><p>You asked us to notify you when <strong>${subscriber.product_title}</strong> is back in stock.</p><p>Good news – it's available now!</p><p>Visit our store to grab yours before it sells out again.</p>`
          });
          console.log(`[EMAIL] Sent to ${subscriber.email}`);
        } catch (err) {
          console.error(`[EMAIL ERROR] Failed to send to ${subscriber.email}`, err);
        }
      } else {
        console.log(`[EMAIL STUB] Would have sent email to ${subscriber.email}, but RESEND_API_KEY is missing.`);
      }

      // Mark as notified whether it actually sent or was stubbed (to prevent spam loops)
      subscriber.status = "notified";
    }

    // 5. Save the updated waitlist back to Shopify
    await updateWaitlist(productId, entries);
    console.log(`[WEBHOOK] Waitlist for Product ${productId} updated to 'notified'.`);

    return res.status(200).send("Webhook processed successfully.");
  } catch (err) {
    console.error("[WEBHOOK ERROR]", err);
    // Always return 200 to Shopify so it doesn't retry endlessly
    return res.status(200).send("Error processed.");
  }
});

module.exports = router;
