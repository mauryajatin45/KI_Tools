# Shopify Back-in-Stock Waitlist App

A private embedded app for **ki-tools-2.myshopify.com** that captures customer emails when a product is out of stock, stores them in Shopify metafields, and lets the admin manage and export the list — all without any third-party services.

---

## Project Structure

```
KI_Tools/
├── .env                      ← Shopify credentials (never commit this)
├── package.json              ← Backend dependencies
├── server.js                 ← Express entry point
├── lib/
│   └── shopify.js            ← Admin API metafield helper
├── routes/
│   ├── subscribe.js          ← POST /api/subscribe (public)
│   └── waitlist.js           ← GET/POST waitlist routes (admin)
├── theme/
│   ├── waitlist-form.liquid  ← Paste into Halo product template
│   ├── waitlist-form.js      ← Upload to Shopify Assets
│   └── INTEGRATION_GUIDE.md ← Step-by-step theme setup
└── dashboard/                ← React + Polaris admin UI
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── pages/
            └── WaitlistPage.jsx
```

---

## ⚙️ Setup

### 1. Get Your Admin API Access Token

> This is the **most important step** — without it the server cannot read/write metafields.

1. Go to [partners.shopify.com](https://partners.shopify.com) → your app
2. Click **API credentials**
3. Under **Admin API access token** → click **"Reveal token once"**
4. Copy it immediately (it's shown only once)

### 2. Configure `.env`

Open `.env` and fill in the token and confirm the other values:

```env
SHOPIFY_API_KEY=9b73973c405f2771f8c95d527bff2c38
SHOPIFY_API_SECRET=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
SHOPIFY_STORE_DOMAIN=ki-tools-2.myshopify.com
SHOPIFY_ACCESS_TOKEN=YOUR_ADMIN_API_ACCESS_TOKEN   ← paste here
PORT=3000
```

### 3. Install & Run the Backend

```bash
# From /KI_Tools root:
npm install
npm start          # production
npm run dev        # with auto-reload (nodemon)
```

Server starts at: `http://localhost:3000`  
Health check: `http://localhost:3000/health`

### 4. Run the Dashboard (local dev)

```bash
cd dashboard
npm install
npm run dev
```

Dashboard at: `http://localhost:5173`

> The Vite proxy forwards `/api/*` to `localhost:3000` automatically — no CORS issues in dev.

---

## 🌐 API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Server health check |
| POST | `/api/subscribe` | None | Add email to a product's waitlist |
| GET | `/api/waitlists?product_id=X` | None* | Fetch waitlist JSON |
| GET | `/api/waitlist/export-csv?product_id=X` | None* | Download CSV |
| POST | `/api/waitlist/mark-sent` | None* | Mark all waiting → notified |

> *Admin routes should be behind a reverse proxy or VPN in production.

### POST `/api/subscribe` — Request Body

```json
{
  "product_id": "8765432109876",
  "email": "customer@example.com",
  "product_title": "Blue Sneakers"
}
```

---

## 🎨 Theme Integration

See **[theme/INTEGRATION_GUIDE.md](./theme/INTEGRATION_GUIDE.md)** for full step-by-step instructions.

**Quick summary:**
1. Upload `theme/waitlist-form.js` to Shopify → Assets
2. Create snippet `waitlist-form` with contents of `theme/waitlist-form.liquid`
3. Edit `waitlist-form.js` → set `APP_URL` to your deployed server URL
4. In `main-product.liquid`, add below buy button: `{% unless product.available %}{% render 'waitlist-form' %}{% endunless %}`

---

## 📋 Metafield Data Structure

Stored per product under `custom.waitlist_subscribers` (type: `json`):

```json
[
  {
    "email": "customer@example.com",
    "product_title": "Blue Sneakers",
    "date": "2026-03-05",
    "status": "waiting",
    "notified_date": null
  }
]
```

Status values: `"waiting"` → `"notified"` (set by Mark All as Sent)

---

## 📧 SOP: Sending Restock Notifications (for Atul)

> **No third-party email tools needed.** Use Shopify Email natively.

**When a product is restocked:**

1. Open the **Embedded Waitlist Dashboard** in Shopify Admin
2. Enter the Product ID and click **Load Waitlist**
3. Click **Export Waiting List (CSV)** — a file downloads
4. Go to **Shopify Admin → Customers → Import** — import the CSV, tag customers `restock_alert`
5. Open **Shopify Email** → create a new campaign → select your "Back in Stock" template → send to the `restock_alert` customer segment
6. Return to the Dashboard → click **Mark All as Notified**

---

## 🧪 Test with curl

```bash
# Subscribe
curl -X POST http://localhost:3000/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"product_id":"123","email":"test@example.com","product_title":"Test Product"}'

# View waitlist
curl http://localhost:3000/api/waitlists?product_id=123

# Export CSV
curl "http://localhost:3000/api/waitlist/export-csv?product_id=123" -o waitlist.csv

# Mark all as notified
curl -X POST http://localhost:3000/api/waitlist/mark-sent \
  -H "Content-Type: application/json" \
  -d '{"product_id":"123"}'
```

---

## 🚀 Deployment (Railway / Render)

1. Push this repo to GitHub (exclude `.env` via `.gitignore`)
2. Create a new project on [Railway](https://railway.app) → deploy from GitHub
3. Add all `.env` keys as environment variables in Railway's dashboard
4. Note the public URL (e.g. `https://ki-tools-waitlist.up.railway.app`)
5. Update `APP_URL` in `theme/waitlist-form.js` to this URL
6. Update `allowedOrigins` in `server.js` if needed

---

## 🔒 .gitignore

```gitignore
node_modules/
.env
dashboard/node_modules/
dashboard/dist/
```
