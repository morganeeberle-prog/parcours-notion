// netlify/functions/notion.js
// Variables d'environnement : NOTION_TOKEN, NOTION_APPRENANTS_DB, NOTION_EXERCICES_DB

const NOTION_API = "https://api.notion.com/v1";

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

function rt(text, bold = false, color = null) {
  const ann = { bold, italic: false, strikethrough: false, underline: false, code: false, color: color || "default" };
  return [{ type: "text", text: { content: text }, annotations: ann }];
}

function heading1(text) {
  return { object: "block", type: "heading_1", heading_1: { rich_text: rt(text) } };
}
function heading2(text, color) {
  return { object: "block", type: "heading_2", heading_2: { rich_text: rt(text), color: color || "default" } };
}
function heading3(text) {
  return { object: "block", type: "heading_3", heading_3: { rich_text: rt(text) } };
}
function para(text) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: rt(text) } };
}
function paraEmpty() {
  return { object: "block", type: "paragraph", paragraph: { rich_text: [] } };
}
function todo(text) {
  return { object: "block", type: "to_do", to_do: { rich_text: rt(text), checked: false } };
}
function callout(text, emoji, color) {
  return {
    object: "block", type: "callout",
    callout: { rich_text: rt(text), icon: { type: "emoji", emoji }, color: color || "gray_background" }
  };
}
function divider() {
  return { object: "block", type: "divider", divider: {} };
}
function quote(text) {
  return { object: "block", type: "quote", quote: { rich_text: rt(text) } };
}

// Bloc "espace de travail" — zone vide pour que l'apprenant travaille
function workspaceZone(label) {
  return [
    { object: "block", type: "callout", callout: { rich_text: rt(`✍️ Ton travail — ${label}`), icon: { type: "emoji", emoji: "👇" }, color: "yellow_background" } },
    paraEmpty(),
    paraEmpty(),
    paraEmpty(),
    paraEmpty(),
    paraEmpty(),
  ];
}

function buildTemplate(nomComplet) {
  const blocks = [];

  // En-tête
  blocks.push(heading1(`📋 Mes exercices — ${nomComplet}`));
  blocks.push(callout("Cette page est ta page de travail pour tout le parcours. Chaque module a ses consignes — travaille directement dans les zones jaunes en dessous de chaque exercice.", "💡", "blue_background"));
  blocks.push(divider());

  // ── PRÉAMBULE
  blocks.push(heading2("🟣 Préambule · Découverte de Notion", "purple_background"));
  blocks.push(callout("Objectif : explorer l'interface et comprendre la structure de Notion", "🎯", "purple_background"));
  blocks.push(todo("Connecte-toi à ton compte Notion"));
  blocks.push(todo("Repère dans la barre latérale : ton workspace, tes pages privées, les pages partagées"));
  blocks.push(todo("Clique sur ··· en haut à droite d'une page — explore les options disponibles"));
  blocks.push(todo("Teste le raccourci ⌘/Ctrl + P pour ouvrir la recherche rapide"));
  blocks.push(quote("Note ce que tu découvres ci-dessous :"));
  blocks.push(...workspaceZone("Exploration de l'interface"));
  blocks.push(divider());

  // ── MODULE 1
  blocks.push(heading2("🔵 Module 1 · Fondations", "blue_background"));

  // Leçon 1 — Pages
  blocks.push(heading3("Leçon 1 · Pages & sous-pages"));
  blocks.push(callout("Objectif : enrichir ta page de travail et maîtriser la navigation", "🎯", "gray_background"));
  blocks.push(todo("Ajoute une icône 🏠 et une image de couverture à cette page"));
  blocks.push(todo("Crée 3 sous-pages ici : 📁 Projets · 🗒️ Notes · 📚 Ressources"));
  blocks.push(todo("Déplace une sous-page par glisser-déposer dans la sidebar"));
  blocks.push(todo("Utilise ⌘/Ctrl + P pour retrouver ta page Notes"));
  blocks.push(quote("Décris ce que tu as créé :"));
  blocks.push(...workspaceZone("Pages & sous-pages"));

  // Leçon 2 — Blocs
  blocks.push(heading3("Leçon 2 · Les blocs, cœur de Notion"));
  blocks.push(callout("Objectif : insérer, réorganiser et combiner des blocs", "🎯", "gray_background"));
  blocks.push(todo("Dans ta page Notes, tape / et insère un Titre H1"));
  blocks.push(todo("Ajoute un bloc Encadré (Callout) avec un emoji de ton choix"));
  blocks.push(todo("Crée 3 titres H2 puis insère un Sommaire (Table of contents) tout en haut"));
  blocks.push(todo("Glisse un bloc à côté d'un autre pour créer 2 colonnes"));
  blocks.push(quote("Décris ce que tu as fait et ce qui t'a posé problème :"));
  blocks.push(...workspaceZone("Les blocs"));

  // Leçon 3 — BDD
  blocks.push(heading3("Leçon 3 · Les bases de données"));
  blocks.push(callout("Objectif : créer une base multi-vues dans ta page Projets", "🎯", "gray_background"));
  blocks.push(todo("Dans ta page Projets, tape /base et crée une base « Tâches » en vue Tableau"));
  blocks.push(todo("Ajoute une propriété Statut (sélection unique : À faire / En cours / Terminé)"));
  blocks.push(todo("Ajoute une propriété Date d'échéance"));
  blocks.push(todo("Saisis 5 tâches avec des statuts différents"));
  blocks.push(todo("Ajoute une vue Board : clique + Ajouter une vue → Board → groupe par Statut"));
  blocks.push(todo("Ajoute une vue Calendrier pour voir les tâches par date"));
  blocks.push(todo("Crée un filtre « Statut = En cours » sur la vue Tableau"));
  blocks.push(quote("Qu'as-tu compris sur la logique une base = plusieurs vues ?"));
  blocks.push(...workspaceZone("Bases de données"));

  // Leçon 4 — Wikis
  blocks.push(heading3("Leçon 4 · Wikis & confidentialité"));
  blocks.push(callout("Objectif : transformer une page en wiki et comprendre les permissions", "🎯", "gray_background"));
  blocks.push(todo("Ouvre ta page Ressources"));
  blocks.push(todo("Clique sur ··· en haut à droite → Turn into wiki"));
  blocks.push(todo("Désigne-toi comme propriétaire de la page"));
  blocks.push(todo("Crée une sous-page FAQ et marque-la comme Vérifiée"));
  blocks.push(todo("Ajoute 3 questions/réponses avec des blocs Bascule (toggle)"));
  blocks.push(todo("Vérifie la différence entre section Privé et section Partagé dans la sidebar"));
  blocks.push(quote("Notes sur la confidentialité et les wikis :"));
  blocks.push(...workspaceZone("Wikis & confidentialité"));
  blocks.push(divider());

  // ── MODULE 2
  blocks.push(heading2("🟢 Module 2 · Partage & collaboration", "green_background"));

  // Leçon 5 — Partage
  blocks.push(heading3("Leçon 5 · Partager une page"));
  blocks.push(callout("Objectif : maîtriser les niveaux d'accès Notion", "🎯", "gray_background"));
  blocks.push(todo("Clique sur Share en haut à droite d'une de tes pages"));
  blocks.push(todo("Invite une adresse e-mail avec le niveau Can comment"));
  blocks.push(todo("Active un lien public (onglet Publish) et teste-le en navigation privée"));
  blocks.push(todo("Vérifie que les sous-pages héritent bien des permissions de la page parente"));
  blocks.push(quote("Quelle différence entre les 4 niveaux d'accès ?"));
  blocks.push(...workspaceZone("Partage"));

  // Leçon 6 — Commentaires
  blocks.push(heading3("Leçon 6 · Commentaires & @mentions"));
  blocks.push(callout("Objectif : collaborer directement dans la page", "🎯", "gray_background"));
  blocks.push(todo("Sélectionne un texte dans ta page Notes et ajoute un commentaire"));
  blocks.push(todo("Dans ce commentaire, tape @ et mentionne morgane.eberle@live.fr"));
  blocks.push(todo("Dans un autre commentaire, @mentionne ta page Projets pour créer un lien"));
  blocks.push(todo("Résous le premier commentaire une fois traité"));
  blocks.push(quote("Retour d'expérience sur les @mentions :"));
  blocks.push(...workspaceZone("Commentaires & mentions"));

  // Leçon 7 — Temps réel
  blocks.push(heading3("Leçon 7 · Collaborer en temps réel"));
  blocks.push(callout("Objectif : explorer l'historique et l'édition simultanée", "🎯", "gray_background"));
  blocks.push(todo("Ouvre une de tes pages dans 2 onglets différents et édite des deux côtés"));
  blocks.push(todo("Clique sur ··· → Version history pour voir l'historique des modifications"));
  blocks.push(todo("Restaure une version précédente puis annule la restauration"));
  blocks.push(quote("Ce que tu as observé :"));
  blocks.push(...workspaceZone("Collaboration temps réel"));
  blocks.push(divider());

  // ── MODULE 3
  blocks.push(heading2("🟠 Module 3 · Gérer un projet", "orange_background"));

  // Leçon 8 — OKR
  blocks.push(heading3("Leçon 8 · OKR → Projets → Tâches"));
  blocks.push(callout("Objectif : structurer un vrai projet selon la logique OKR", "🎯", "gray_background"));
  blocks.push(todo("Dans ta page Projets, rédige 1 objectif trimestriel qualitatif"));
  blocks.push(todo("Définis 2 résultats clés mesurables pour cet objectif"));
  blocks.push(todo("Liste 2 projets qui contribuent à cet objectif"));
  blocks.push(todo("Pour chaque projet, note 3 tâches concrètes"));
  blocks.push(todo("Vérifie que chaque tâche peut bien se rattacher à son projet — si non, questionne sa pertinence"));
  blocks.push(quote("Mon objectif + résultats clés :"));
  blocks.push(...workspaceZone("OKR & hiérarchie"));

  // Leçon 9 — Relations
  blocks.push(heading3("Leçon 9 · Relations & rollups"));
  blocks.push(callout("Objectif : connecter une base Projets à une base Comptes rendus", "🎯", "gray_background"));
  blocks.push(todo("Dans ta page Projets, crée une base « Mes Projets » (colonnes : Nom, Statut)"));
  blocks.push(todo("Crée une base « Comptes rendus » (colonnes : Titre, Date, Notes)"));
  blocks.push(todo("Dans Comptes rendus → + Ajouter une propriété → type Relation → sélectionne Mes Projets → active Bidirectionnelle → confirme"));
  blocks.push(todo("Saisis 2 projets et 3 comptes rendus, puis lie chaque CR à son projet"));
  blocks.push(todo("Dans Mes Projets → + Ajouter une propriété → type Rollup → champ Comptes rendus → Count → confirme"));
  blocks.push(todo("Ouvre une fiche Projet et vérifie que tu vois ses CR associés"));
  blocks.push(quote("Ce que tu as compris sur les relations bidirectionnelles :"));
  blocks.push(...workspaceZone("Relations & rollups"));

  // Leçon 10 — Dashboard
  blocks.push(heading3("Leçon 10 · Piloter l'avancement"));
  blocks.push(callout("Objectif : créer un tableau de bord de pilotage complet", "🎯", "gray_background"));
  blocks.push(todo("Dans ta base Tâches, ajoute les propriétés Responsable et Échéance"));
  blocks.push(todo("Crée une vue Kanban groupée par Statut"));
  blocks.push(todo("Crée une vue filtrée « Mes tâches cette semaine » (filtre : Échéance = cette semaine)"));
  blocks.push(todo("Dans Mes Projets, ajoute un rollup % terminé (Count checked / Count all)"));
  blocks.push(todo("Crée une nouvelle page « Tableau de bord » et insère tes 3 bases en vue inline"));
  blocks.push(quote("Comment vas-tu utiliser ce tableau de bord au quotidien ?"));
  blocks.push(...workspaceZone("Tableau de bord"));
  blocks.push(divider());

  // ── BILAN
  blocks.push(heading2("🏅 Bilan & réflexions", "yellow_background"));
  blocks.push(para("Ce que j'ai le mieux compris :"));
  blocks.push(paraEmpty());
  blocks.push(para("Ce que je veux approfondir :"));
  blocks.push(paraEmpty());
  blocks.push(para("Comment je vais utiliser Notion au quotidien :"));
  blocks.push(paraEmpty());

  return blocks;
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
      "Email":          { email },
      "Niveau Notion":  { number: parseInt(niveau) },
      "Date de début":  { date: { start: now } },
    },
  });
  const apprenantId = apprenantPage.id;

  // 2. Construire le template
  const allBlocks = buildTemplate(nomComplet);
  const batches = [];
  for (let i = 0; i < allBlocks.length; i += 100) {
    batches.push(allBlocks.slice(i, i + 100));
  }

  // 3. Créer page exercices avec le premier lot
  const exercicesPage = await notionFetch("/pages", "POST", {
    parent: { database_id: process.env.NOTION_EXERCICES_DB },
    properties: {
      "Nom":               { title:     [{ text: { content: `Exercices — ${nomComplet}` } }] },
      "Apprenant":         { relation:  [{ id: apprenantId }] },
      "Nom Apprenant":     { rich_text: [{ text: { content: nomComplet } }] },
      "Email":             { email },
      "Statut correction": { select: { name: "À corriger" } },
    },
    icon: { type: "emoji", emoji: "📋" },
    children: batches[0] || [],
  });

  // 4. Lots suivants
  for (let i = 1; i < batches.length; i++) {
    await notionFetch(`/blocks/${exercicesPage.id}/children`, "PATCH", { children: batches[i] });
  }

  // 5. Lien retour apprenant → exercices
  await notionFetch(`/pages/${apprenantId}`, "PATCH", {
    properties: { "Page exercices": { relation: [{ id: exercicesPage.id }] } },
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
