import { Clapperboard, GalleryVerticalEnd, Map, ScrollText, SlidersHorizontal, WandSparkles } from "lucide-react";

export const navigationTools = [
    {
        slug: "canvas",
        icon: Map,
    },
    {
        slug: "image",
        icon: WandSparkles,
    },
    {
        slug: "video",
        icon: Clapperboard,
    },
    {
        slug: "prompts",
        icon: ScrollText,
    },
    {
        slug: "assets",
        icon: GalleryVerticalEnd,
    },
    {
        slug: "config",
        icon: SlidersHorizontal,
    },
] as const;

export type NavigationToolSlug = (typeof navigationTools)[number]["slug"];
