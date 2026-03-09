const express = require("express");
const crypto = require("crypto");
const router = express.Router();

/**
 * POST /webhooks/inventory
 * Triggered by Shopify when an inventory level changes.
 * 
 * NOTE: Express usually parses JSON for us, but for HMAC validation
 * we technically need the raw body. Since we already have express.json()
 * globally in server.js, we will stringify it back for the validation.
 * In a perfect world, we'd use `express.raw({type: 'application/json'})` 
 * just for this route.
 */
router.post("/inventory", async (req, res) => {
  try {
    // --- HMAC SECURITY VERIFICATION ---
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

    if (secret && hmacHeader) {
      // Use the raw byte buffer captured in server.js to guarantee the exact byte string
      // Shopify used to sign the payload. Re-stringifying parsed JSON almost always fails.
      const rawBodyBuffer = req.rawBody || "";
      
      const generatedHash = crypto
        .createHmac("sha256", secret)
        .update(rawBodyBuffer, "utf8")
        .digest("base64");

      if (generatedHash !== hmacHeader) {
        console.error("[WEBHOOK] HMAC Validation Failed! Ignoring request.");
        return res.status(401).send("Unauthorized");
      }
    } else {
      console.warn("[WEBHOOK] Warning: No HMAC header or SHOPIFY_WEBHOOK_SECRET provided. Skipping verification.");
    }
    // --- END SECURITY VERIFICATION ---

    const { inventory_item_id, available } = req.body;

    console.log(`[WEBHOOK] Inventory Update | Item: ${inventory_item_id} | Available: ${available}`);

    // If inventory is not positive, we don't care
    if (available <= 0) {
      return res.status(200).send("No restock needed.");
    }

    // 1. We need the actual Product ID. The webhook gives us inventory_item_id.
    // Let's use the Admin API to get the Product ID linked to this inventory item.
    const { getProductIdFromInventoryItem, getWaitlist, updateWaitlist, getProductDetails } = require("../lib/shopify");
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

    // Fetch Rich Product Info for Email Template
    const productDetails = await getProductDetails(productId);
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const productUrl = productDetails 
      ? `https://${storeDomain}/products/${productDetails.handle}`
      : `https://${storeDomain}`;

    const generateHtmlEmail = (subscriber) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; padding: 20px; text-align: center; margin: 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
          h1 { color: #111111; font-size: 26px; margin-bottom: 10px; }
          p { color: #555555; font-size: 16px; line-height: 1.6; margin-bottom: 25px; }
          .product-img { max-width: 100%; max-height: 350px; border-radius: 8px; margin: 0 auto 25px; display: block; object-fit: cover; }
          .btn { display: inline-block; background-color: #000000; color: #ffffff !important; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: bold; font-size: 16px; margin-top: 10px; }
          .footer { margin-top: 40px; font-size: 13px; color: #999999; border-top: 1px solid #eeeeee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Good news! It's back.</h1>
          <p>You asked us to notify you when <strong>${subscriber.product_title}</strong> is restocked.</p>
          ${productDetails && productDetails.imageUrl ? `<img src="${productDetails.imageUrl}" alt="${subscriber.product_title}" class="product-img" />` : ''}
          <p>It is now available for purchase, but hurry before it sells out again!</p>
          <a href="${productUrl}" class="btn">Shop Now</a>
          <div class="footer">You received this email because you joined the waitlist for this product on our store.</div>
        </div>
      </body>
      </html>
    `;

    for (let subscriber of waitingSubscribers) {
      if (process.env.RESEND_API_KEY) {
        try {
          const resendResponse = await resend.emails.send({
            from: 'Restock Notifications <notifications@project.terzettoo.com>', // Using your verified domain
            to: subscriber.email,
            subject: `Good news! ${subscriber.product_title} is back in stock`,
            html: generateHtmlEmail(subscriber)
          });
          
          if (resendResponse.error) {
            console.error(`[EMAIL ERROR] Resend fully rejected message to ${subscriber.email}:`, resendResponse.error);
            subscriber.status = "failed";
          } else {
            console.log(`[EMAIL] Successfully sent to ${subscriber.email}. Resend ID: ${resendResponse.data?.id}`);
            subscriber.status = "notified";
            subscriber.notified_date = new Date().toISOString().split("T")[0]; // Store the date
          }
        } catch (err) {
          console.error(`[EMAIL CATCH ERROR] Exception while sending to ${subscriber.email}:`, err);
          subscriber.status = "failed";
        }
      } else {
        console.log(`[EMAIL STUB] Would have sent email to ${subscriber.email}, but RESEND_API_KEY is missing.`);
        subscriber.status = "notified"; // Still mark notified in stub mode so they don't get spammed later
        subscriber.notified_date = new Date().toISOString().split("T")[0]; // Store the date
      }
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
