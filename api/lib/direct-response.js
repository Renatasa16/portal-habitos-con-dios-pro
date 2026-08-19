const {
  loadKnowledgeBase,
  getProductFiles,
  getAppFiles,
  loadProductFile,
  loadAppFile
} = require("./knowledge-loader");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]/g, " ")
    .replace(/[^\w\sáéíóúñü]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRelevantTokens(value) {
  const stopWords = new Set([
    "que",
    "qué",
    "como",
    "cómo",
    "donde",
    "dónde",
    "cuando",
    "cuándo",
    "cual",
    "cuál",
    "para",
    "por",
    "con",
    "del",
    "los",
    "las",
    "una",
    "uno",
    "unos",
    "unas",
    "este",
    "esta",
    "estos",
    "estas",
    "incluye",
    "quiero",
    "saber",
    "necesito",
    "ayuda",
    "sobre"
  ]);

  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 4 && !stopWords.has(token));
}

function hasTokenMatch(message, candidate, minimumMatches = 2) {
  const normalizedMessage = normalize(message);
  const candidateTokens = getRelevantTokens(candidate);

  if (!normalizedMessage || candidateTokens.length === 0) {
    return false;
  }

  const matches = candidateTokens.filter((token) =>
    normalizedMessage.includes(token)
  );

  return matches.length >= Math.min(minimumMatches, candidateTokens.length);
}

function routeToText(route) {
  if (!Array.isArray(route) || route.length === 0) {
    return "";
  }

  return route.join(" → ");
}

function buildProductResponse(product, fileName) {
  const content = [];

  const productName = product.name || "Esta experiencia";
  const audience =
    Array.isArray(product.target_audience) && product.target_audience.length > 0
      ? product.target_audience.join(", ")
      : "personas que desean crecer espiritualmente";

  content.push(
    `${productName} es un Kit Devocional Premium diseñado para ${audience}.`
  );

  if (product.sales_description) {
    content.push("");
    content.push(product.sales_description);
  }

  if (product.transformation) {
    content.push("");
    content.push(`Su propósito es ${product.transformation}`);
  }

  content.push("");
  content.push("Incluye:");

  if (product.app?.name) {
    content.push(`• App Premium: ${product.app.name}`);

    if (product.app.description) {
      content.push(`  ${product.app.description}`);
    }
  }

  if (product.ebook?.name) {
    content.push(`• Ebook principal: ${product.ebook.name}`);

    if (product.ebook.description) {
      content.push(`  ${product.ebook.description}`);
    }
  }

  if (Array.isArray(product.bonuses) && product.bonuses.length > 0) {
    product.bonuses.forEach((bonus) => {
      content.push(`• ${bonus}`);
    });
  }

  if (product.printables) {
    content.push("• Recursos imprimibles");
  }

  if (product.availability?.message) {
    content.push("");
    content.push(product.availability.message);
  } else if (product.prelaunch_message) {
    content.push("");
    content.push(product.prelaunch_message);
  }

  return {
    found: true,
    source: "product",
    intent: "product_information",
    usedFile: fileName,
    text: content.join("\n")
  };
}

function buildAppResponse(app, fileName) {
  const content = [];

  const appName = app.name || "Esta App Premium";

  content.push(`${appName} es una App Premium de Hábitos con Dios.`);

  if (app.description) {
    content.push("");
    content.push(app.description);
  }

  if (app.purpose) {
    content.push("");
    content.push(`Propósito: ${app.purpose}`);
  }

  if (Array.isArray(app.features) && app.features.length > 0) {
    content.push("");
    content.push("Funciones principales:");

    app.features.forEach((feature) => {
      content.push(`• ${feature}`);
    });
  }

  if (
    Array.isArray(app.what_users_will_find) &&
    app.what_users_will_find.length > 0
  ) {
    content.push("");
    content.push("Dentro de la App encontrarás:");

    app.what_users_will_find.forEach((item) => {
      content.push(`• ${item}`);
    });
  }

  if (Array.isArray(app.navigation_route) && app.navigation_route.length > 0) {
    content.push("");
    content.push(`Ruta sugerida: ${routeToText(app.navigation_route)}`);
  }

  if (app.requires_login) {
    content.push("");
    content.push(
      "Para acceder, recuerda iniciar sesión con el correo electrónico asociado a tu compra."
    );
  }

  return {
    found: true,
    source: "app",
    intent: "app_information",
    usedFile: fileName,
    text: content.join("\n")
  };
}

function buildAccessResponse({ text, intent = "access_information" }) {
  return {
    found: true,
    source: "access",
    intent,
    usedFile: "access.json",
    text
  };
}

function buildRouteResponse(route) {
  const content = [];

  if (route.response) {
    content.push(route.response);
  }

  if (Array.isArray(route.route) && route.route.length > 0) {
    content.push("");
    content.push(`Ruta sugerida: ${routeToText(route.route)}`);
  }

  if (route.availability_note) {
    content.push("");
    content.push(route.availability_note);
  }

  return {
    found: true,
    source: "route",
    intent: route.intent,
    usedFile: "routes.json",
    text: content.join("\n")
  };
}

function buildFaqResponse(faqItem) {
  return {
    found: true,
    source: "faq",
    intent: faqItem.id || "faq_response",
    usedFile: "faq.json",
    text: faqItem.answer
  };
}

function findProductResponse(message) {
  const productFiles = getProductFiles();

  for (const fileName of productFiles) {
    const product = loadProductFile(fileName);

    if (!product) {
      continue;
    }

    const candidates = [
      product.name,
      fileName.replace(".json", ""),
      product.id,
      product.app?.name,
      product.ebook?.name,
      ...(Array.isArray(product.target_audience) ? product.target_audience : [])
    ].filter(Boolean);

    const matched = candidates.some((candidate) =>
      hasTokenMatch(message, candidate, 2)
    );

    if (matched) {
      return buildProductResponse(product, fileName);
    }
  }

  return null;
}

function findAppResponse(message) {
  const appFiles = getAppFiles();

  for (const fileName of appFiles) {
    const app = loadAppFile(fileName);

    if (!app) {
      continue;
    }

    const candidates = [
      app.name,
      fileName.replace(".json", ""),
      app.id,
      app.product_id,
      ...(Array.isArray(app.features) ? app.features : []),
      ...(Array.isArray(app.what_users_will_find)
        ? app.what_users_will_find
        : [])
    ].filter(Boolean);

    const matched = candidates.some((candidate) =>
      hasTokenMatch(message, candidate, 2)
    );

    if (matched) {
      return buildAppResponse(app, fileName);
    }
  }

  return null;
}

function findAccessResponse(message) {
  const knowledge = loadKnowledgeBase();
  const access = knowledge.access?.access;

  if (!access) {
    return null;
  }

  const normalizedMessage = normalize(message);

  const emailNotReceivedResponse =
    access.common_problems?.find(
      (item) => item.id === "email_not_received"
    )?.response || null;

  const collectionNotVisibleResponse =
    access.common_problems?.find(
      (item) => item.id === "collection_not_visible"
    )?.response || null;

  const wrongEmailResponse =
    access.common_problems?.find(
      (item) => item.id === "wrong_purchase_email"
    )?.response || null;

  const magicLinkExpiredResponse =
    access.common_problems?.find(
      (item) => item.id === "magic_link_expired"
    )?.response || null;

  const directRules = [
    {
      intent: "email_not_received",
      keywords: [
        "no recibi correo",
        "no recibi email",
        "no llego correo",
        "no llego email",
        "correo de acceso",
        "email de acceso",
        "magic link no llego"
      ],
      response: emailNotReceivedResponse
    },
    {
      intent: "cannot_login",
      keywords: [
        "compre y no puedo entrar",
        "compré y no puedo entrar",
        "compre pero no puedo entrar",
        "compré pero no puedo ingresar",
        "no puedo ingresar",
        "no puedo entrar",
        "problema de acceso",
        "no puedo acceder"
      ],
      response:
        access.decision_trees?.[0]?.initial_response ||
        access.responses?.purchase_email_help
    },
    {
      intent: "same_purchase_email",
      keywords: [
        "mismo correo",
        "correo de compra",
        "correo utilizado",
        "compre con otro correo",
        "compré con otro correo",
        "otro correo"
      ],
      response: wrongEmailResponse || access.responses?.purchase_email_help
    },
        {
      intent: "login_help",
      keywords: [
        "como ingreso",
        "cómo ingreso",
        "iniciar sesion",
        "iniciar sesión",
        "login",
        "entrar al portal",
        "acceder al portal"
      ],
      response: access.responses?.login_help
    },
    {
      intent: "collection_not_visible",
      keywords: [
        "no veo mi coleccion",
        "no veo mi colección",
        "no aparece mi coleccion",
        "no aparece mi colección",
        "no encuentro mi kit",
        "no veo mi kit",
        "no veo mis recursos"
      ],
      response:
        collectionNotVisibleResponse ||
        access.responses?.collection_access_help
    },
    {
      intent: "magic_link_expired",
      keywords: [
        "enlace expiro",
        "enlace expiró",
        "link expiro",
        "link expiró",
        "magic link expiro",
        "magic link expiró"
      ],
      response: magicLinkExpiredResponse
    }
  ];

  for (const rule of directRules) {
    const matched = rule.keywords.some((keyword) =>
      normalizedMessage.includes(normalize(keyword))
    );

    if (matched && rule.response) {
      return buildAccessResponse({
        text: rule.response,
        intent: rule.intent
      });
    }
  }

  return null;
}

function findRouteResponse(message) {
  const knowledge = loadKnowledgeBase();
  const routes = knowledge.routes?.navigation_routes || [];
  const normalizedMessage = normalize(message);

  if (!Array.isArray(routes) || routes.length === 0) {
    return null;
  }

  const routeMatches = [
    {
      keywords: ["comprar", "adquirir", "shopify"],
      intent: "comprar_kit"
    },
    {
      keywords: ["colecciones disponibles", "explorar colecciones"],
      intent: "explorar_colecciones"
    },
    {
      keywords: ["app", "aplicacion", "aplicación"],
      intent: "acceder_app"
    },
    {
      keywords: ["continuar experiencia", "donde deje", "dónde dejé"],
      intent: "continuar_experiencia"
    },
    {
      keywords: ["ebook", "libro", "descargar ebook"],
      intent: "descargar_ebook"
    },
    {
      keywords: ["bono", "bonos"],
      intent: "descargar_bonos"
    },
    {
      keywords: ["imprimible", "imprimibles"],
      intent: "descargar_imprimibles"
    },
    {
      keywords: ["soporte", "ayuda", "centro de ayuda", "contactar"],
      intent: "acceder_centro_ayuda"
    },
    {
      keywords: ["iniciar sesion", "iniciar sesión", "login"],
      intent: "iniciar_sesion"
    },
    {
      keywords: ["no recibi email", "no recibí email", "no recibi correo"],
      intent: "no_recibi_email"
    },
    {
      keywords: ["no puedo entrar", "no puedo ingresar", "problema acceso"],
      intent: "problema_acceso"
    },
    {
      keywords: ["no veo mi kit", "no veo mi coleccion", "no veo mi colección"],
      intent: "no_veo_mi_kit"
    },
    {
      keywords: ["apps disponibles", "conocer apps"],
      intent: "conocer_apps"
    },
    {
      keywords: [
        "todo lo que compre",
        "todo lo que compré",
        "productos adquiridos"
      ],
      intent: "ver_productos_adquiridos"
    }
  ];

  for (const routeMatch of routeMatches) {
    const matched = routeMatch.keywords.some((keyword) =>
      normalizedMessage.includes(normalize(keyword))
    );

    if (!matched) {
      continue;
    }

    const route = routes.find((item) => item.intent === routeMatch.intent);

    if (route) {
      return buildRouteResponse(route);
    }
  }

  return null;
}

function findFaqResponse(message) {
  const knowledge = loadKnowledgeBase();
  const faqItems = knowledge.faq?.faq || [];
  const normalizedMessage = normalize(message);

  if (!Array.isArray(faqItems) || faqItems.length === 0) {
    return null;
  }

  for (const item of faqItems) {
    const question = normalize(item.question);
    const answer = normalize(item.answer);
    const id = normalize(item.id);

    const matched =
      normalizedMessage.includes(question) ||
      question.includes(normalizedMessage) ||
      hasTokenMatch(message, question, 2) ||
      hasTokenMatch(message, id, 1) ||
      hasTokenMatch(message, answer, 3);

    if (matched && item.answer) {
      return buildFaqResponse(item);
    }
  }

  return null;
}

function shouldSkipDirectResponse(message) {
  const normalizedMessage = normalize(message);

  const sensitiveKeywords = [
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
    "depresion",
    "depresión",
    "ansiedad",
    "crisis",
    "matrimonio",
    "divorcio",
    "asesoria legal",
    "asesoría legal",
    "asesoria financiera",
    "asesoría financiera"
  ];

  return sensitiveKeywords.some((keyword) =>
    normalizedMessage.includes(normalize(keyword))
  );
}

function getDirectResponse(message) {
  if (!message || typeof message !== "string") {
    return {
      found: false,
      reason: "empty_message"
    };
  }

  if (shouldSkipDirectResponse(message)) {
    console.log("DIRECT_RESPONSE_SKIPPED", "sensitive_or_complex_case");

    return {
      found: false,
      reason: "sensitive_or_complex_case"
    };
  }

  const checks = [
    findProductResponse,
    findAppResponse,
    findAccessResponse,
    findRouteResponse,
    findFaqResponse
  ];

  for (const check of checks) {
    const result = check(message);

    if (result?.found) {
      console.log("DIRECT_RESPONSE_FOUND", true);
      console.log("DIRECT_RESPONSE_SOURCE", result.source);
      console.log("DIRECT_RESPONSE_INTENT", result.intent);
      console.log("DIRECT_RESPONSE_FILE", result.usedFile || "none");

      return result;
    }
  }

  console.log("DIRECT_RESPONSE_FOUND", false);

  return {
    found: false,
    reason: "no_direct_match"
  };
}

module.exports = {
  getDirectResponse
};
