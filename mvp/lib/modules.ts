// Modul-definisjoner: hva som kan skrus av/på per medlem.

export const MODULES = [
  { key: "calendar", label: "Kalender", icon: "📅", default_member: true },
  { key: "chat", label: "Chat", icon: "💬", default_member: true },
  { key: "chores", label: "Gjøremål", icon: "✅", default_member: true },
  { key: "habits", label: "Vaner", icon: "🔁", default_member: true },
  { key: "needs", label: "Ønsker (ting)", icon: "🛍️", default_member: true },
  { key: "gifts", label: "Gaver/wishlist", icon: "🎁", default_member: true },
  { key: "meals", label: "Måltidsplan", icon: "🍽️", default_member: true },
  { key: "recipes", label: "Oppskrifter", icon: "📖", default_member: true },
  { key: "shopping", label: "Handleliste", icon: "🛒", default_member: true },
  { key: "photos", label: "Fotobibliotek", icon: "📸", default_member: true },
  { key: "rewards", label: "Belønninger", icon: "🏆", default_member: true },
  { key: "walking", label: "Gå-tracker", icon: "👟", default_member: true },
  { key: "expenses", label: "Utlegg", icon: "💰", default_member: false },
  { key: "projects", label: "Prosjekter", icon: "📁", default_member: false },
  { key: "invitations", label: "Invitasjoner", icon: "✉️", default_member: true },
  { key: "member_info", label: "Andres medlemsinfo", icon: "👤", default_member: false },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export type ModuleAccess = Record<ModuleKey, boolean>;

export function defaultsForRole(role: "owner" | "admin" | "member"): ModuleAccess {
  if (role === "owner" || role === "admin") {
    return Object.fromEntries(MODULES.map((m) => [m.key, true])) as ModuleAccess;
  }
  return Object.fromEntries(MODULES.map((m) => [m.key, m.default_member])) as ModuleAccess;
}
