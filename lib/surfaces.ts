/** Every screen in the app, in nav order. The header and the home page both
 *  read this, so adding a screen cannot leave one of them behind. */
export interface Surface {
  href: string;
  label: string;
  blurb: string;
}

export const SURFACES: Surface[] = [
  {
    href: "/rankings",
    label: "Rankings",
    blurb: "Drag every player into the order you actually believe, with tags and notes.",
  },
  {
    href: "/tiers",
    label: "Tier List",
    blurb: "Group players into tiers, then push those tiers back onto your board.",
  },
  {
    href: "/stats",
    label: "Stats",
    blurb: "Last season's real numbers, sortable, with a page per player.",
  },
  {
    href: "/vegas",
    label: "Vegas",
    blurb: "Projected stats for the season ahead, summed from weekly projections.",
  },
  {
    href: "/mock",
    label: "Mock Draft",
    blurb:
      "Draft against AI teams, or follow a real draft pick by pick, with an assistant explaining each suggestion.",
  },
  {
    href: "/simulate",
    label: "Simulations",
    blurb: "Run hundreds of drafts to see who reaches your picks and which seat wins.",
  },
  {
    href: "/trade",
    label: "Trade Analyzer",
    blurb: "Weigh both sides of a trade against your league's scoring.",
  },
  {
    href: "/league",
    label: "League",
    blurb: "Team count, scoring and starting lineup — every screen reads from it.",
  },
];
