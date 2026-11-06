export const homeContentFields = [
  { key: "headline", label: "Titre principal", max: 120, required: true },
  { key: "description", label: "Description principale", max: 500, required: true },
  { key: "eyebrow", label: "Accroche au-dessus du titre", max: 120, required: false },
  { key: "featuresTitle", label: "Titre des fonctionnalités", max: 160, required: false },
  { key: "featuresDescription", label: "Description des fonctionnalités", max: 500, required: false },
  { key: "feature1Title", label: "Fonctionnalité 1 : titre", max: 120, required: false },
  { key: "feature1Description", label: "Fonctionnalité 1 : description", max: 500, required: false },
  { key: "feature2Title", label: "Fonctionnalité 2 : titre", max: 120, required: false },
  { key: "feature2Description", label: "Fonctionnalité 2 : description", max: 500, required: false },
  { key: "feature3Title", label: "Fonctionnalité 3 : titre", max: 120, required: false },
  { key: "feature3Description", label: "Fonctionnalité 3 : description", max: 500, required: false },
  { key: "mobileTitle", label: "Titre de la section mobile", max: 160, required: false },
  { key: "mobileDescription", label: "Description de la section mobile", max: 500, required: false },
] as const;
export type HomeField = typeof homeContentFields[number]["key"];
export type HomeContent = Record<HomeField, string>;
export const emptyHomeContent: HomeContent = Object.fromEntries(homeContentFields.map(({ key }) => [key, ""])) as HomeContent;
export const defaultHomeContent: HomeContent = {
  ...emptyHomeContent,
  headline: "Le club en jeu.\nTout le reste, plus simple.",
  description: "Membres, événements et vie associative, réunis dans un espace pensé pour les clubs de fléchettes.",
  eyebrow: "Le quotidien des clubs de fléchettes",
  featuresTitle: "Tout ce qui fait vivre un club, sans s’éparpiller.",
  featuresDescription: "Une base claire pour les responsables et un point de rendez-vous pour les membres.",
  feature1Title: "Les membres",
  feature1Description: "Retrouvez les adhérents et les informations utiles à la vie associative.",
  feature2Title: "Les événements",
  feature2Description: "Organisez les rendez-vous du club et partagez un agenda lisible.",
  feature3Title: "Un espace commun",
  feature3Description: "Les outils du club et son actualité restent au même endroit.",
  mobileTitle: "Une expérience familière, où que vous soyez.",
  mobileDescription: "Assodarts accompagne déjà les clubs sur iPhone. Le site prolonge cet univers avec des pages publiques et des outils web dédiés.",
};

/** Optional fields absent from older published versions remain empty. */
export function parseHomeContent(value: unknown): HomeContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const parsed = { ...emptyHomeContent };
  for (const field of homeContentFields) {
    const item = data[field.key];
    if (item === undefined && !field.required) continue;
    if (typeof item !== "string" || item.length > field.max || (field.required && !item.trim())) return null;
    parsed[field.key] = item;
  }
  return parsed;
}
export function validHomeContent(value: unknown): value is HomeContent {
  return parseHomeContent(value) !== null;
}
