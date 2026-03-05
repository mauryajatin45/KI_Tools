/**
 * routes/waitlist.js
 *
 * Admin routes for the embedded dashboard.
 *
 * GET  /api/waitlists?product_id=<id>        — fetch waitlist for a product
 * GET  /api/waitlist/export-csv?product_id=<id> — download CSV of waiting subs
 * POST /api/waitlist/mark-sent               — body: { product_id }
 *                                              marks all "waiting" → "notified"
 */

const express = require("express");
const { getWaitlist, updateWaitlist, getAllWaitlists } = require("../lib/shopify");

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/waitlists?product_id=<id> (optional)
// Returns the JSON array for the given product, or ALL products if omitted.
// ---------------------------------------------------------------------------
router.get("/waitlists", async (req, res, next) => {
  try {
    const { product_id } = req.query;

    const entries = product_id 
      ? await getWaitlist(product_id) 
      : await getAllWaitlists();

    return res.status(200).json({
      success:    true,
      product_id: product_id || "all",
      count:      entries.length,
      waitlist:   entries,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/waitlist/export-csv?product_id=<id> (optional)
// Streams a CSV file containing all "waiting" subscribers.
// ---------------------------------------------------------------------------
router.get("/waitlist/export-csv", async (req, res, next) => {
  try {
    const { product_id } = req.query;

    const entries = product_id 
      ? await getWaitlist(product_id)
      : await getAllWaitlists();
    const waiting = entries.filter((e) => e.status === "waiting");

    // Build CSV
    const csvHeader = "Email,Product Title,Date Subscribed,Status\n";
    const csvRows = waiting
      .map((e) =>
        [
          `"${e.email}"`,
          `"${(e.product_title || "").replace(/"/g, '""')}"`,
          `"${e.date}"`,
          `"${e.status}"`,
        ].join(",")
      )
      .join("\n");

    const csv = csvHeader + csvRows;
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = product_id 
      ? `waitlist-${product_id}-${dateStr}.csv`
      : `waitlist-all-${dateStr}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/waitlist/mark-sent
// Body: { product_id: string } (optional)
// Updates every "waiting" entry to "notified".
// ---------------------------------------------------------------------------
router.post("/waitlist/mark-sent", async (req, res, next) => {
  try {
    const { product_id } = req.body;
    let updatedCount = 0;

    if (product_id) {
      // Update a single product
      const entries = await getWaitlist(product_id);
      
      const updated = entries.map((e) => {
        if (e.status === "waiting") {
          updatedCount++;
          return { ...e, status: "notified", notified_date: new Date().toISOString().split("T")[0] };
        }
        return e;
      });

      if (updatedCount > 0) {
        await updateWaitlist(product_id, updated);
      }
    } else {
      // Update ALL products
      const allEntries = await getAllWaitlists();
      
      // Group by product_id to minimize API calls
      const byProduct = {};
      allEntries.forEach(entry => {
        if (!byProduct[entry.product_id]) byProduct[entry.product_id] = [];
        byProduct[entry.product_id].push(entry);
      });

      // Update each product sequentially
      for (const [pid, entries] of Object.entries(byProduct)) {
        let productUpdatedCount = 0;
        const updated = entries.map((e) => {
          if (e.status === "waiting") {
            productUpdatedCount++;
            return { ...e, status: "notified", notified_date: new Date().toISOString().split("T")[0] };
          }
          return e;
        });

        if (productUpdatedCount > 0) {
          // Remove the injected product_id before saving back to metafield
          const cleanToSave = updated.map(e => {
            const { product_id, ...rest } = e;
            return rest;
          });
          
          await updateWaitlist(pid, cleanToSave);
          updatedCount += productUpdatedCount;
        }
      }
    }

    console.log(
      `[MARK-SENT] ${product_id ? `product=${product_id}` : "ALL"} → ${updatedCount} entries marked as notified`
    );

    return res.status(200).json({
      success: true,
      updated: updatedCount,
      message: `${updatedCount} subscriber(s) marked as notified.`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
