const GEMINI_API_BASE = [
  "https://generativelanguage.googleapis.com",
  "v1beta",
  "models",
  "gemini-3.7-flash:generateContent"
].join("/");

const DEFAULT_MODEL_LABEL = "gemini-3.7-flash";

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Configuración incompleta: falta GEMINI_API_KEY en las variables de entorno."
    );
  }

  return apiKey;
}

function sanitizeForPrompt(value) {
  if (typeof value !== "string") {
    return "";
  }

  const scriptPattern = new RegExp(
    String.raw`<script[\s\S]*?>[\s\S]*?<\/script>`,
    "gi"
  );

  const htmlTagPattern = new RegExp(
    String.raw`<[^>]*>`,
    "g"
  );

  return value
    .replace(scriptPattern, "")
    .replace(htmlTagPattern, "")
    .replace(/[{}[\]<>]/g, "")
    .trim();
}

function buildGeminiPrompt({
  name,
  email,
  categoryLabel,
  message,
  aiRoute,
  knowledgeContext
}) {
  const safeName = sanitizeForPrompt(name);
  const safeEmail = sanitizeForPrompt(email);
  const safeCategory = sanitizeForPrompt(categoryLabel);
  const safeMessage = sanitizeForPrompt(message);
  const safeAiRoute = sanitizeForPrompt(aiRoute);

  return `
Eres el asistente de soporte de Hábitos con Dios.

Tu tarea es redactar una respuesta clara, cálida, profesional y responsable para una persona que completó el formulario del Centro de Ayuda.

IMPORTANTE:
- Responde siempre en español.
- Usa un tono cálido, amable y humano.
- No uses lenguaje frío, robótico ni excesivamente técnico.
- No inventes información.
- Usa únicamente la información contenida en la Base de Conocimiento.
- Si corresponde, incluye una ruta guiada.
- Si la consulta requiere revisión humana, indícalo con claridad y cariño.
- Si la consulta es sensible, aplica el disclaimer adecuado.
- Nunca des diagnóstico médico, psicológico, legal, financiero ni profesional.
- Nunca prometas resultados garantizados.
- Nunca minimices situaciones de riesgo.
- Si hay señales de peligro, violencia, abuso, amenazas o autolesión, recomienda buscar ayuda inmediata de una persona segura, profesional calificado o autoridad local.

DATOS DE LA CONSULTA:
Nombre: ${safeName}
Correo: ${safeEmail}
Categoría: ${safeCategory}
Ruta interna IA: ${safeAiRoute}

MENSAJE DEL USUARIO:
${safeMessage}

BASE DE CONOCIMIENTO DISPONIBLE:
${knowledgeContext}

INSTRUCCIONES DE RESPUESTA:
1. Comienza agradeciendo el mensaje.
2. Responde de forma útil y concreta.
3. Si es una consulta de acceso, primero indica que valide si está usando el mismo correo electrónico de la compra.
4. Si aplica, incluye una ruta breve de navegación.
5. Si el caso requiere revisión humana, explica qué datos mínimos debería compartir.
6. Si corresponde disclaimer, inclúyelo de forma cálida.
7. No menciones archivos JSON, módulos internos ni detalles técnicos del sistema.
8. No digas que eres una IA.
9. Devuelve solamente el texto final del correo para el usuario.
`;
}

async function generateGeminiResponse({
  name,
  email,
  categoryLabel,
  message,
  aiRoute,
  knowledgeContext
}) {
  const apiKey = getGeminiApiKey();

  const prompt = buildGeminiPrompt({
    name,
    email,
    categoryLabel,
    message,
    aiRoute,
    knowledgeContext
  });

  const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 700
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      data?.error?.message ||
      data?.message ||
      "No se pudo generar la respuesta con Gemini.";

    throw new Error(errorMessage);
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!text.trim()) {
    throw new Error("Gemini no devolvió una respuesta válida.");
  }

  return {
    provider: "gemini",
    model: DEFAULT_MODEL_LABEL,
    text: text.trim()
  };
}

module.exports = {
  generateGeminiResponse
};
