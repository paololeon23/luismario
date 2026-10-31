/* Configuración de Impulsa Financiera. Pegue aquí la URL del Web App de Apps Script cuando esté publicada.
   No ponga claves secretas. El sistema funciona en local si apiUrl está vacío. */
(function (root) {
  var stored = "";
  try {
    stored = String((root.localStorage && root.localStorage.getItem("impulsa.apiUrl")) || "");
  } catch (err) {
    stored = "";
  }
  var meta = typeof document !== "undefined" ? document.querySelector('meta[name="impulsa-api"]') : null;
  var fromMeta = meta ? String(meta.getAttribute("content") || "").trim() : "";

  root.ImpulsaConfig = {
    apiUrl: String(root.IMPULSA_API_URL || stored || fromMeta || "").trim(),
    pollMs: 12000,
    timeoutMs: 25000,
    staleMs: 4000,
    retries: 1,
    moneda: "PEN",
    simbolo: "S/",
    empresa: "Impulsa Financiera",
  };
})(typeof window !== "undefined" ? window : globalThis);
