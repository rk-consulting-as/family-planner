"use client";

import { forwardRef } from "react";
import { getTheme } from "@/lib/invitations/themes";
import { getFormat } from "@/lib/invitations/formats";

type Props = {
  title: string;
  hostName: string | null;
  hostAge: number | null;
  occasion: string;
  theme: string;
  format: string;
  eventDate: string | null;
  eventTime: string | null;
  location: string | null;
  locationDetails: string | null;
  dressCode: string | null;
  giftInfo: string | null;
  rsvpDeadline: string | null;
  rsvpContact: string | null;
  generatedText: string | null;
  imageMode: "template" | "ai_generated";
  generatedImageUrl: string | null;
  hostPhotoUrl: string | null;
  venuePhotoUrl: string | null;
  logoUrl: string | null;
  /** Skala for forhåndsvisning. 1.0 = full størrelse. */
  scale?: number;
};

const fontMap = {
  serif: '"Playfair Display", Georgia, serif',
  sans: "system-ui, -apple-system, sans-serif",
  display: '"Fredoka", "Comic Sans MS", system-ui, sans-serif',
  handwritten: '"Caveat", "Brush Script MT", cursive',
};

/**
 * Rendrer invitasjonen i full opphavlig størrelse — wrap denne i en
 * `transform: scale()`-container for å vise mindre i UI.
 *
 * Bruk `ref` til å gi videre til html-to-image for eksport.
 */
const InvitationPreview = forwardRef<HTMLDivElement, Props>(function InvitationPreview(
  props,
  ref
) {
  const theme = getTheme(props.theme);
  const format = getFormat(props.format);
  const isLandscape = format.width > format.height;

  // Skalering — vi rendrer alltid i full piksel-størrelse for konsistent eksport,
  // men kan vises mindre via prop.scale.
  const scale = props.scale ?? 1;

  const wrapperStyle: React.CSSProperties = {
    width: `${format.width * scale}px`,
    height: `${format.height * scale}px`,
  };

  const innerStyle: React.CSSProperties = {
    width: `${format.width}px`,
    height: `${format.height}px`,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    background: theme.bg,
    color: theme.fg,
    fontFamily: fontMap[theme.font],
    position: "relative",
    overflow: "hidden",
  };

  // Skalert tekst-padding så proporsjonene ser like ut i alle formater
  const px = format.width * 0.08;
  const py = format.height * 0.07;

  const dateLabel = props.eventDate
    ? new Date(props.eventDate).toLocaleDateString("nb-NO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const timeLabel = props.eventTime ? props.eventTime.slice(0, 5) : null;

  // Velg hovedbilde: AI-generert hvis valgt og finnes, ellers host_photo eller venue_photo
  const heroImage =
    props.imageMode === "ai_generated" && props.generatedImageUrl
      ? props.generatedImageUrl
      : props.hostPhotoUrl || props.venuePhotoUrl;

  const titleSize = format.width * 0.07;
  const subtitleSize = format.width * 0.035;
  const bodySize = format.width * 0.028;
  const smallSize = format.width * 0.022;

  return (
    <div style={wrapperStyle} className="overflow-hidden">
      <div ref={ref} style={innerStyle}>
        {/* Aksent-stripe øverst */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: format.height * 0.012,
            background: theme.accent,
          }}
        />
        {/* Aksent-stripe nederst */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: format.height * 0.012,
            background: theme.accent,
          }}
        />

        {/* Logo øverst til høyre */}
        {props.logoUrl && (
          <img
            src={props.logoUrl}
            alt="Logo"
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              top: format.height * 0.04,
              right: format.width * 0.05,
              width: format.width * 0.18,
              height: format.width * 0.18,
              objectFit: "contain",
              borderRadius: format.width * 0.03,
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            top: py,
            left: px,
            right: px,
            display: "flex",
            flexDirection: isLandscape ? "row" : "column",
            gap: format.width * 0.04,
            alignItems: isLandscape ? "center" : "stretch",
          }}
        >
          {/* Bilde */}
          {heroImage && (
            <div
              style={{
                flex: isLandscape ? "0 0 45%" : "0 0 auto",
                width: isLandscape ? undefined : "100%",
                aspectRatio: isLandscape ? "4/5" : "16/10",
                borderRadius: format.width * 0.03,
                overflow: "hidden",
                background: theme.accent + "22",
                backgroundImage: `url(${heroImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                border: `${format.width * 0.005}px solid ${theme.accent}`,
              }}
            />
          )}

          {/* Tekst-blokk */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: subtitleSize,
                color: theme.accent,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: format.height * 0.01,
              }}
            >
              {theme.emoji} Du er invitert!
            </div>
            <div
              style={{
                fontSize: titleSize,
                fontWeight: 900,
                lineHeight: 1.05,
                marginBottom: format.height * 0.015,
              }}
            >
              {props.title}
            </div>
            {props.hostName && props.hostAge && (
              <div
                style={{
                  fontSize: subtitleSize,
                  marginBottom: format.height * 0.025,
                  opacity: 0.8,
                }}
              >
                {props.hostName} fyller {props.hostAge} år! 🎈
              </div>
            )}

            {props.generatedText && (
              <div
                style={{
                  fontSize: bodySize,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap",
                  marginBottom: format.height * 0.025,
                }}
              >
                {props.generatedText}
              </div>
            )}
          </div>
        </div>

        {/* Detaljer nederst */}
        <div
          style={{
            position: "absolute",
            bottom: py,
            left: px,
            right: px,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: format.width * 0.03,
            fontSize: smallSize,
            lineHeight: 1.4,
          }}
        >
          {dateLabel && (
            <div>
              <div
                style={{
                  fontSize: smallSize * 0.85,
                  color: theme.accent,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: format.height * 0.005,
                }}
              >
                Når
              </div>
              <div style={{ fontWeight: 600 }}>
                {dateLabel}
                {timeLabel && <> · kl. {timeLabel}</>}
              </div>
            </div>
          )}
          {props.location && (
            <div>
              <div
                style={{
                  fontSize: smallSize * 0.85,
                  color: theme.accent,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: format.height * 0.005,
                }}
              >
                Hvor
              </div>
              <div style={{ fontWeight: 600 }}>{props.location}</div>
              {props.locationDetails && (
                <div style={{ opacity: 0.7, fontSize: smallSize * 0.9 }}>
                  {props.locationDetails}
                </div>
              )}
            </div>
          )}
          {props.dressCode && (
            <div>
              <div
                style={{
                  fontSize: smallSize * 0.85,
                  color: theme.accent,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: format.height * 0.005,
                }}
              >
                Antrekk
              </div>
              <div>{props.dressCode}</div>
            </div>
          )}
          {(props.rsvpDeadline || props.rsvpContact) && (
            <div>
              <div
                style={{
                  fontSize: smallSize * 0.85,
                  color: theme.accent,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: format.height * 0.005,
                }}
              >
                Svar
              </div>
              {props.rsvpDeadline && (
                <div style={{ fontWeight: 600 }}>
                  Innen {new Date(props.rsvpDeadline).toLocaleDateString("nb-NO")}
                </div>
              )}
              {props.rsvpContact && (
                <div style={{ opacity: 0.8 }}>{props.rsvpContact}</div>
              )}
            </div>
          )}
          {props.giftInfo && (
            <div style={{ gridColumn: "1 / -1", opacity: 0.7, fontStyle: "italic" }}>
              {props.giftInfo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default InvitationPreview;
