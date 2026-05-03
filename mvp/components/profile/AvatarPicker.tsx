"use client";

import { useRef, useState, useTransition } from "react";
import { AVATAR_PRESETS, avatarPresetToUrl } from "@/lib/avatars";
import { AvatarDisplay } from "./AvatarDisplay";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { setAvatarPreset, setAvatarUpload, setAvatarAdjust } from "@/lib/actions/profile";

type Props = {
  profileId: string;
  displayName: string;
  colorHex: string | null;
  current: {
    kind: string | null;
    preset: string | null;
    uploadPath: string | null;
    uploadUrl: string | null;
    zoom: number;
    offsetX: number;
    offsetY: number;
  };
};

export function AvatarPicker({ profileId, displayName, colorHex, current }: Props) {
  const [tab, setTab] = useState<"preset" | "upload">(
    current.kind === "upload" ? "upload" : "preset"
  );
  const [zoom, setZoom] = useState(current.zoom);
  const [offsetX, setOffsetX] = useState(current.offsetX);
  const [offsetY, setOffsetY] = useState(current.offsetY);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadUrl, setUploadUrl] = useState<string | null>(current.uploadUrl);
  const [uploadPath, setUploadPath] = useState<string | null>(current.uploadPath);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(current.preset);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickPreset(key: string) {
    setSelectedPreset(key);
    startTransition(async () => {
      await setAvatarPreset(key);
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Bildet er for stort (maks 5 MB)");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${profileId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        alert("Opplasting feilet: " + error.message);
        return;
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setUploadUrl(pub.publicUrl);
      setUploadPath(path);
      // Server-side: oppdater profil
      startTransition(async () => {
        await setAvatarUpload(path, pub.publicUrl);
      });
    } finally {
      setUploading(false);
    }
  }

  function saveAdjust() {
    startTransition(async () => {
      await setAvatarAdjust(zoom, offsetX, offsetY);
    });
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-4">
          <AvatarDisplay
            size={96}
            displayName={displayName}
            colorHex={colorHex}
            avatarKind={tab === "upload" ? "upload" : "preset"}
            avatarPreset={selectedPreset}
            avatarUploadUrl={uploadUrl}
            zoom={zoom}
            offsetX={offsetX}
            offsetY={offsetY}
          />
          <div>
            <div className="font-semibold">{displayName}</div>
            <div className="text-xs text-slate-500">Forhåndsvisning</div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200">
          <TabBtn active={tab === "preset"} onClick={() => setTab("preset")}>
            Velg fra galleri
          </TabBtn>
          <TabBtn active={tab === "upload"} onClick={() => setTab("upload")}>
            Last opp eget bilde
          </TabBtn>
        </div>

        {tab === "preset" && (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-72 overflow-y-auto p-1">
            {AVATAR_PRESETS.map((p) => {
              const selected = p.key === selectedPreset;
              return (
                <button
                  key={p.key}
                  onClick={() => pickPreset(p.key)}
                  disabled={pending}
                  className={`rounded-xl overflow-hidden border-2 transition aspect-square ${
                    selected
                      ? "border-brand-500 ring-2 ring-brand-200"
                      : "border-transparent hover:border-slate-300"
                  }`}
                  title={p.label}
                  style={{ background: "#f1f5f9" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.label} className="w-full h-full" />
                </button>
              );
            })}
          </div>
        )}

        {tab === "upload" && (
          <div className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onFile}
              className="block text-sm"
            />
            {uploading && <p className="text-sm text-slate-500">Laster opp…</p>}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 block">
                Zoom: {zoom.toFixed(2)}×
              </label>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />

              <label className="text-sm font-medium text-slate-700 block mt-3">
                Posisjon X: {offsetX.toFixed(0)}%
              </label>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={offsetX}
                onChange={(e) => setOffsetX(Number(e.target.value))}
                className="w-full"
              />

              <label className="text-sm font-medium text-slate-700 block mt-3">
                Posisjon Y: {offsetY.toFixed(0)}%
              </label>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={offsetY}
                onChange={(e) => setOffsetY(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <Button onClick={saveAdjust} disabled={pending}>
              {pending ? "Lagrer…" : "Lagre justering"}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active
          ? "border-brand-500 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
