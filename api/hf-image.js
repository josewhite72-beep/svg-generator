// api/hf-image.js
// Funcion serverless de Vercel: el navegador le habla a esta funcion (mismo origen,
// nunca hay CORS), y esta funcion (que corre en el servidor, no en el navegador)
// le habla a Hugging Face sin ninguna restriccion de CORS.
// Vercel detecta automaticamente cualquier archivo en /api y lo despliega como
// funcion, sin configuracion adicional - no rompe el flujo de "subir y listo".

function describeError(e, depth) {
  if (!e || depth > 4) return null;
  return {
    message: String(e.message || e),
    name: e.name || null,
    code: e.code || null,
    cause: describeError(e.cause, (depth || 0) + 1),
  };
}

export default async function handler(req, res) {
  // Diagnostico rapido: abre esta URL directo en el navegador (sin la app) para
  // confirmar que la funcion esta viva y que el entorno tiene fetch disponible.
  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      mensaje: "La funcion esta viva. Esto deberia decir true:",
      fetchDisponible: typeof fetch === "function",
      nodeVersion: process.version,
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  const { prompt, model, token } = req.body || {};
  if (!prompt || !token) {
    res.status(400).json({ error: "Falta prompt o token" });
    return;
  }
  const hfModel = model || "black-forest-labs/FLUX.1-schnell";

  try {
    const hfRes = await fetch("https://router.huggingface.co/hf-inference/models/" + hfModel, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    const contentType = hfRes.headers.get("content-type") || "";

    if (!hfRes.ok) {
      const text = await hfRes.text();
      let payload;
      try { payload = JSON.parse(text); } catch (e) { payload = { error: text || ("Error " + hfRes.status) }; }
      res.status(hfRes.status).json(payload);
      return;
    }

    if (contentType.includes("application/json")) {
      // Algunos modelos devuelven JSON (p.ej. estado) incluso con 200; lo reenviamos tal cual.
      const data = await hfRes.json();
      res.status(200).json(data);
      return;
    }

    const arrayBuf = await hfRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    res.status(200).json({ image_base64: base64, content_type: contentType || "image/jpeg" });
  } catch (err) {
    const detail = describeError(err, 0);
    res.status(500).json({
      error: "fetch failed",
      detail: detail,
      fetchDisponible: typeof fetch === "function",
      nodeVersion: process.version,
    });
  }
}
