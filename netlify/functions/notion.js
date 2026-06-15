// netlify/functions/notion.js
// Toutes les interactions Notion passent par ici — la clé API n'est jamais exposée côté client.
//
// Variables d'environnement requises dans Netlify :
//   NOTION_TOKEN          → ton Integration Token (secret_xxx)
//   NOTION_APPRENANTS_DB  → ID de la base "Bd-Apprenants"           : ab92bef1fc0949f284dc7486c7b4c7a0
//   NOTION_EXERCICES_DB   → ID de la base "Exercices Apprenant"     : 812cc601380a4525b4e0a328fd775654
//
// Architecture :
//   - handleRegister : crée la fiche apprenant + duplique la page template exercices
//   - handleComplete : marque la fin du parcours (date + checkbox)
//
// Template exercices (page Notion à NE PAS supprimer) :
//   ID : 37f45dcc4800815b9344eef3ccd5b9a7
//   URL : https://app.notion.com/p/37f45dcc4800815b9344eef3ccd5b9a7

const NOTION_API = "https://api.notion.com/v1";

// ID de la page template exercices créée dans Notion
// ⚠️ Ne jamais supprimer cette page dans Notion
const TEMPLATE_PAGE_ID = "37f45dcc-4800-815b-9344-eef3ccd5b9a7";

function getHeaders() {
  return {
    "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
}

// ---------- helpers ----------
async function notionFetch(path, method = "GET", body = null) {
  const opts = { method, headers: getHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${NOTION_API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Notion API error on ${path}`);
  return data;
}

// ---------- Récupère tous les blocs enfants d'une page (paginé) ----------
async function fetchAllBlocks(pageId) {
  let blocks = [];
  let cursor = undefined;
  do {
    const params = cursor ? `?start_cursor=${cursor}` : "";
    const res = await notionFetch(`/blocks/${pageId}/children${params}`);
    blocks = blocks.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

// ---------- Nettoie un bloc pour le réutiliser (supprime les IDs Notion) ----------
function cleanBlock(block) {
  const { id, created_time, last_edited_time, created_by, last_edited_by,
          has_children, parent, archived, ...clean } = block;
  return clean;
}

// ---------- Handlers ----------

async function handleRegister(body) {
  const { prenom, nom, email, niveau } = body;
  const nomComplet = `${prenom} ${nom}`.trim();
  const now = new Date().toISOString();

  // 1. Créer la fiche apprenant dans Bd-Apprenants
  const apprenantPage = await notionFetch("/pages", "POST", {
    parent: { database_id: process.env.NOTION_APPRENANTS_DB },
    properties: {
      "Nom":            { title:     [{ text: { content: nomComplet } }] },
      "Prénom":         { rich_text: [{ text: { content: prenom } }] },
      "Nom de famille": { rich_text: [{ text: { content: nom } }] },
      "Email":          { email: email },
      "Niveau Notion":  { number: parseInt(niveau) },
      "Date de début":  { date: { start: now } },
    },
  });

  const apprenantId = apprenantPage.id;

  // 2. Récupérer les blocs du template exercices
  const templateBlocks = await fetchAllBlocks(TEMPLATE_PAGE_ID);
  const cleanedBlocks = templateBlocks.map(cleanBlock);

  // 3. Créer la page exercices personnalisée dans Exercices Apprenant
  //    avec le contenu dupliqué du template + les propriétés apprenant
  const exercicesPage = await notionFetch("/pages", "POST", {
    parent: { database_id: process.env.NOTION_EXERCICES_DB },
    properties: {
      "Nom":            { title:     [{ text: { content: `Exercices — ${nomComplet}` } }] },
      "Apprenant":      { relation:  [{ id: apprenantId }] },
      "Nom Apprenant":  { rich_text: [{ text: { content: nomComplet } }] },
      "Email":          { email: email },
      "Statut correction": { select: { name: "À corriger" } },
    },
    icon:     { type: "emoji", emoji: "📋" },
    children: cleanedBlocks,
  });

  // 4. Mettre à jour la fiche apprenant avec le lien retour vers les exercices
  await notionFetch(`/pages/${apprenantId}`, "PATCH", {
    properties: {
      "Page exercices": { relation: [{ id: exercicesPage.id }] },
    },
  });

  return {
    apprenantId,
    exercicesUrl: exercicesPage.url,
    nomComplet,
  };
}

async function handleComplete(body) {
  const { apprenantId } = body;
  const now = new Date().toISOString();

  await notionFetch(`/pages/${apprenantId}`, "PATCH", {
    properties: {
      "Date de fin":      { date: { start: now } },
      "Parcours terminé": { checkbox: true },
    },
  });

  return { ok: true };
}

// ---------- Main handler ----------
exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { action } = body;

    let result;
    if (action === "register")       result = await handleRegister(body);
    else if (action === "complete")  result = await handleComplete(body);
    else throw new Error(`Action inconnue : ${action}`);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("Notion function error:", err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
