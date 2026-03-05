/**
 * lib/shopify.js — Shopify Admin REST API helpers
 *
 * All metafield operations for the waitlist are centralised here.
 * Metafield spec:
 *   namespace : custom
 *   key       : waitlist_subscribers
 *   type      : json
 *   owner     : Product
 *
 * Value shape (array of objects):
 *   [
 *     {
 *       "email"         : "user@example.com",
 *       "product_title" : "Blue Sneakers",
 *       "date"          : "2026-03-05",
 *       "status"        : "waiting" | "notified"
 *     }
 *   ]
 */

const fetch = require("node-fetch");

const STORE   = process.env.SHOPIFY_STORE_DOMAIN;
const API_VER = "2024-04"; // stable Shopify API version

const NAMESPACE = "custom";
const KEY       = "waitlist_subscribers";

// ---------------------------------------------------------------------------
// Internal: base headers for every Admin API request
// ---------------------------------------------------------------------------
function adminHeaders() {
  return {
    "Content-Type":              "application/json",
    "X-Shopify-Access-Token":    process.env.SHOPIFY_ACCESS_TOKEN,
  };
}

// ---------------------------------------------------------------------------
// Internal: find the metafield record for a product (returns null if missing)
// ---------------------------------------------------------------------------
async function findMetafield(productId) {
  const url = `https://${STORE}/admin/api/${API_VER}/products/${productId}/metafields.json?namespace=${NAMESPACE}&key=${KEY}`;
  const res  = await fetch(url, { headers: adminHeaders() });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify GET metafields failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  // Returns the first matching metafield or null
  return data.metafields && data.metafields.length > 0
    ? data.metafields[0]
    : null;
}

// ---------------------------------------------------------------------------
// getWaitlist(productId) → Array of subscriber objects (empty [] if none)
// ---------------------------------------------------------------------------
async function getWaitlist(productId) {
  const mf = await findMetafield(productId);
  if (!mf) return [];

  try {
    const parsed = typeof mf.value === "string" ? JSON.parse(mf.value) : mf.value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// getAllWaitlists() → Array of all subscriber objects across ALL products
// Uses GraphQL for efficiency to scan all products.
// ---------------------------------------------------------------------------
async function getAllWaitlists() {
  const url = `https://${STORE}/admin/api/${API_VER}/graphql.json`;
  let allEntries = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const query = `
      query getProductsWithWaitlists($cursor: String) {
        products(first: 250, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
                value
              }
            }
          }
        }
      }
    `;

    const body = JSON.stringify({
      query,
      variables: { cursor }
    });

    const res = await fetch(url, { method: "POST", headers: adminHeaders(), body });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify GraphQL failed (${res.status}): ${text}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(`GraphQL Errors: ${JSON.stringify(json.errors)}`);
    }

    const data = json.data.products;
    hasNextPage = data.pageInfo.hasNextPage;
    cursor = data.pageInfo.endCursor;

    // Process nodes
    for (const edge of data.edges) {
      const node = edge.node;
      if (node.metafield && node.metafield.value) {
        try {
          const parsed = typeof node.metafield.value === "string" 
            ? JSON.parse(node.metafield.value) 
            : node.metafield.value;
            
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Ensure we have product_id on each entry for bulk actions later if needed
            const gidParts = node.id.split("/");
            const numericId = gidParts[gidParts.length - 1]; // e.g. "gid://shopify/Product/123" -> "123"
            
            const entriesWithProductId = parsed.map(e => ({
              ...e,
              product_id: numericId // Add product ID directly into the entry so dashboard doesn't lose it
            }));
            
            allEntries = allEntries.concat(entriesWithProductId);
          }
        } catch (err) {
          console.error(`Failed to parse metafield for product ${node.id}:`, err);
        }
      }
    }
  }

  return allEntries;
}

// ---------------------------------------------------------------------------
// updateWaitlist(productId, entries) → saves the full array back to Shopify
// ---------------------------------------------------------------------------
async function updateWaitlist(productId, entries) {
  const existing = await findMetafield(productId);

  if (existing) {
    // Update existing metafield
    const url  = `https://${STORE}/admin/api/${API_VER}/products/${productId}/metafields/${existing.id}.json`;
    const body = JSON.stringify({
      metafield: {
        id:    existing.id,
        value: JSON.stringify(entries),
        type:  "json",
      },
    });

    const res = await fetch(url, { method: "PUT", headers: adminHeaders(), body });
    if (!res.ok) {
      const rb = await res.text();
      throw new Error(`Shopify PUT metafield failed (${res.status}): ${rb}`);
    }
  } else {
    // Create new metafield
    const url  = `https://${STORE}/admin/api/${API_VER}/products/${productId}/metafields.json`;
    const body = JSON.stringify({
      metafield: {
        namespace: NAMESPACE,
        key:       KEY,
        value:     JSON.stringify(entries),
        type:      "json",
      },
    });

    const res = await fetch(url, { method: "POST", headers: adminHeaders(), body });
    if (!res.ok) {
      const rb = await res.text();
      throw new Error(`Shopify POST metafield failed (${res.status}): ${rb}`);
    }
  }

  return entries;
}

module.exports = { getWaitlist, updateWaitlist, getAllWaitlists };
