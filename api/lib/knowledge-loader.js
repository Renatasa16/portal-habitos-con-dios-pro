const fs = require("fs");
const path = require("path");

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

const MODULE_FILES = {
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

function readJsonFile(fileName) {
  const filePath = path.join(KNOWLEDGE_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `No se encontró el archivo de conocimiento: ${fileName}`
    );
  }

  const rawContent = fs.readFileSync(filePath, "utf8");

  try {
    return JSON.parse(rawContent);
  } catch (error) {
    throw new Error(
      `El archivo ${fileName} no contiene JSON válido.`
    );
  }
}

function loadKnowledgeBase() {
  if (cachedKnowledge) {
    return cachedKnowledge;
  }

  const knowledge = {
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
    brandName:
      knowledge.brand?.brand?.name || "Hábitos con Dios",

    language:
      knowledge.knowledgeBase?.knowledge_base?.supported_language || "es",

    version:
      knowledge.knowledgeBase?.knowledge_base?.version || "1.1.0",

    modules:
      knowledge.knowledgeBase?.knowledge_base?.modules || {},

    agentBehavior:
      knowledge.knowledgeBase?.knowledge_base?.agent_behavior || {},

    disclaimerStrategy:
      knowledge.knowledgeBase?.knowledge_base?.disclaimer_strategy || {},

    escalationStrategy:
      knowledge.knowledgeBase?.knowledge_base?.escalation_strategy || {}
  };
}

function getRelevantModulesByRoute(aiRoute) {
  const defaultModules = [
    "brand",
    "routes",
    "faq",
    "disclaimers",
    "escalation"
  ];

  const routeMap = {
    access_support: [
      "brand",
      "access",
      "routes",
      "faq",
      "disclaimers",
      "escalation"
    ],

    product_inquiry: [
      "brand",
      "products",
      "apps",
      "routes",
      "faq",
      "disclaimers",
      "escalation"
    ],

    general_inquiry: [
      "brand",
      "products",
      "apps",
      "routes",
      "faq",
      "disclaimers",
      "escalation"
    ]
  };

  return routeMap[aiRoute] || defaultModules;
}

function buildKnowledgeContext(aiRoute) {
  const knowledge = loadKnowledgeBase();
  const modulesToUse = getRelevantModulesByRoute(aiRoute);

  const context = {
    metadata: {
      source: "Hábitos con Dios Knowledge Base",
      version:
        knowledge.knowledgeBase?.knowledge_base?.version || "1.1.0",
      aiRoute,
      modulesUsed: modulesToUse
    },

    globalRules: {
      goldenRule:
        knowledge.knowledgeBase?.knowledge_base?.agent_behavior?.golden_rule ||
        "Siempre intentar resolver primero antes de pedir datos.",

      resolutionStrategy:
        knowledge.knowledgeBase?.knowledge_base?.agent_behavior?.resolution_strategy || [],

      restrictedCapabilities:
        knowledge.knowledgeBase?.knowledge_base?.restricted_capabilities || []
    }
  };

  modulesToUse.forEach((moduleName) => {
    if (knowledge[moduleName]) {
      context[moduleName] = knowledge[moduleName];
    }
  });

  return context;
}

function buildCompactPromptContext(aiRoute) {
  const context = buildKnowledgeContext(aiRoute);

  return JSON.stringify(context, null, 2);
}

module.exports = {
  loadKnowledgeBase,
  getKnowledgeSummary,
  getRelevantModulesByRoute,
  buildKnowledgeContext,
  buildCompactPromptContext
};
