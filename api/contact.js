const RESEND_API_URL = "https://api.resend.com/emails";

const BRAND_NAME = "Hábitos con Dios";
const FROM_EMAIL = "soporte@skoolrenovae.store";

// Recomendado: configurar CONTACT_TO_EMAIL en Vercel con tu correo actual.
// Si todavía no existe, el endpoint devolverá un error de configuración claro.
const TO_EMAIL = process.env.CONTACT_TO_EMAIL;

const ALLOWED_CATEGORIES = {
  soporte_acceso: {
    label: "Soporte para acceso",
    priority: "Alta",
    aiRoute: "access_support",
  },
  consulta_producto: {
    label: "Consulta sobre productos",
    priority: "Media",
    aiRoute: "product_inquiry",
  },
  consulta_general: {
    label: "Consulta general",
    priority: "Normal",
    aiRoute: "general_inquiry",
  },
};

function setSecurityHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");
}

function sanitizeText(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;

  const cleanEmail = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(cleanEmail);
}

function escapeHtml(value) {
  if (typeof value !== "string") return "";

  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCategoryData(category) {
  return ALLOWED_CATEGORIES[category] || null;
}

function buildInternalEmailTemplate({
  name,
  email,
  categoryLabel,
  priority,
  message,
  aiRoute,
}) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeCategory = escapeHtml(categoryLabel);
  const safePriority = escapeHtml(priority);
  const safeMessage = escapeHtml(message);
  const safeAiRoute = escapeHtml(aiRoute);

  return `
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Nueva consulta - ${BRAND_NAME}</title>
    </head>
    <body style="margin:0; padding:0; background:#f7f2ea; font-family:Arial, Helvetica, sans-serif; color:#2f2a24;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ea; padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px; background:#fffdf8; border-radius:22px; overflow:hidden; border:1px solid #eadfce; box-shadow:0 18px 45px rgba(69, 49, 25, 0.10);">
              
              <tr>
                <td style="background:linear-gradient(135deg, #315c4b 0%, #6f8f72 100%); padding:34px 32px; text-align:left;">
                  <div style="font-size:13px; text-transform:uppercase; letter-spacing:1.8px; color:#f3e8d3; font-weight:700;">
                    Centro de Ayuda
                  </div>
                  <h1 style="margin:10px 0 0; color:#ffffff; font-size:28px; line-height:1.25; font-weight:700;">
                    Nueva consulta recibida
                  </h1>
                  <p style="margin:12px 0 0; color:#f8f2e8; font-size:15px; line-height:1.6;">
                    Una usuaria completó el formulario de contacto de ${BRAND_NAME}.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:0 0 18px;">
                        <div style="display:inline-block; padding:8px 14px; background:#efe7d8; border-radius:999px; color:#5f4a2b; font-size:13px; font-weight:700;">
                          ${safeCategory}
                        </div>
                        <div style="display:inline-block; margin-left:8px; padding:8px 14px; background:#f4eee3; border-radius:999px; color:#315c4b; font-size:13px; font-weight:700;">
                          Prioridad: ${safePriority}
                        </div>
                      </td>
                    </tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:0 12px;">
                    <tr>
                      <td style="background:#faf6ee; padding:18px 20px; border-radius:16px; border:1px solid #eadfce;">
                        <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#8a7456; font-weight:700; margin-bottom:6px;">
                          Nombre
                        </div>
                        <div style="font-size:16px; color:#2f2a24; font-weight:600;">
                          ${safeName}
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td style="background:#faf6ee; padding:18px 20px; border-radius:16px; border:1px solid #eadfce;">
                        <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#8a7456; font-weight:700; margin-bottom:6px;">
                          Correo electrónico
                        </div>
                        <div style="font-size:16px; color:#2f2a24; font-weight:600;">
                          ${safeEmail}
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td style="background:#ffffff; padding:22px 20px; border-radius:16px; border:1px solid #eadfce;">
                        <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#8a7456; font-weight:700; margin-bottom:10px;">
                          Mensaje
                        </div>
                        <div style="font-size:16px; color:#2f2a24; line-height:1.75; white-space:pre-line;">
                          ${safeMessage}
                        </div>
                      </td>
                    </tr>
                  </table>

                  <div style="margin-top:24px; padding:18px 20px; background:#f3eee5; border-radius:16px; border-left:4px solid #315c4b;">
                    <div style="font-size:13px; color:#6f5a3b; line-height:1.6;">
                      <strong>Preparado para IA:</strong> esta consulta queda clasificada internamente como
                      <strong>${safeAiRoute}</strong>. En una próxima fase, esta categoría podrá usarse para enrutar respuestas automáticas con un agente inteligente.
                    </div>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:22px 32px; background:#f3eee5; border-top:1px solid #eadfce;">
                  <p style="margin:0; color:#7a684f; font-size:13px; line-height:1.6;">
                    ${BRAND_NAME} · Formulario de consultas y soporte
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

function buildUserConfirmationTemplate({ name, categoryLabel }) {
  const safeName = escapeHtml(name);
  const safeCategory = escapeHtml(categoryLabel);

  return `
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Recibimos tu consulta - ${BRAND_NAME}</title>
    </head>
    <body style="margin:0; padding:0; background:#f7f2ea; font-family:Arial, Helvetica, sans-serif; color:#2f2a24;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ea; padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px; background:#fffdf8; border-radius:22px; overflow:hidden; border:1px solid #eadfce; box-shadow:0 18px 45px rgba(69, 49, 25, 0.10);">
              
              <tr>
                <td style="background:linear-gradient(135deg, #315c4b 0%, #6f8f72 100%); padding:34px 32px;">
                  <div style="font-size:13px; text-transform:uppercase; letter-spacing:1.8px; color:#f3e8d3; font-weight:700;">
                    ${BRAND_NAME}
                  </div>
                  <h1 style="margin:10px 0 0; color:#ffffff; font-size:28px; line-height:1.25; font-weight:700;">
                    Recibimos tu consulta
                  </h1>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px; font-size:17px; line-height:1.7; color:#2f2a24;">
                    Hola ${safeName},
                  </p>

                  <p style="margin:0 0 16px; font-size:16px; line-height:1.8; color:#4a4035;">
                    Gracias por escribirnos. Recibimos tu mensaje dentro de la categoría:
                    <strong>${safeCategory}</strong>.
                  </p>

                  <p style="margin:0 0 22px; font-size:16px; line-height:1.8; color:#4a4035;">
                    Revisaremos tu consulta y te responderemos a la brevedad desde nuestro canal de soporte.
                  </p>

                  <div style="padding:18px 20px; background:#faf6ee; border-radius:16px; border:1px solid #eadfce;">
                    <p style="margin:0; font-size:15px; line-height:1.7; color:#6f5a3b;">
                      Si tu consulta está relacionada con el acceso a una App Premium, recuerda usar el mismo correo con el que realizaste tu compra.
                    </p>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:22px 32px; background:#f3eee5; border-top:1px solid #eadfce;">
                  <p style="margin:0; color:#7a684f; font-size:13px; line-height:1.6;">
                    Con cariño,<br />
                    Equipo ${BRAND_NAME}
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

async function sendEmail({ to, subject, html, replyTo }) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${BRAND_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      reply_to: replyTo,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      data?.message ||
      data?.error ||
      "No se pudo enviar el correo desde Resend.";

    throw new Error(errorMessage);
  }

  return data;
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Método no permitido. Usa POST.",
    });
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        ok: false,
        message:
          "Configuración incompleta: falta RESEND_API_KEY en las variables de entorno.",
      });
    }

    if (!TO_EMAIL) {
      return res.status(500).json({
        ok: false,
        message:
          "Configuración incompleta: falta CONTACT_TO_EMAIL en las variables de entorno.",
      });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const name = sanitizeText(body.name || body.nombre);
    const email = sanitizeText(body.email || body.correo);
    const category = sanitizeText(body.category || body.tipoConsulta);
    const message = sanitizeText(body.message || body.mensaje);

    if (!name || name.length < 2) {
      return res.status(400).json({
        ok: false,
        message: "Por favor ingresa un nombre válido.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        message: "Por favor ingresa un correo electrónico válido.",
      });
    }

    const categoryData = getCategoryData(category);

    if (!categoryData) {
      return res.status(400).json({
        ok: false,
        message: "Por favor selecciona un tipo de consulta válido.",
        allowedCategories: Object.keys(ALLOWED_CATEGORIES),
      });
    }

    if (!message || message.length < 10) {
      return res.status(400).json({
        ok: false,
        message: "Por favor escribe una consulta con más detalle.",
      });
    }

    if (message.length > 3000) {
      return res.status(400).json({
        ok: false,
        message: "El mensaje es demasiado extenso. Por favor resume tu consulta.",
      });
    }

    const internalSubject = `[${categoryData.label}] Nueva consulta de ${name}`;

    const internalHtml = buildInternalEmailTemplate({
      name,
      email,
      categoryLabel: categoryData.label,
      priority: categoryData.priority,
      message,
      aiRoute: categoryData.aiRoute,
    });

    await sendEmail({
      to: TO_EMAIL,
      subject: internalSubject,
      html: internalHtml,
      replyTo: email,
    });

    const userSubject = `Recibimos tu consulta en ${BRAND_NAME}`;

    const userHtml = buildUserConfirmationTemplate({
      name,
      categoryLabel: categoryData.label,
    });

    await sendEmail({
      to: email,
      subject: userSubject,
      html: userHtml,
      replyTo: TO_EMAIL,
    });

    return res.status(200).json({
      ok: true,
      message:
        "Tu consulta fue enviada correctamente. Te responderemos a la brevedad.",
      category: {
        value: category,
        label: categoryData.label,
        aiRoute: categoryData.aiRoute,
      },
    });
  } catch (error) {
    console.error("Error en api/contact:", error);

    return res.status(500).json({
      ok: false,
      message:
        "No pudimos enviar tu consulta en este momento. Por favor intenta nuevamente.",
    });
  }
};
