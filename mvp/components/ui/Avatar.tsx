// Gjenbrukbar avatar-komponent.
// Viser bilde hvis avatar_url finnes, ellers initialer på fargebakgrunn.

import React from "react";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const sizeMap: Record<Size, { px: number; text: string }> = {
  xs: { px: 20, text: "text-[10px]" },
  sm: { px: 28, text: "text-xs" },
  md: { px: 36, text: "text-sm" },
  lg: { px: 48, text: "text-base" },
  xl: { px: 64, text: "text-lg" },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  name,
  avatarUrl,
  colorHex,
  size = "md",
  ring = false,
  className = "",
}: {
  name: string;
  avatarUrl?: string | null;
  colorHex?: string | null;
  size?: Size;
  ring?: boolean;
  className?: string;
}) {
  const dim = sizeMap[size];
  const ringClass = ring ? "ring-2 ring-white shadow-sm" : "";
  const style: React.CSSProperties = {
    width: dim.px,
    height: dim.px,
    background: colorHex || "#7C3AED",
  };

  if (avatarUrl) {
    return (
      <span
        className={`inline-block rounded-full overflow-hidden flex-shrink-0 ${ringClass} ${className}`}
        style={{ width: dim.px, height: dim.px }}
        title={name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-semibold flex-shrink-0 ${dim.text} ${ringClass} ${className}`}
      style={style}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

// Stack — viser flere avatarer overlappende (f.eks. deltakere på en hendelse)
export function AvatarStack({
  members,
  size = "sm",
  max = 4,
}: {
  members: Array<{ display_name: string; avatar_url?: string | null; color_hex?: string | null }>;
  size?: Size;
  max?: number;
}) {
  const visible = members.slice(0, max);
  const extra = members.length - visible.length;
  return (
    <span className="inline-flex items-center">
      {visible.map((m, i) => (
        <span
          key={i}
          className="-ml-1.5 first:ml-0"
          style={{ zIndex: visible.length - i }}
        >
          <UserAvatar
            name={m.display_name}
            avatarUrl={m.avatar_url}
            colorHex={m.color_hex}
            size={size}
            ring
          />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="-ml-1.5 inline-flex items-center justify-center rounded-full bg-slate-200 text-slate-600 font-semibold text-[10px] ring-2 ring-white"
          style={{ width: sizeMap[size].px, height: sizeMap[size].px }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
