const {
  buildCompactPromptContext
} = require("./lib/knowledge-loader");

const {
  generateGeminiResponse
} = require("./lib/gemini-service");

const {
  getDirectResponse
} = require("./lib/direct-response");

const RESEND_API_URL = "https://api.resend.com/emails";

const BRAND_NAME = "Hábitos con Dios";
const FROM_EMAIL = "soporte@skoolrenovae.store";
const TO_EMAIL = process.env.CONTACT_TO_EMAIL;

const ALLOWED_CATEGORIES = {
  app: {
    label: "App",
    priority: "Alta",
    aiRoute: "app"
  },

  acceso: {
    label: "Acceso",
    priority: "Alta",
    aiRoute: "access"
  },

  ebook: {
    label: "Ebook",
    priority: "Media",
    aiRoute: "ebook"
  },

  bonos: {
    label: "Bonos",
    priority: "Media",
    aiRoute: "bonuses"
  },

  descarga: {
    label: "Descarga",
    priority: "Media",
    aiRoute: "download"
  },

  compra: {
    label: "Compra",
    priority: "Media",
    aiRoute: "purchase"
  },

  consulta_general: {
    label: "Consulta general",
    priority: "Normal",
    aiRoute: "general_inquiry"
  }
};

const ALLOWED_PRODUCTS = {

  prod_21dias: {
    label: "21 Días Más Cerca de Dios"
  },

  prod_pequenos_momentos: {
    label: "Pequeños Momentos con Dios"
  },

  prod_palabras_duelen: {
    label: "Cuando las Palabras Duelen"
  },

  prod_hombre_edifica: {
    label: "El Hombre que Edifica su Hogar"
  },

  prod_no_seguro: {
    label: "No estoy seguro de qué opción elegir"
  }

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
    .replace(/[{}[\]<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeMessage(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[{}[\]<>]/g, "")
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

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function getCategoryData(category) {
  return ALLOWED_CATEGORIES[category] || null;
}

function detectSensitiveMessage(message) {
  const value = String(message || "").toLowerCase();

  const sensitiveTerms = [
    "violencia",
    "abuso",
    "amenaza",
    "amenazas",
    "autolesion",
    "autolesión",
    "suicidio",
    "hacerme daño",
    "me quiero morir",
    "tengo miedo",
    "peligro",
    "bullying",
    "cyberbullying",
    "depresión",
    "depresion",
    "ansiedad",
    "crisis",
    "matrimonio",
    "divorcio",
    "asesoría legal",
    "asesoria legal",
    "asesoría financiera",
    "asesoria financiera"
  ];

  return sensitiveTerms.some((term) => value.includes(term));
}

function buildEmailShell({ title, subtitle, contentHtml }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(title)} - ${BRAND_NAME}</title>
    </head>
    <body style="margin:0; padding:0; background:#f7f2ea; font-family:Arial, Helvetica, sans-serif; color:#2f2a24;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ea; padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px; background:#fffdf8; border-radius:22px; overflow:hidden; border:1px solid #eadfce; box-shadow:0 18px 45px rgba(69, 49, 25, 0.10);">

              <tr>
                <td style="background:linear-gradient(135deg, #315c4b 0%, #6f8f72 100%); padding:34px 32px;">
                  <div style="font-size:13px; text-transform:uppercase; letter-spacing:1.8px; color:#f3e8d3; font-weight:700;">
                    ${BRAND_NAME}
                  </div>
                  <h1 style="margin:10px 0 0; color:#ffffff; font-size:28px; line-height:1.25; font-weight:700;">
                    ${escapeHtml(title)}
                  </h1>
                  ${
                    subtitle
                      ? `<p style="margin:12px 0 0; color:#f8f2e8; font-size:15px; line-height:1.6;">${escapeHtml(subtitle)}</p>`
                      : ""
                  }
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">
                  ${contentHtml}
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

function buildInternalEmailTemplate({
  name,
  email,
  categoryLabel,
  priority,
  message,
  aiRoute,
  aiResponseText,
  aiError,
  isSensitive,
  responseProvider,
  responseModel
}) {
  const aiStatus = aiResponseText
    ? isSensitive
      ? "Respuesta sugerida para revisión humana"
      : responseProvider === "direct-response"
        ? "Respuesta directa generada desde la base estructurada"
        : "Respuesta IA generada automáticamente"
    : aiError
      ? "No se pudo generar respuesta automática"
      : "Sin respuesta automática generada";

  const contentHtml = `
    <div style="margin-bottom:22px;">
      <span style="display:inline-block; padding:8px 14px; background:#efe7d8; border-radius:999px; color:#5f4a2b; font-size:13px; font-weight:700;">
        ${escapeHtml(categoryLabel)}
      </span>
      <span style="display:inline-block; margin-left:8px; padding:8px 14px; background:#f4eee3; border-radius:999px; color:#315c4b; font-size:13px; font-weight:700;">
        Prioridad: ${escapeHtml(priority)}
      </span>
    </div>

    <div style="background:#faf6ee; padding:18px 20px; border-radius:16px; border:1px solid #eadfce; margin-bottom:14px;">
      <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#8a7456; font-weight:700; margin-bottom:6px;">
        Nombre
      </div>
      <div style="font-size:16px; color:#2f2a24; font-weight:600;">
        ${escapeHtml(name)}
      </div>
    </div>

    <div style="background:#faf6ee; padding:18px 20px; border-radius:16px; border:1px solid #eadfce; margin-bottom:14px;">
      <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#8a7456; font-weight:700; margin-bottom:6px;">
        Correo electrónico
      </div>
      <div style="font-size:16px; color:#2f2a24; font-weight:600;">
        ${escapeHtml(email)}
      </div>
    </div>

    <div style="background:#ffffff; padding:22px 20px; border-radius:16px; border:1px solid #eadfce; margin-bottom:18px;">
      <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#8a7456; font-weight:700; margin-bottom:10px;">
        Mensaje
      </div>
      <div style="font-size:16px; color:#2f2a24; line-height:1.75; white-space:pre-line;">
        ${nl2br(message)}
      </div>
    </div>

    <div style="padding:18px 20px; background:#f3eee5; border-radius:16px; border-left:4px solid #315c4b; margin-bottom:18px;">
      <div style="font-size:13px; color:#6f5a3b; line-height:1.6;">
        <strong>Ruta IA:</strong> ${escapeHtml(aiRoute)}<br />
        <strong>Estado:</strong> ${escapeHtml(aiStatus)}<br />
        <strong>Proveedor:</strong> ${escapeHtml(responseProvider || "none")}<br />
        <strong>Fuente/modelo:</strong> ${escapeHtml(responseModel || "none")}<br />
        <strong>Caso sensible:</strong> ${isSensitive ? "Sí" : "No"}
      </div>
    </div>

    ${
      aiResponseText
        ? `<div style="background:#fffdf8; padding:22px 20px; border-radius:16px; border:1px solid #d8c7a7;">
            <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#8a7456; font-weight:700; margin-bottom:10px;">
              Respuesta generada
            </div>
            <div style="font-size:15px; color:#2f2a24; line-height:1.75; white-space:pre-line;">
              ${nl2br(aiResponseText)}
            </div>
          </div>`
        : ""
    }

    ${
      aiError
        ? `<div style="background:#fff2f2; padding:18px 20px; border-radius:16px; border:1px solid #e7b6b6; color:#8a2f2f; font-size:14px; line-height:1.6;">
            <strong>Error IA:</strong> ${escapeHtml(aiError)}
          </div>`
        : ""
    }
  `;

  return buildEmailShell({
    title: "Nueva consulta recibida",
    subtitle: `Una persona completó el formulario de contacto de ${BRAND_NAME}.`,
    contentHtml
  });
}

function buildUserEmailTemplate({
  name,
  categoryLabel,
  aiResponseText,
  isSensitive
}) {
  const greeting = `
    <p style="margin:0 0 16px; font-size:17px; line-height:1.7; color:#2f2a24;">
      Hola ${escapeHtml(name)},
    </p>
  `;

  const baseIntro = `
    <p style="margin:0 0 16px; font-size:16px; line-height:1.8; color:#4a4035;">
      Gracias por escribirnos. Recibimos tu mensaje dentro de la categoría:
      <strong>${escapeHtml(categoryLabel)}</strong>.
    </p>
  `;

  const sensitiveNotice = `
    <div style="padding:18px 20px; background:#faf6ee; border-radius:16px; border:1px solid #eadfce; margin-top:18px;">
      <p style="margin:0; font-size:15px; line-height:1.7; color:#6f5a3b;">
        Tu mensaje será revisado cuidadosamente por nuestro equipo. Si estás atravesando una situación urgente, de riesgo o que afecta tu seguridad o la de otra persona, busca ayuda inmediata de una persona segura, un profesional calificado o una autoridad local.
      </p>
    </div>
  `;

  const aiBlock = aiResponseText
  ? `
    <div style="margin-top:24px; background:#fffdf8; border:1px solid #eadfce; border-radius:20px; overflow:hidden; box-shadow:0 10px 26px rgba(69, 49, 25, 0.08);">

      <div style="padding:20px 22px; background:#f3eee5; border-bottom:1px solid #eadfce;">
        <div style="display:inline-block; padding:7px 12px; background:#315c4b; color:#ffffff; border-radius:999px; font-size:12px; font-weight:700; letter-spacing:0.8px; text-transform:uppercase;">
          Gracias por confiar en Hábitos con Dios
        </div>

        <h2 style="margin:14px 0 6px; font-size:21px; line-height:1.35; color:#2f2a24; font-weight:700;">
          Hemos preparado una orientación pensada para tu experiencia
        </h2>

        <p style="margin:0; font-size:14px; line-height:1.7; color:#6f5a3b;">
          Queremos acompañarte con una respuesta clara, cercana y alineada con la información disponible para que puedas avanzar con confianza dentro de tu experiencia.
        </p>
      </div>

      <div style="padding:24px 22px;">
        <div style="font-size:16px; line-height:1.85; color:#3f372f; white-space:pre-line;">
          ${nl2br(aiResponseText)}
        </div>
      </div>

      <div style="padding:18px 22px; background:#faf6ee; border-top:1px solid #eadfce;">
        <p style="margin:0; font-size:14px; line-height:1.7; color:#7a684f;">
          ✨ Si necesitas orientación adicional, puedes completar nuevamente el formulario desde el Centro de Ayuda. Estaremos encantados de acompañarte.
        </p>
      </div>

    </div>
  `
  : `
    <div style="margin-top:22px; padding:22px 20px; background:#fffdf8; border-radius:18px; border:1px solid #eadfce;">
      <p style="margin:0; font-size:16px; line-height:1.8; color:#4a4035;">
        Recibimos tu consulta correctamente. Nuestro equipo podrá revisarla y acompañarte con la orientación adecuada según tu situación.
      </p>
    </div>
  `;

  const accessReminder = `
    <div style="padding:18px 20px; background:#faf6ee; border-radius:16px; border:1px solid #eadfce; margin-top:18px;">
      <p style="margin:0; font-size:15px; line-height:1.7; color:#6f5a3b;">
        Si tu consulta está relacionada con el acceso a una App Premium, recuerda usar el mismo correo electrónico con el que realizaste tu compra.
      </p>
    </div>
  `;

  return buildEmailShell({
    title: aiResponseText && !isSensitive
      ? "Respuesta a tu consulta"
      : "Recibimos tu consulta",
    subtitle: "Centro de Ayuda",
    contentHtml: `
      ${greeting}
      ${baseIntro}
      ${isSensitive ? sensitiveNotice : aiBlock}
      ${accessReminder}
    `
  });
}

async function sendEmail({ to, subject, html, replyTo }) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `${BRAND_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      reply_to: replyTo
    })
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
      message: "Método no permitido. Usa POST."
    });
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        ok: false,
        message:
          "Configuración incompleta: falta RESEND_API_KEY en las variables de entorno."
      });
    }

    if (!TO_EMAIL) {
      return res.status(500).json({
        ok: false,
        message:
          "Configuración incompleta: falta CONTACT_TO_EMAIL en las variables de entorno."
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const name = sanitizeText(body.name || body.nombre);
const email = sanitizeText(body.email || body.correo);

const product = sanitizeText(
  body.product ||
  body.producto ||
  ""
);

const category = sanitizeText(
  body.category ||
  body.tipoConsulta
);

const message = sanitizeMessage(
  body.message ||
  body.mensaje
);

    if (!name || name.length < 2) {
      return res.status(400).json({
        ok: false,
        message: "Por favor ingresa un nombre válido."
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        message: "Por favor ingresa un correo electrónico válido."
      });
    }

const categoryData = getCategoryData(category);

console.log("CONTACT_PRODUCT", product);
console.log("CONTACT_CATEGORY", category);
console.log("CONTACT_EMAIL", email);
    const productData = getProductData(product);

if (!categoryData) {
      return res.status(400).json({
        ok: false,
        message: "Por favor selecciona un tipo de consulta válido.",
        allowedCategories: Object.keys(ALLOWED_CATEGORIES)
      });
    }

    if (!message || message.length < 10) {
      return res.status(400).json({
        ok: false,
        message: "Por favor escribe una consulta con más detalle."
      });
    }

    if (message.length > 3000) {
      return res.status(400).json({
        ok: false,
        message:
          "El mensaje es demasiado extenso. Por favor resume tu consulta."
      });
    }

    const isSensitive = detectSensitiveMessage(message);

    let aiResult = null;
    let aiError = null;
    let directResponse = null;

    if (!isSensitive) {
      try {
        directResponse = getDirectResponse(message);

        if (directResponse?.found) {
          console.log("DIRECT_RESPONSE_USED", directResponse.source);
          console.log("DIRECT_RESPONSE_INTENT", directResponse.intent);
          console.log("DIRECT_RESPONSE_FILE", directResponse.usedFile || "none");

          aiResult = {
            provider: "direct-response",
            model: directResponse.usedFile || directResponse.source,
            text: directResponse.text
          };
        }
      } catch (error) {
        console.error("Error generando respuesta directa:", error);
      }
    } else {
      console.log("DIRECT_RESPONSE_SKIPPED", "sensitive_message_detected");
    }

    if (!aiResult) {
      try {
        const knowledgeContext = buildCompactPromptContext(
          categoryData.aiRoute,
          message
        );

        console.log("CONTACT_AI_ROUTE", categoryData.aiRoute);
        console.log("CONTACT_IS_SENSITIVE", isSensitive);
        console.log(
          "CONTACT_KNOWLEDGE_CONTEXT_LENGTH",
          knowledgeContext.length
        );

        aiResult = await generateGeminiResponse({
          name,
          email,
          categoryLabel: categoryData.label,
          message,
          aiRoute: categoryData.aiRoute,
          knowledgeContext
        });
      } catch (error) {
        console.error("Error generando respuesta IA:", error);

        aiError =
          error?.message ||
          "Error desconocido generando respuesta IA.";
      }
    }

    const aiResponseText = aiResult?.text || "";
    const responseProvider = aiResult?.provider || null;
    const responseModel = aiResult?.model || null;

    console.log("AI_RESPONSE_START");
    console.log(aiResponseText);
    console.log("AI_RESPONSE_END");
    console.log("AI_RESPONSE_TEXT_LENGTH", aiResponseText.length);
    console.log("AI_RESPONSE_PROVIDER", responseProvider || "none");
    console.log("AI_RESPONSE_MODEL", responseModel || "none");

    const internalSubject =
      `[${categoryData.label}] Nueva consulta de ${name}`;

    const internalHtml = buildInternalEmailTemplate({
      name,
      email,
      categoryLabel: categoryData.label,
      priority: categoryData.priority,
      message,
      aiRoute: categoryData.aiRoute,
      aiResponseText,
      aiError,
      isSensitive,
      responseProvider,
      responseModel
    });

    await sendEmail({
      to: TO_EMAIL,
      subject: internalSubject,
      html: internalHtml,
      replyTo: email
    });

    const userSubject =
      aiResponseText && !isSensitive
        ? `Respuesta a tu consulta en ${BRAND_NAME}`
        : `Recibimos tu consulta en ${BRAND_NAME}`;

    const userHtml = buildUserEmailTemplate({
      name,
      categoryLabel: categoryData.label,
      aiResponseText: aiResponseText && !isSensitive ? aiResponseText : "",
      isSensitive
    });

    await sendEmail({
      to: email,
      subject: userSubject,
      html: userHtml,
      replyTo: TO_EMAIL
    });

    const respondedAutomatically = Boolean(aiResponseText && !isSensitive);

       return res.status(200).json({
      ok: true,
      message: respondedAutomatically
        ? "Tu consulta fue enviada correctamente y te enviamos una respuesta inicial por correo."
        : "Tu consulta fue enviada correctamente. Te responderemos desde nuestro canal de soporte.",
      category: {
        value: category,
        label: categoryData.label,
        aiRoute: categoryData.aiRoute
      },
      ai: {
        attempted: Boolean(aiResult || aiError),
        respondedAutomatically,
        requiresHumanReview: Boolean(isSensitive),
        provider: responseProvider,
        model: responseModel
      },
      directResponse: {
        attempted: Boolean(!isSensitive),
        used: Boolean(directResponse?.found),
        source: directResponse?.source || null,
        intent: directResponse?.intent || null,
        file: directResponse?.usedFile || null
      }
    });
  } catch (error) {
    console.error("Error en api/contact:", error);

    return res.status(500).json({
      ok: false,
      message:
        "No pudimos enviar tu consulta en este momento. Por favor intenta nuevamente."
    });
  }
};
