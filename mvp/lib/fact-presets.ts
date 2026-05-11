// Forhåndsvalgte kategorier og forslag til felt for medlems-info.

export const FACT_CATEGORIES = [
  {
    key: "clothing",
    icon: "👕",
    label: "Klær & størrelser",
    suggestions: [
      { icon: "👟", label: "Skostørrelse" },
      { icon: "👕", label: "Overdel-størrelse" },
      { icon: "👖", label: "Bukse-størrelse" },
      { icon: "🧥", label: "Jakke-størrelse" },
      { icon: "🧤", label: "Hanske-størrelse" },
      { icon: "🧢", label: "Hodemål / lue-størrelse" },
      { icon: "💍", label: "Ring-størrelse" },
    ],
  },
  {
    key: "health",
    icon: "🩺",
    label: "Helse",
    suggestions: [
      { icon: "🤧", label: "Allergier" },
      { icon: "💊", label: "Medisiner" },
      { icon: "🩸", label: "Blodtype" },
      { icon: "🦷", label: "Tannlege" },
      { icon: "👨‍⚕️", label: "Fastlege" },
      { icon: "🏥", label: "Forsikringsnummer" },
    ],
  },
  {
    key: "school",
    icon: "🎓",
    label: "Skole/barnehage",
    suggestions: [
      { icon: "🏫", label: "Skole/barnehage" },
      { icon: "📚", label: "Klasse/avdeling" },
      { icon: "👩‍🏫", label: "Kontaktlærer" },
      { icon: "📞", label: "Skolens telefon" },
      { icon: "🤝", label: "Klassekontakt" },
    ],
  },
  {
    key: "contact",
    icon: "📞",
    label: "Kontakt",
    suggestions: [
      { icon: "📱", label: "Mobilnummer" },
      { icon: "📞", label: "Nødkontakt" },
      { icon: "🏠", label: "Adresse" },
    ],
  },
  {
    key: "favorites",
    icon: "⭐",
    label: "Favoritter & preferanser",
    suggestions: [
      { icon: "🍕", label: "Yndlingsmat" },
      { icon: "🚫", label: "Liker ikke (mat)" },
      { icon: "🎮", label: "Yndlings-aktivitet" },
      { icon: "🎨", label: "Yndlingsfarge" },
      { icon: "📺", label: "Favoritt TV/film" },
    ],
  },
  {
    key: "important",
    icon: "📅",
    label: "Viktige datoer",
    suggestions: [
      { icon: "🎂", label: "Fødselsdag (foreldre)" },
      { icon: "💍", label: "Bryllupsdag" },
      { icon: "🎓", label: "Konfirmasjon" },
      { icon: "👶", label: "Dåp" },
    ],
  },
  {
    key: "other",
    icon: "📝",
    label: "Annet",
    suggestions: [],
  },
] as const;

export type FactCategoryKey = (typeof FACT_CATEGORIES)[number]["key"];
