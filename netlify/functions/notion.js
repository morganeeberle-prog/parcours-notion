// netlify/functions/notion.js
// Variables d'environnement requises :
//   NOTION_TOKEN, NOTION_APPRENANTS_DB, NOTION_EXERCICES_DB

const NOTION_API = "https://api.notion.com/v1";
const TEMPLATE_PAGE_ID = "37f45dcc-4800-815b-9344-eef3ccd5b9a7";

function getHeaders() {
  return {
    "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
}

async function notionFetch(path, method = "GET", body = null) {
  const opts = { method, headers: getHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${NOTION_API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Notion API error on ${path}`);
  return data;
}

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

function cleanRichText(rtArray) {
  if (!rtArray) return [];
  return rtArray.map(rt => {
    const clean = { type: rt.type };
    if (rt.type === "text") {
      clean.text = { content: rt.text.content };
      if (rt.text.link) clean.text.link = rt.text.link;
    }
    if (rt.annotations) clean.annotations = rt.annotations;
    return clean;
  });
}

function cleanBlock(block) {
  const type = block.type;
  if (!type) return null;

  const inner = block[type];
  if (!inner) return null;

  const cleaned = { object: "block", type };

  const cleanedInner = {};

  // rich_text
  if (inner.rich_text !== undefined) {
    cleanedInner.rich_text = cleanRichText(inner.rich_text);
  }

  // checked (to_do)
  if (inner.checked !== undefined) cleanedInner.checked = inner.checked;

  // color
  if (inner.color && inner.color !== "default") cleanedInner.color = inner.color;

  // icon (callout)
  if (inner.icon) cleanedInner.icon = inner.icon;

  // language (code)
  if (inner.language) cleanedInner.language = inner.language;

  cleaned[type] = cleanedInner;
  return cleaned;
}

async function handleRegister(body) {
  const { prenom, nom, email, niveau } = body;
  const nomComplet = `${prenom} ${nom}`.trim();
  const now = new Date().toISOString();

  // 1. Créer fiche apprenant
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

  // 2. Récupérer et nettoyer les blocs du template
  const rawBlocks = await fetchAllBlocks(TEMPLATE_PAGE_ID);
  const children = rawBlocks.map(cleanBlock).filter(Boolean);
  const firstBatch = children.slice(0, 100);
  const restBatches = [];
  for (let i = 100; i < children.length; i += 100) {
    restBatches.push(children.slice(i, i + 100));
  }

  // 3. Créer page exercices avec les 100 premiers blocs
  const exercicesPage = await notionFetch("/pages", "POST", {
    parent: { database_id: process.env.NOTION_EXERCICES_DB },
    properties: {
      "Nom":               { title:     [{ text: { content: `Exercices — ${nomComplet}` } }] },
      "Apprenant":         { relation:  [{ id: apprenantId }] },
      "Nom Apprenant":     { rich_text: [{ text: { content: nomComplet } }] },
      "Email":             { email: email },
      "Statut correction": { select: { name: "À corriger" } },
    },
    icon: { type: "emoji", emoji: "📋" },
    children: firstBatch,
  });

  // 3b. Ajouter les blocs restants par lots de 100
  for (const batch of restBatches) {
    await notionFetch(`/blocks/${exercicesPage.id}/children`, "PATCH", { children: batch });
  }

  // 4. Lien retour apprenant → exercices
  await notionFetch(`/pages/${apprenantId}`, "PATCH", {
    properties: {
      "Page exercices": { relation: [{ id: exercicesPage.id }] },
    },
  });

  return { apprenantId, exercicesUrl: exercicesPage.url, nomComplet };
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

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method Not Allowed" };

  try {
    const body = JSON.parse(event.body || "{}");
    const { action } = body;
    let result;
    if (action === "register")      result = await handleRegister(body);
    else if (action === "complete") result = await handleComplete(body);
    else throw new Error(`Action inconnue : ${action}`);

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("Notion function error:", err);
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
