require("dotenv").config();
const fetch = require("node-fetch");
const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
async function test() {
  const url = `https://${STORE}/admin/api/2024-04/metafields.json?namespace=custom&key=waitlist_subscribers`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
