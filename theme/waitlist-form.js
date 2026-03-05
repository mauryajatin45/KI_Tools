/**
 * waitlist-form.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles back-in-stock form submission for the Halo theme.
 * Upload this file to: Shopify Admin → Themes → Assets → waitlist-form.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * IMPORTANT: Replace the APP_URL below with your deployed Node.js server URL.
 * Example: "https://your-app.railway.app" or your ngrok URL during local dev.
 */

(function () {
  "use strict";

  // ── CONFIG ─────────────────────────────────────────────────────────────────
  var APP_URL = "https://kitools-waitlist-test.loca.lt";
  // ───────────────────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", function () {
    var form       = document.getElementById("waitlist-form");
    var emailInput = document.getElementById("waitlist-email");
    var submitBtn  = document.getElementById("waitlist-submit");
    var btnText    = submitBtn && submitBtn.querySelector(".waitlist-btn-text");
    var btnLoading = submitBtn && submitBtn.querySelector(".waitlist-btn-loading");
    var msgEl      = document.getElementById("waitlist-message");

    if (!form) return; // snippet not on this page

    function setMessage(text, type) {
      msgEl.textContent    = text;
      msgEl.className      = "waitlist-message " + type;
    }

    function setLoading(loading) {
      submitBtn.disabled       = loading;
      btnText.style.display    = loading ? "none"   : "inline";
      btnLoading.style.display = loading ? "inline" : "none";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var email = emailInput.value.trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setMessage("Please enter a valid email address.", "error");
        emailInput.focus();
        return;
      }

      var productId    = form.dataset.productId;
      var productTitle = form.dataset.productTitle;

      setLoading(true);
      setMessage("", "");

      fetch(APP_URL + "/api/subscribe", {
        method:  "POST",
        headers: { 
          "Content-Type": "application/json",
          "Bypass-Tunnel-Reminder": "true" 
        },
        body:    JSON.stringify({
          product_id:    productId,
          email:         email,
          product_title: productTitle,
        }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          setLoading(false);
          if (data.success) {
            setMessage(data.message || "You're on the list! We'll notify you when it's back.", "success");
            form.reset();
            // Optionally hide the form after success
            // form.style.display = "none";
          } else {
            setMessage(data.error || "Something went wrong. Please try again.", "error");
          }
        })
        .catch(function () {
          setLoading(false);
          setMessage("Network error. Please check your connection and try again.", "error");
        });
    });
  });
})();
