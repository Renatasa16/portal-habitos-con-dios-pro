const SUPABASE_REST_URL =
  `${process.env.SUPABASE_URL}/rest/v1/support_cases`;

function setSecurityHeaders(res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://portal.skoolrenovae.store"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );
}

function isValidCaseId(value) {
  if (value === null || value === undefined) {
    return false;
  }

  return /^\d+$/.test(String(value).trim());
}

function sanitizeMessage(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[{}[\]<>]/g, "")
    .trim();
}

function getSupabaseHeaders(extraHeaders = {}) {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extraHeaders
  };
}

function hasRequiredConfiguration() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function getCaseById(id) {
  const query =
    `${SUPABASE_REST_URL}` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=id,case_id,name,email,product,category,question,response,escalated,escalation_message,escalated_at,created_at` +
    `&limit=1`;

  const response = await fetch(query, {
    method: "GET",
    headers: getSupabaseHeaders()
  });

  const data = await response
    .json()
    .catch(() => []);

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      "No pudimos consultar el caso.";

    throw new Error(message);
  }

  return Array.isArray(data) && data.length
    ? data[0]
    : null;
}

async function updateEscalation({
  id,
  escalationMessage
}) {
  const query =
    `${SUPABASE_REST_URL}` +
    `?id=eq.${encodeURIComponent(id)}`;

  const response = await fetch(query, {
    method: "PATCH",
    headers: getSupabaseHeaders({
      Prefer: "return=representation"
    }),
    body: JSON.stringify({
      escalated: true,
      escalation_message: escalationMessage,
      escalated_at: new Date().toISOString()
    })
  });

  const data = await response
    .json()
    .catch(() => []);

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      "No pudimos actualizar el caso.";

    throw new Error(message);
  }

  return Array.isArray(data) && data.length
    ? data[0]
    : null;
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({
      ok: true
    });
  }

  if (!hasRequiredConfiguration()) {
    return res.status(500).json({
      ok: false,
      message:
        "La configuración privada de Supabase está incompleta."
    });
  }

  try {
    if (req.method === "GET") {
      const id =
        typeof req.query?.id === "string"
          ? req.query.id.trim()
          : "";

      if (!isValidCaseId(id)) {
        return res.status(400).json({
          ok: false,
          message:
            "El identificador del caso no es válido."
        });
      }

      const supportCase =
        await getCaseById(id);

      if (!supportCase) {
        return res.status(404).json({
          ok: false,
          message:
            "No encontramos el caso solicitado."
        });
      }

      return res.status(200).json({
        ok: true,
        case: supportCase
      });
    }

    if (req.method === "POST") {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : req.body || {};

      const id =
        typeof body.id === "string"
          ? body.id.trim()
          : "";

      const escalationMessage =
        sanitizeMessage(
          body.escalation_message
        );

      if (!isValidCaseId(id)) {
        return res.status(400).json({
          ok: false,
          message:
            "El identificador del caso no es válido."
        });
      }

      if (
        !escalationMessage ||
        escalationMessage.length < 10
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Cuéntanos con un poco más de detalle qué información sigues necesitando."
        });
      }

      if (escalationMessage.length > 2000) {
        return res.status(400).json({
          ok: false,
          message:
            "El mensaje es demasiado extenso. Por favor resume la información que sigues necesitando."
        });
      }

      const existingCase =
        await getCaseById(id);

      if (!existingCase) {
        return res.status(404).json({
          ok: false,
          message:
            "No encontramos el caso que deseas escalar."
        });
      }

      const updatedCase =
        await updateEscalation({
          id,
          escalationMessage
        });

      if (!updatedCase) {
        return res.status(500).json({
          ok: false,
          message:
            "No pudimos confirmar la actualización del caso."
        });
      }

      return res.status(200).json({
        ok: true,
        message:
          "Tu caso fue escalado correctamente.",
        case: {
          id: updatedCase.id,
          case_id: updatedCase.case_id,
          escalated: updatedCase.escalated,
          escalated_at:
            updatedCase.escalated_at
        }
      });
    }

    return res.status(405).json({
      ok: false,
      message:
        "Método no permitido. Usa GET o POST."
    });
  } catch (error) {
    console.error(
      "Error en api/escalation:",
      error
    );

    return res.status(500).json({
      ok: false,
      message:
        "No pudimos procesar el escalamiento en este momento."
    });
  }
};
