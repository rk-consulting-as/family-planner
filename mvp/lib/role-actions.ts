// Katalog over alle actions som kan styres per rolle.
// Synkronisert med can_perform-funksjonen i SQL.

export type Action = {
  key: string;
  label: string;
  description: string;
  category: string;
  owner_only?: boolean; // vises grått for andre roller
};

export const ACTION_CATEGORIES = [
  { key: "group", label: "Gruppe", icon: "🏠" },
  { key: "members", label: "Medlemmer", icon: "👥" },
  { key: "calendar", label: "Kalender", icon: "📅" },
  { key: "chores", label: "Gjøremål", icon: "✅" },
  { key: "habits", label: "Vaner", icon: "🔁" },
  { key: "needs_gifts", label: "Ønsker & Gaver", icon: "🎁" },
  { key: "meals", label: "Mat", icon: "🍽️" },
  { key: "expenses", label: "Utlegg", icon: "💰" },
  { key: "projects", label: "Prosjekter", icon: "📁" },
  { key: "other", label: "Annet", icon: "✨" },
] as const;

export const ACTIONS: Action[] = [
  // Gruppe
  { key: "group.delete", label: "Slett gruppe", description: "Slette hele familien permanent", category: "group", owner_only: true },
  { key: "group.transfer_owner", label: "Overfør eierskap", description: "Gi noen andre eierrollen", category: "group", owner_only: true },
  { key: "roles.manage", label: "Endre rolletillatelser", description: "Justere selve denne matrisen", category: "group" },

  // Medlemmer
  { key: "members.invite", label: "Inviter nye medlemmer", description: "Lage delbar invitasjon", category: "members" },
  { key: "members.approve_invitations", label: "Godkjenn invitasjoner", description: "Akseptere ventende medlemskap", category: "members" },
  { key: "members.remove", label: "Fjern medlemmer", description: "Kaste ut et medlem", category: "members" },
  { key: "members.change_role", label: "Endre roller", description: "Promotere eller degradere medlemmer", category: "members" },
  { key: "members.set_permissions", label: "Sett modul-tilganger", description: "Justere hva andre ser", category: "members" },
  { key: "members.see_last_seen", label: "Se sist pålogget", description: "Hvem var aktiv når", category: "members" },

  // Kalender
  { key: "calendar.create_event", label: "Opprett hendelse", description: "Lage nye kalender-innslag", category: "calendar" },
  { key: "calendar.edit_any_event", label: "Rediger andres hendelser", description: "Endre hendelser ikke laget av seg selv", category: "calendar" },
  { key: "calendar.delete_any_event", label: "Slett andres hendelser", description: "Fjerne hendelser ikke laget av seg selv", category: "calendar" },
  { key: "custody.manage", label: "Bostedsplan", description: "Sette opp hvor barna er", category: "calendar" },
  { key: "timetable.manage", label: "Timeplan", description: "Skoletimer og fast plan", category: "calendar" },

  // Gjøremål
  { key: "chores.create", label: "Opprett gjøremål", description: "Lage nye oppgaver", category: "chores" },
  { key: "chores.assign_to_others", label: "Tildel til andre", description: "Pålegge oppgaver til medlemmer (uten invitasjon)", category: "chores" },
  { key: "chores.approve", label: "Godkjenn fullførte", description: "Frigi belønninger", category: "chores" },
  { key: "chores.delete", label: "Slett gjøremål", description: "Fjerne oppgaver", category: "chores" },

  // Vaner
  { key: "habits.create_for_others", label: "Lag vane for andre", description: "Definere vaner medlemmer skal ha", category: "habits" },

  // Ønsker & Gaver
  { key: "needs.delete_any", label: "Slett andres ønsker", description: "Fjerne ting noen ønsker seg", category: "needs_gifts" },
  { key: "gifts.create_for_others", label: "Lag gaveliste for andre", description: "F.eks. lage liste for et barn", category: "needs_gifts" },

  // Mat
  { key: "meals.manage", label: "Måltidsplan", description: "Lage og redigere ukens menyer", category: "meals" },
  { key: "shopping.clear", label: "Tøm handleliste", description: "Slette alle handlede varer", category: "meals" },

  // Utlegg
  { key: "expenses.create", label: "Legg inn utlegg", description: "Registrere et felles utlegg", category: "expenses" },
  { key: "expenses.edit_any", label: "Rediger andres utlegg", description: "Endre utlegg ikke ført av seg selv", category: "expenses" },
  { key: "expenses.close_period", label: "Gjør opp periode", description: "Avslutte regnskap og starte ny", category: "expenses" },

  // Prosjekter
  { key: "projects.create", label: "Opprett prosjekt", description: "Starte ny sak/utredning", category: "projects" },
  { key: "projects.add_member", label: "Inviter til prosjekt", description: "Legge andre inn i prosjekt", category: "projects" },
  { key: "projects.ai_extract", label: "Bruk AI-uttrekk", description: "Sende dokumenter til Claude (koster penger)", category: "projects" },
  { key: "projects.delete", label: "Slett prosjekt", description: "Fjerne hele prosjektet", category: "projects" },

  // Annet
  { key: "walking.add_for_others", label: "Logg gå-tur for andre", description: "Registrere turer på medlemmers vegne", category: "other" },
  { key: "rewards.manual_grant", label: "Manuell belønning", description: "Tildele penger/poeng uten gjøremål", category: "other" },
];

export const ROLES_TO_SHOW = ["admin", "parent", "member"] as const;

export const ROLE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  owner: { label: "Eier", color: "#7c3aed", icon: "👑" },
  admin: { label: "Admin", color: "#3b82f6", icon: "🛡️" },
  parent: { label: "Forelder/Leder", color: "#10b981", icon: "🌟" },
  member: { label: "Medlem", color: "#94a3b8", icon: "👤" },
};
