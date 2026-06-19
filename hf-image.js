// api/hf-image.js
// Funcion serverless de Vercel: el navegador le habla a esta funcion (mismo origen,
// nunca hay CORS), y esta funcion (que corre en el servidor, no en el navegador)
// le habla a Hugging Face sin ninguna restriccion de CORS.
// Vercel detecta automaticamente cualquier archivo en /api y lo despliega como
// funcion, sin configuracion adicional - no rompe el flujo de "subir y listo".

export default async function handler(req, res) {
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
    const hfRes = await fetch("https://api-inference.huggingface.co/models/" + hfModel, {
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
    res.status(500).json({ error: String((err && err.message) || err) });
  }
}
