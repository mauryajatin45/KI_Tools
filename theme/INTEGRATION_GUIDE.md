# Theme Integration Guide — Halo Theme

## Step 1: Upload the JS Asset

1. Go to **Shopify Admin → Online Store → Themes**
2. Click **Actions → Edit code** on your duplicate Halo theme
3. In the left sidebar open **Assets**
4. Click **Add a new asset** → upload `waitlist-form.js`

---

## Step 2: Upload the Liquid Snippet

1. In the same code editor, open **Snippets**
2. Click **Add a new snippet** → name it `waitlist-form`
3. Paste the entire contents of `waitlist-form.liquid` and save

---

## Step 3: Set Your Server URL in the JS

Before uploading, open `waitlist-form.js` and replace:
```js
var APP_URL = "https://YOUR_APP_SERVER_URL";
```
with your live server URL, e.g.:
```js
var APP_URL = "https://your-app.railway.app";
```

---

## Step 4: Inject the Snippet into the Product Template

Open **Sections → main-product.liquid** (or whichever section Halo uses for the product form — search for `add-to-cart` to find it).

Find the block that renders the add-to-cart button and add the snippet **below it**, wrapped in an out-of-stock guard:

```liquid
{% comment %} ── Back-in-Stock Waitlist ── {% endcomment %}
{% unless product.available %}
  {% render 'waitlist-form' %}
{% endunless %}
```

Save and preview a product with **0 inventory** — the form should appear.

---

## Step 5: Test the Form

1. Set any product inventory to 0 in Shopify Admin
2. Visit that product page on the storefront
3. Enter your email and click **Notify Me**
4. Check the dashboard — the entry should appear under that product's ID

---

## Finding the Product ID

The product ID is the number at the end of the URL when you open a product:
```
https://admin.shopify.com/store/ki-tools-2/products/→ 8765432109876 ←
```
Use that number in the dashboard search field.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Form not visible | Check `{% unless product.available %}` guard is wrapping the snippet |
| "Network error" on submit | Verify `APP_URL` in the JS matches your server URL exactly (no trailing slash) |
| 403 from server | Check CORS — your store domain must be in the allowed origins list in `server.js` |
| Empty waitlist in dashboard | Confirm `SHOPIFY_ACCESS_TOKEN` in `.env` is correct |
