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
        "login"
