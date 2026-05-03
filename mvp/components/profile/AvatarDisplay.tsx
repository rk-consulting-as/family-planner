import { avatarPresetToUrl, initials } from "@/lib/avatars";

type Props = {
  size?: number;
  displayName: string;
  colorHex?: string | null;
  avatarKind?: string | null;
  avatarPreset?: string | null;
  avatarUploadUrl?: string | null;
  zoom?: number | null;
  offsetX?: number | null;
  offsetY?: number | null;
  className?: string;
};

export function AvatarDisplay({
  size = 64,
  displayName,
  colorHex,
  avatarKind,
  avatarPreset,
  avatarUploadUrl,
  zoom,
  offsetX,
  offsetY,
  className = "",
}: Props) {
  const url =
    avatarKind === "upload" && avatarUploadUrl
      ? avatarUploadUrl
      : avatarKind === "preset"
      ? avatarPresetToUrl(avatarPreset)
      : null;

  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: colorHex || "#7C3AED",
  };

  if (!url) {
    return (
      <span
        className={`rounded-full grid place-items-center text-white font-semibold ${className}`}
        style={{ ...style, fontSize: Math.round(size * 0.4) }}
        aria-label={displayName}
      >
        {initials(displayName)}
      </span>
    );
  }

  const z = Number(zoom ?? 1);
  const ox = Number(offsetX ?? 0);
  const oy = Number(offsetY ?? 0);

  return (
    <span
      className={`rounded-full overflow-hidden inline-block ${className}`}
      style={style}
      aria-label={displayName}
    >
      <img
        src={url}
        alt={displayName}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${z}) translate(${ox}%, ${oy}%)`,
          transformOrigin: "center",
        }}
      />
    </span>
  );
}
