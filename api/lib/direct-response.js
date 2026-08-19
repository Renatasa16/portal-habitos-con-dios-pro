const {
  loadKnowledgeBase,
  classifyMessage,
  normalizeText,
  scoreTextMatch,
  getProductFiles,
  getAppFiles,
  loadProductFile,
  loadAppFile,
  getDisclaimerText,
  getEscalationMessages
} = require("./knowledge-loader");

function normalize(value) {
  if (typeof normalizeText === "function") {
    return normalizeText(value);
  }

  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function routeToText(route) {
  if (!Array.isArray(route) || route.length === 0) {
    return "";
  }

  return route.join(" → ");
}

function getSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getBestScore(message, candidates = []) {
  return candidates.reduce((bestScore, candidate) => {
    if (!candidate) return bestScore;

    if (typeof scoreTextMatch === "function") {
      return Math.max(bestScore, scoreTextMatch(message, candidate));
    }

    const normalizedMessage = normalize(message);
    const normalizedCandidate = normalize(candidate);

    if (!normalizedMessage || !normalizedCandidate) {
      return bestScore;
    }

    if (normalizedMessage.includes(normalizedCandidate)) {
      return Math.max(bestScore, 100 + normalizedCandidate.length);
    }

    const candidateTokens = normalizedCandidate
      .split(" ")
      .filter((token) => token.length >= 3);

    const matchedTokens = candidateTokens.filter((token) =>
      normalizedMessage.includes(token)
    );

    if (matchedTokens.length === 0) {
      return bestScore;
    }

    return Math.max(bestScore, matchedTokens.length * 20);
  }, 0);
}

function getAvailabilityMessage(item) {
  if (item?.availability?.message) {
    return item.availability.message;
  }

  if (item?.prelaunch_message) {
    return item.prelaunch_message;
  }

  if (item?.availability_message) {
    return item.availability_message;
  }

  return null;
}

function buildProductResponse(product, fileName) {
  const content = [];

  const productName = product.name || "Esta experiencia";

  content.push(`${productName} es un Kit Devocional Premium de Hábitos con Dios.`);

  if (product.sales_description) {
    content.push("");
    content.push(product.sales_description);
  }

  if (product.transformation) {
    content.push("");
    content.push(`Esta experiencia busca acompañarte en este proceso: ${product.transformation}`);
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
    content.push(
      "• Recursos imprimibles diseñados para complementar la experiencia en formato físico."
    );
  }

  const availabilityMessage = getAvailabilityMessage(product);

  if (availabilityMessage) {
    content.push("");
    content.push(availabilityMessage);
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
    content.push(app.purpose);
  }

  if (Array.isArray(app.what_users_will_find) && app.what_users_will_find.length > 0) {
    content.push("");
    content.push("Dentro de la App encontrarás:");

    app.what_users_will_find.forEach((item) => {
      content.push(`• ${item}`);
    });
  }

  if (Array.isArray(app.features) && app.features.length > 0) {
    content.push("");
    content.push("También incluye herramientas como:");

    app.features.forEach((feature) => {
      content.push(`• ${feature}`);
    });
  }

  if (Array.isArray(app.navigation_route) && app.navigation_route.length > 0) {
    content.push("");
    content.push(`Ruta sugerida: ${routeToText(app.navigation_route)}`);
  }

  if (app.requires_login) {
    content.push("");
    content.push(
      "Para acceder, recuerda iniciar sesión con el mismo correo electrónico utilizado durante la compra."
    );
  }

  const availabilityMessage = getAvailabilityMessage(app);

  if (availabilityMessage) {
    content.push("");
    content.push(availabilityMessage);
  }

  return {
    found: true,
    source: "app",
    intent: "app_information",
    usedFile: fileName,
    text: content.join("\n")
  };
}

function buildAccessResponse({ text, intent = "access_information", source = "access" }) {
  return {
    found: true,
    source,
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
    intent: route.intent || "navigation_help",
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

function buildDisclaimerResponse(disclaimerKey, classificationResult) {
  const knowledge = loadKnowledgeBase();

  let disclaimerText = null;

  if (typeof getDisclaimerText === "function") {
    disclaimerText = getDisclaimerText(disclaimerKey);
  }

  if (!disclaimerText && disclaimerKey && disclaimerKey !== "none") {
    disclaimerText =
      knowledge.disclaimers?.disclaimers?.[disclaimerKey]?.text || null;
  }

  if (!disclaimerText) {
    return null;
  }

  let escalationMessage = null;

  if (typeof getEscalationMessages === "function") {
    escalationMessage = getEscalationMessages()?.sensitive_case || null;
  }

  if (!escalationMessage) {
    escalationMessage =
      knowledge.escalation?.escalation?.support_messages?.sensitive_case || null;
  }

  const content = [disclaimerText];

  if (classificationResult?.escalate && escalationMessage) {
    content.push("");
    content.push(escalationMessage);
  }

  return {
    found: true,
    source: "disclaimer",
    intent: classificationResult?.intent || "sensitive_case",
    usedFile: "disclaimers.json",
    requiresHumanReview: Boolean(classificationResult?.escalate),
    text: content.join("\n")
  };
}

function getProductCandidates(product, fileName) {
  return [
    fileName?.replace(".json", ""),
    product?.id,
    product?.name,
    product?.sales_description,
    product?.transformation,
    product?.app?.name,
    product?.ebook?.name,
    ...getSafeArray(product?.target_audience),
    ...getSafeArray(product?.bonuses)
  ].filter(Boolean);
}

function getAppCandidates(app, fileName) {
  return [
    fileName?.replace(".json", ""),
    app?.id,
    app?.name,
    app?.product_id,
    app?.description,
    app?.purpose,
    ...getSafeArray(app?.features),
    ...getSafeArray(app?.what_users_will_find)
  ].filter(Boolean);
}

function findBestProductResponse(message) {
  const productFiles = getProductFiles();

  let bestMatch = null;

  for (const fileName of productFiles) {
    const product = loadProductFile(fileName);

    if (!product) {
      continue;
    }

    const candidates = getProductCandidates(product, fileName);
    const score = getBestScore(message, candidates);

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        score,
        fileName,
        product
      };
    }
  }

  if (!bestMatch || bestMatch.score < 35) {
    return null;
  }

  return buildProductResponse(bestMatch.product, bestMatch.fileName);
}

function findBestAppResponse(message) {
  const appFiles = getAppFiles();

  let bestMatch = null;

  for (const fileName of appFiles) {
    const app = loadAppFile(fileName);

    if (!app) {
      continue;
    }

    const candidates = getAppCandidates(app, fileName);
    const score = getBestScore(message, candidates);

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        score,
        fileName,
        app
      };
    }
  }

  if (!bestMatch || bestMatch.score < 35) {
    return null;
  }

  return buildAppResponse(bestMatch.app, bestMatch.fileName);
}

function findAccessResponse(message) {
  const knowledge = loadKnowledgeBase();
  const access = knowledge.access?.access;

  if (!access) {
    return null;
  }

  const normalizedMessage = normalize(message);

  const commonProblems = getSafeArray(access.common_problems);
  const decisionTrees = getSafeArray(access.decision_trees);

  const supportEscalationMessage = access.support_escalation?.message || null;

  const alreadyValidatedKeywords = [
    "ya valide",
    "ya validé",
    "ya revise",
    "ya revisé",
    "ya hice",
    "sigue sin funcionar",
    "sigo sin poder",
    "aun no puedo",
    "aún no puedo",
    "todavia no puedo",
    "todavía no puedo",
    "ya probe",
    "ya probé",
    "no aparece despues",
    "no aparece después",
    "sigue sin aparecer"
  ];

  const needsEscalationMessage = alreadyValidatedKeywords.some((keyword) =>
    normalizedMessage.includes(normalize(keyword))
  );

  if (needsEscalationMessage && supportEscalationMessage) {
    return buildAccessResponse({
      text: supportEscalationMessage,
      intent: "access_escalation_ready",
      source: "access_escalation"
    });
  }

  const accessResponseCandidates = [];

  commonProblems.forEach((item) => {
    accessResponseCandidates.push({
      intent: item.id || "access_problem",
      text: item.response,
      candidates: [
        item.id,
        item.title,
        item.category,
        item.response
      ].filter(Boolean)
    });
  });

  decisionTrees.forEach((tree) => {
    accessResponseCandidates.push({
      intent: tree.intent || "access_decision_tree",
      text: tree.initial_response,
      candidates: [
        tree.intent,
        tree.initial_response,
        ...getSafeArray(tree.steps).flatMap((step) => [
          step.question,
          step.if_no,
          step.if_yes
        ])
      ].filter(Boolean)
    });
  });

  if (access.responses?.login_help) {
    accessResponseCandidates.push({
      intent: "login_help",
      text: access.responses.login_help,
      candidates: [
        "ingresar",
        "entrar",
        "login",
        "iniciar sesion",
        "iniciar sesión",
        "como ingreso",
        "cómo ingreso",
        "acceder al portal",
        access.responses.login_help
      ]
    });
  }

  if (access.responses?.purchase_email_help) {
    accessResponseCandidates.push({
      intent: "purchase_email_help",
      text: access.responses.purchase_email_help,
      candidates: [
        "mismo correo",
        "correo de compra",
        "correo utilizado",
        "compré con otro correo",
        "compre con otro correo",
        "otro correo",
        access.responses.purchase_email_help
      ]
    });
  }

  if (access.responses?.collection_access_help) {
    accessResponseCandidates.push({
      intent: "collection_access_help",
      text: access.responses.collection_access_help,
      candidates: [
        "no veo mi coleccion",
        "no veo mi colección",
        "no encuentro mi kit",
        "no encuentro mi coleccion",
        "no encuentro mi colección",
        "no aparecen mis recursos",
        "no veo mis recursos",
        "mis colecciones",
        access.responses.collection_access_help
      ]
    });
  }

  let bestMatch = null;

  for (const candidate of accessResponseCandidates) {
    if (!candidate.text) {
      continue;
    }

    const score = getBestScore(message, candidate.candidates);

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        ...candidate,
        score
      };
    }
  }

  if (!bestMatch || bestMatch.score < 25) {
    return null;
  }
