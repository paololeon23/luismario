/* Configuración de Impulsa Financiera. */
(function (root) {
  var DEFAULT_API =
    "https://script.google.com/macros/s/AKfycbz3wsRn1frz1itfz919oh_KzI36ObxYezIdWpSpJfwCy82wn5C34ghm-zM_lGcB-zGJ/exec";
  var stored = "";
  try {
    stored = String((root.localStorage && root.localStorage.getItem("impulsa.apiUrl")) || "");
  } catch (err) {
    stored = "";
  }
  var meta = typeof document !== "undefined" ? document.querySelector('meta[name="impulsa-api"]') : null;
  var fromMeta = meta ? String(meta.getAttribute("content") || "").trim() : "";

  var fallback = typeof document !== "undefined" ? DEFAULT_API : "";
  root.ImpulsaConfig = {
    apiUrl: String(root.IMPULSA_API_URL || fromMeta || stored || fallback).trim(),
    pollMs: 0,
    timeoutMs: 22000,
    staleMs: 6000,
    retries: 1,
    moneda: "PEN",
    simbolo: "S/",
    empresa: "Impulsa Financiera",
  };
})(typeof window !== "undefined" ? window : globalThis);
