const fs = require("fs");
const path = require("path");

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

const MODULE_FILES = {
  classification: "classification.json",
  brand: "brand.json",
  products: "products.json",
  apps: "apps.json",
  routes: "routes.json",
  access: "access.json",
  disclaimers: "disclaimers.json",
  escalation: "escalation.json",
  faq: "faq.json",
  knowledgeBase: "knowledge-base.json"
};

let cachedKnowledge = null;
const cachedJsonFiles = new Map();

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readJsonFile(fileName) {
  const filePath = path.join(KNOWLEDGE_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo de conocimiento: ${fileName}`);
  }

  if (cachedJsonFiles.has(filePath)) {
    return cachedJsonFiles.get(filePath);
  }

  const rawContent = fs.readFileSync(filePath, "utf8");

  try {
    const parsed = JSON.parse(rawContent);
    cachedJsonFiles.set(filePath, parsed);
    return parsed;
  } catch (error) {
    throw new Error(`El archivo ${fileName} no contiene JSON válido.`);
  }
}

function readNestedJsonFile(folderName, fileName) {
  const filePath = path.join(KNOWLEDGE_DIR, folderName, fileName);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  if (cachedJsonFiles.has(filePath)) {
    return cachedJsonFiles.get(filePath);
  }

  const rawContent = fs.readFileSync(filePath, "utf8");

  try {
    const parsed = JSON.parse(rawContent);
    cachedJsonFiles.set(filePath, parsed);
    return parsed;
  } catch (error) {
    console.error(`El archivo ${folderName}/${fileName} no contiene JSON válido.`);
    return null;
  }
}

function loadKnowledgeBase() {
  if (cachedKnowledge) {
    return cachedKnowledge;
  }

  const knowledge = {
    classification: readJsonFile(MODULE_FILES.classification),
    brand: readJsonFile(MODULE_FILES.brand),
    products: readJsonFile(MODULE_FILES.products),
    apps: readJsonFile(MODULE_FILES.apps),
    routes: readJsonFile(MODULE_FILES.routes),
    access: readJsonFile(MODULE_FILES.access),
    disclaimers: readJsonFile(MODULE_FILES.disclaimers),
    escalation: readJsonFile(MODULE_FILES.escalation),
    faq: readJsonFile(MODULE_FILES.faq),
    knowledgeBase: readJsonFile(MODULE_FILES.knowledgeBase)
  };

  cachedKnowledge = knowledge;
  return knowledge;
}

function getKnowledgeSummary() {
  const knowledge = loadKnowledgeBase();

  return {
    brandName: knowledge.brand?.brand?.name || "Hábitos con Dios",
    language: knowledge.knowledgeBase?.knowledge_base?.supported_language || "es",
    version: knowledge.knowledgeBase?.knowledge_base?.version || "1.1.0",
    modules: knowledge.knowledgeBase?.knowledge_base?.modules || {},
    agentBehavior: knowledge.knowledgeBase?.knowledge_base?.agent_behavior || {},
    disclaimerStrategy: knowledge.knowledgeBase?.knowledge_base?.disclaimer_strategy || {},
    escalationStrategy: knowledge.knowledgeBase?.knowledge_base?.escalation_strategy || {}
  };
}

function getProductFiles() {
  const productsDir = path.join(KNOWLEDGE_DIR, "products");

  if (!fs.existsSync(productsDir)) {
    return [];
  }

  return fs
    .readdirSync(productsDir)
    .filter((file) => file.endsWith(".json"));
}

function getAppFiles() {
  const appsDir = path.join(KNOWLEDGE_DIR, "apps");

  if (!fs.existsSync(appsDir)) {
    return [];
  }

  return fs
    .readdirSync(appsDir)
    .filter((file) => file.endsWith(".json"));
}

function loadProductFile(productFileName) {
  return readNestedJsonFile("products", productFileName);
}

function loadAppFile(appFileName) {
  return readNestedJsonFile("apps", appFileName);
}

function findMatchingFiles(folderName, message, availableFiles) {
  const normalizedMessage = normalizeText(message);

  if (!normalizedMessage) {
    return [];
  }

  return availableFiles.filter((fileName) => {
    const normalizedFileName = normalizeText(fileName.replace(".json", ""));
    const fileTokens = normalizedFileName.split(" ").filter(Boolean);

    return fileTokens.some((token) => {
      return token.length >= 4 && normalizedMessage.includes(token);
    });
  });
}

function classifyMessage(message, aiRoute) {
  const knowledge = loadKnowledgeBase();
  const normalizedMessage = normalizeText(message);
  const mappings =
    knowledge.classification?.intent_mappings ||
    knowledge.classification?.classification?.intent_mappings ||
    [];

  if (normalizedMessage && Array.isArray(mappings)) {
    for (const mapping of mappings) {
      const keywords = mapping.keywords || [];

      const hasMatch = keywords.some((keyword) => {
        return normalizedMessage.includes(normalizeText(keyword));
      });

      if (hasMatch) {
        return {
          intent: mapping.intent,
          category: mapping.category,
          knowledgeSources: mapping.knowledge_sources || [],
          escalate: Boolean(mapping.escalate),
          disclaimer: mapping.disclaimer || "none",
          source: "classification.json"
        };
      }
    }
  }

  const legacyRouteMap = {
    access_support: {
      intent: "access_problem",
      category: "access",
      knowledgeSources: [
        "access.json",
        "routes.json",
        "escalation.json",
        "disclaimers.json"
      ],
      escalate: false,
      disclaimer: "none",
      source: "legacy_ai_route"
    },

    product_inquiry: {
      intent: "product_information",
      category: "product",
      knowledgeSources: [
        "products.json",
        "apps.json",
        "faq.json",
        "routes.json"
      ],
      escalate: false,
      disclaimer: "none",
      source: "legacy_ai_route"
    },

    general_inquiry: {
      intent: "general_inquiry",
      category: "general",
      knowledgeSources: [
        "brand.json",
        "faq.json",
        "routes.json",
        "disclaimers.json",
        "escalation.json"
      ],
      escalate: false,
      disclaimer: "none",
      source: "legacy_ai_route"
    }
  };

  if (legacyRouteMap[aiRoute]) {
    return legacyRouteMap[aiRoute];
  }

  const defaultBehavior = knowledge.classification?.default_behavior || {};

  return {
    intent: defaultBehavior.fallback_intent || "navigation_help",
    category: "navigation",
    knowledgeSources: defaultBehavior.fallback_knowledge_sources || [
      "routes.json"
    ],
    escalate: Boolean(defaultBehavior.fallback_escalation),
    disclaimer: defaultBehavior.fallback_disclaimer || "none",
    source: "default_behavior"
  };
}

function addModuleToContext(context, moduleName, moduleData) {
  if (!moduleData) {
    return;
  }

  context[moduleName] = moduleData;
}

function addFaqEntries(context, knowledge, message, category) {
  const faqItems = knowledge.faq?.faq || [];
  const normalizedMessage = normalizeText(message);

  if (!Array.isArray(faqItems)) {
    return;
  }

  let selectedFaq = faqItems.filter((item) => {
    const question = normalizeText(item.question);
    const answer = normalizeText(item.answer);
    const itemCategory = normalizeText(item.category);

    if (category && itemCategory === normalizeText(category)) {
      return true;
    }

    if (!normalizedMessage) {
      return false;
    }

    return (
      normalizedMessage.includes(question) ||
      question.includes(normalizedMessage) ||
      answer.includes(normalizedMessage)
    );
  });

  if (selectedFaq.length === 0 && category) {
    selectedFaq = faqItems.filter((item) => {
      return normalizeText(item.category) === normalizeText(category);
    });
  }

  if (selectedFaq.length === 0) {
    selectedFaq = faqItems.slice(0, 5);
  }

  context.faq = {
    faq_metadata: knowledge.faq?.faq_metadata || {},
    faq: selectedFaq.slice(0, 8),
    faq_rules: knowledge.faq?.faq_rules || {}
  };
}

function resolveKnowledgeSources(classificationResult, message) {
  const sources = classificationResult.knowledgeSources || [];

  const resolved = {
    modules: new Set(),
    productFiles: new Set(),
    appFiles: new Set()
  };

  sources.forEach((source) => {
    if (source === "products/*") {
      const matchingProductFiles = findMatchingFiles(
        "products",
        message,
        getProductFiles()
      );

      if (matchingProductFiles.length > 0) {
        matchingProductFiles.forEach((file) => resolved.productFiles.add(file));
      } else {
        resolved.modules.add("products");
      }

      return;
    }

    if (source === "apps/*") {
      const matchingAppFiles = findMatchingFiles(
        "apps",
        message,
        getAppFiles()
      );

      if (matchingAppFiles.length > 0) {
        matchingAppFiles.forEach((file) => resolved.appFiles.add(file));
      } else {
        resolved.modules.add("apps");
      }

      return;
    }

    const moduleName = Object.keys(MODULE_FILES).find((key) => {
      return MODULE_FILES[key] === source;
    });

    if (moduleName) {
      resolved.modules.add(moduleName);
    }
  });

  resolved.modules.add("brand");

  if (classificationResult.escalate) {
    resolved.modules.add("escalation");
  }

  if (classificationResult.disclaimer && classificationResult.disclaimer !== "none") {
    resolved.modules.add("disclaimers");
  }

  return resolved;
}

function buildKnowledgeContext(aiRoute, message = "") {
  const knowledge = loadKnowledgeBase();
  const classificationResult = classifyMessage(message, aiRoute);
  const resolvedSources = resolveKnowledgeSources(classificationResult, message);

  const context = {
    metadata: {
      source: "Hábitos con Dios Knowledge Base",
      version: knowledge.knowledgeBase?.knowledge_base?.version || "1.1.0",
      aiRoute,
      detectedIntent: classificationResult.intent,
      detectedCategory: classificationResult.category,
      classificationSource: classificationResult.source,
      disclaimer: classificationResult.disclaimer,
      escalate: classificationResult.escalate,
      modulesUsed: Array.from(resolvedSources.modules),
      productFilesUsed: Array.from(resolvedSources.productFiles),
      appFilesUsed: Array.from(resolvedSources.appFiles)
    },

    globalRules: {
      goldenRule:
        knowledge.knowledgeBase?.knowledge_base?.agent_behavior?.golden_rule ||
        "Siempre intentar resolver primero antes de pedir datos.",

      resolutionStrategy:
        knowledge.knowledgeBase?.knowledge_base?.agent_behavior?.resolution_strategy || [],

      restrictedCapabilities:
        knowledge.knowledgeBase?.knowledge_base?.restricted_capabilities || [],

      responseRules:
        knowledge.knowledgeBase?.knowledge_base?.response_rules || {}
    }
  };

  resolvedSources.modules.forEach((moduleName) => {
    if (moduleName === "faq") {
      addFaqEntries(
        context,
        knowledge,
        message,
        classificationResult.category
      );
      return;
    }

    if (moduleName === "knowledgeBase") {
      context.knowledgeBase = {
        knowledge_base: {
          name: knowledge.knowledgeBase?.knowledge_base?.name,
          version: knowledge.knowledgeBase?.knowledge_base?.version,
          modules: knowledge.knowledgeBase?.knowledge_base?.modules,
          agent_behavior: knowledge.knowledgeBase?.knowledge_base?.agent_behavior,
          response_rules: knowledge.knowledgeBase?.knowledge_base?.response_rules,
          restricted_capabilities:
            knowledge.knowledgeBase?.knowledge_base?.restricted_capabilities
        }
      };
      return;
    }

    addModuleToContext(context, moduleName, knowledge[moduleName]);
  });

  if (resolvedSources.productFiles.size > 0) {
    context.products = context.products || {
      products: knowledge.products?.products || []
    };

    context.productDetails = Array.from(resolvedSources.productFiles)
      .map((fileName) => {
        return {
          file: fileName,
          content: loadProductFile(fileName)
        };
      })
      .filter((item) => item.content);
  }

  if (resolvedSources.appFiles.size > 0) {
    context.apps = context.apps || {
      apps: knowledge.apps?.apps || []
    };

    context.appDetails = Array.from(resolvedSources.appFiles)
      .map((fileName) => {
        return {
          file: fileName,
          content: loadAppFile(fileName)
        };
      })
      .filter((item) => item.content);
  }

  console.log("KNOWLEDGE_INTENT", classificationResult.intent);
  console.log("KNOWLEDGE_CATEGORY", classificationResult.category);
  console.log("KNOWLEDGE_MODULES_USED", context.metadata.modulesUsed.join(", "));
  console.log("KNOWLEDGE_PRODUCT_FILES_USED", context.metadata.productFilesUsed.join(", "));
  console.log("KNOWLEDGE_APP_FILES_USED", context.metadata.appFilesUsed.join(", "));

  return context;
}

function buildCompactPromptContext(aiRoute, message = "") {
  const context = buildKnowledgeContext(aiRoute, message);
  const compactContext = JSON.stringify(context, null, 2);

  console.log("KNOWLEDGE_CONTEXT_LENGTH", compactContext.length);

  return compactContext;
}

function getRelevantModulesByRoute(aiRoute) {
  const classificationResult = classifyMessage("", aiRoute);
  const resolvedSources = resolveKnowledgeSources(classificationResult, "");

  return Array.from(resolvedSources.modules);
}

function getProducts() {
  const knowledge = loadKnowledgeBase();

  return knowledge.products?.products || [];
}

module.exports = {
  loadKnowledgeBase,
  getKnowledgeSummary,
  getRelevantModulesByRoute,
  buildKnowledgeContext,
  buildCompactPromptContext,
  classifyMessage,
  getProducts,
  getProductFiles,
  getAppFiles,
  loadProductFile,
  loadAppFile
};
