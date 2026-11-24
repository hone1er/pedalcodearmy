"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Printer, Star, ArrowLeft, Send, Type, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// Google Fonts used by the customizer. Loaded only on this page (see
// useCustomizerFonts) so the rest of the site doesn't pay for 17 font families.
const CUSTOMIZER_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Anton&family=Bangers&family=Bebas+Neue&family=Black+Ops+One&family=Bungee&family=Lobster&family=Montserrat:wght@700&family=Orbitron:wght@700&family=Oswald:wght@700&family=Pacifico&family=Permanent+Marker&family=Racing+Sans+One&family=Righteous&family=Roboto+Condensed:wght@700&family=Russo+One&family=Teko:wght@600&display=swap";
const CUSTOMIZER_FONTS_LINK_ID = "pca-customizer-fonts";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Inject the customizer font stylesheet once; remove it when leaving the page. */
function useCustomizerFonts() {
  useEffect(() => {
    if (document.getElementById(CUSTOMIZER_FONTS_LINK_ID)) return;

    const preconnects = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"].map(
      (href) => {
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = href;
        if (href.includes("gstatic")) link.crossOrigin = "anonymous";
        document.head.appendChild(link);
        return link;
      },
    );

    const stylesheet = document.createElement("link");
    stylesheet.id = CUSTOMIZER_FONTS_LINK_ID;
    stylesheet.rel = "stylesheet";
    stylesheet.href = CUSTOMIZER_FONTS_HREF;
    document.head.appendChild(stylesheet);

    return () => {
      stylesheet.remove();
      preconnects.forEach((link) => link.remove());
    };
  }, []);
}

const FONT_CATEGORIES = [
  {
    label: "Bold & Blocky",
    fonts: [
      { value: "'Bebas Neue', sans-serif", label: "Bebas Neue" },
      { value: "Impact, sans-serif", label: "Impact" },
      { value: "'Anton', sans-serif", label: "Anton" },
      { value: "'Black Ops One', sans-serif", label: "Black Ops One" },
    ],
  },
  {
    label: "Racing & Sport",
    fonts: [
      { value: "'Racing Sans One', sans-serif", label: "Racing Sans One" },
      { value: "'Russo One', sans-serif", label: "Russo One" },
      { value: "'Teko', sans-serif", label: "Teko" },
      { value: "'Orbitron', sans-serif", label: "Orbitron" },
    ],
  },
  {
    label: "Classic Sans",
    fonts: [
      { value: "Arial, sans-serif", label: "Arial" },
      { value: "'Oswald', sans-serif", label: "Oswald" },
      { value: "'Montserrat', sans-serif", label: "Montserrat" },
      { value: "'Roboto Condensed', sans-serif", label: "Roboto Condensed" },
    ],
  },
  {
    label: "Serif & Slab",
    fonts: [
      { value: "Georgia, serif", label: "Georgia" },
      { value: "'Alfa Slab One', serif", label: "Alfa Slab One" },
      { value: "'Righteous', sans-serif", label: "Righteous" },
      { value: "'Bungee', sans-serif", label: "Bungee" },
    ],
  },
  {
    label: "Handwritten & Fun",
    fonts: [
      { value: "'Permanent Marker', cursive", label: "Permanent Marker" },
      { value: "'Bangers', cursive", label: "Bangers" },
      { value: "'Lobster', cursive", label: "Lobster" },
      { value: "'Pacifico', cursive", label: "Pacifico" },
    ],
  },
];

// Flat list for lookups
const FONTS = FONT_CATEGORIES.flatMap((category) => category.fonts);

/**
 * Text sizes. `cqw` is a percentage of the preview's width, so the preview keeps
 * the same proportions on a phone as on a desktop (based on the original
 * 20–48px sizes at a ~450px-wide preview).
 */
const SIZE_OPTIONS = [
  { value: "xs", label: "XS", cqw: 4.4 },
  { value: "s", label: "S", cqw: 5.8 },
  { value: "m", label: "M", cqw: 7.1 },
  { value: "l", label: "L", cqw: 8.9 },
  { value: "xl", label: "XL", cqw: 10.7 },
] as const;

type SizeValue = (typeof SIZE_OPTIONS)[number]["value"];

const LETTER_SPACING_OPTIONS = [
  { value: "0", label: "Tight" },
  { value: "0.05em", label: "Normal" },
  { value: "0.15em", label: "Wide" },
  { value: "0.25em", label: "Extra Wide" },
];

const TEXT_CASE_OPTIONS = [
  { value: "none", label: "As Typed" },
  { value: "uppercase", label: "UPPERCASE" },
  { value: "lowercase", label: "lowercase" },
];

const SIDE_OPTIONS = [
  { value: "left", label: "Left Only" },
  { value: "right", label: "Right Only" },
  { value: "both", label: "Both Sides" },
] as const;

type SideOption = (typeof SIDE_OPTIONS)[number]["value"];

const MAX_TEXT_LENGTH = 15;
const PLAIN_SIDE_PRICE = 50;
const CUSTOM_SIDE_PRICE = 60;

const DEFAULTS = {
  side: "right" as SideOption,
  font: "'Bebas Neue', sans-serif",
  size: "m" as SizeValue,
  letterSpacing: "0.05em",
  textCase: "uppercase",
};

const EMPTY_FORM = { name: "", email: "", message: "", hpCheck: "" };

/** Read an API error message without assuming the response body is JSON. */
async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    try {
      const data = JSON.parse(text) as { error?: unknown };
      if (typeof data.error === "string" && data.error.trim()) {
        return data.error;
      }
    } catch {
      // Not JSON (e.g. an HTML error page) — fall through.
    }
  } catch {
    // Body unreadable — fall through.
  }
  return fallback;
}

function RetroStripe() {
  return (
    <div className="my-8 flex items-center justify-center gap-1" aria-hidden="true">
      <div className="h-2 w-16 bg-orange-500" />
      <div className="h-2 w-8 bg-black" />
      <div className="h-2 w-16 bg-[#FFD700]" />
      <div className="h-2 w-8 bg-black" />
      <div className="h-2 w-16 bg-orange-500" />
    </div>
  );
}

function RetroBadge({
  children,
  color = "orange",
}: {
  children: React.ReactNode;
  color?: "orange" | "gold" | "black";
}) {
  const colors = {
    orange: "bg-orange-700 text-white border-black",
    gold: "bg-[#FFD700] text-black border-black",
    black: "bg-black text-[#FFD700] border-gray-700",
  };
  return (
    <span
      className={`inline-block rotate-[-3deg] rounded border-2 border-b-4 px-2 py-0.5 text-xs font-black uppercase tracking-wider ${colors[color]}`}
    >
      {children}
    </span>
  );
}

/**
 * Accessible single-choice button group (WAI-ARIA radio group pattern with
 * roving tabindex and arrow-key navigation).
 */
function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  buttonClassName = "px-2 py-2 text-sm uppercase",
  labelClassName = "mb-2 block text-sm font-black uppercase text-black",
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  buttonClassName?: string;
  labelClassName?: string;
}) {
  const labelId = useId();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const next = options[nextIndex];
    if (next) {
      onChange(next.value);
      buttonRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div>
      <p id={labelId} className={labelClassName}>
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex gap-1">
        {options.map((option, index) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`flex-1 rounded-none border-2 border-black font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${buttonClassName} ${
                checked ? "bg-black text-[#FFD700]" : "bg-white text-black hover:bg-gray-100"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function applyTextCase(text: string, textCase: string): string {
  if (textCase === "uppercase") return text.toUpperCase();
  if (textCase === "lowercase") return text.toLowerCase();
  return text;
}

function SideCoverPreview({
  side,
  text,
  font,
  sizeCqw,
  letterSpacing,
  textCase,
}: {
  side: "left" | "right";
  text: string;
  font: string;
  sizeCqw: number;
  letterSpacing: string;
  textCase: string;
}) {
  const isLeft = side === "left";
  const areaRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const displayText = applyTextCase(text, textCase);

  // Shrink-to-fit so long text in wide fonts never overflows the cover.
  const measure = useCallback(() => {
    const area = areaRef.current;
    const span = textRef.current;
    if (!area || !span) return;
    const styles = window.getComputedStyle(area);
    const available =
      area.clientWidth -
      Number.parseFloat(styles.paddingLeft || "0") -
      Number.parseFloat(styles.paddingRight || "0");
    const natural = span.offsetWidth;
    const next = natural > 0 && available > 0 ? Math.min(1, available / natural) : 1;
    setFitScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
  }, []);

  useIsomorphicLayoutEffect(() => {
    measure();
  }, [measure, displayText, font, sizeCqw, letterSpacing]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(area);
    // Re-measure once web fonts finish loading (metrics change).
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [measure, font]);

  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-none border-2 border-gray-400 bg-gray-100"
      style={{ containerType: "inline-size" }}
    >
      <Image
        src="/images/products/SideCoverRight.png"
        alt={`Puch Magnum ${side} side cover${text ? ` with "${displayText}" embossed` : ""}`}
        fill
        sizes="(max-width: 1024px) 90vw, 480px"
        className="object-contain"
        style={isLeft ? { transform: "scaleX(-1)" } : undefined}
        priority
      />
      {/* Embossed Text Overlay */}
      <div
        ref={areaRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{
          paddingTop: "15%",
          paddingLeft: isLeft ? "8%" : "13%",
          paddingRight: isLeft ? "13%" : "8%",
        }}
        aria-hidden="true"
      >
        {text && (
          <span
            ref={textRef}
            className="select-none whitespace-nowrap"
            style={{
              fontFamily: font,
              fontSize: `${sizeCqw}cqw`,
              fontWeight: "bold",
              color: "rgba(40, 40, 40, 0.85)",
              textShadow: `
                1px 1px 1px rgba(255,255,255,0.15),
                -1px -1px 1px rgba(0,0,0,0.35),
                0px 0px 2px rgba(0,0,0,0.2)
              `,
              letterSpacing,
              transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
              transformOrigin: "center",
            }}
          >
            {displayText}
          </span>
        )}
      </div>
      {/* Side Label */}
      <div className="absolute bottom-2 left-2 rounded-none border-2 border-black bg-white px-2 py-1">
        <span className="text-xs font-black uppercase text-black">{side} Side</span>
      </div>
    </div>
  );
}

export default function SideCoverCustomizer() {
  useCustomizerFonts();

  const [selectedSide, setSelectedSide] = useState<SideOption>(DEFAULTS.side);
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [selectedFont, setSelectedFont] = useState(DEFAULTS.font);
  const [fontSize, setFontSize] = useState<SizeValue>(DEFAULTS.size);
  const [letterSpacing, setLetterSpacing] = useState(DEFAULTS.letterSpacing);
  const [textCase, setTextCase] = useState(DEFAULTS.textCase);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const customizerTopRef = useRef<HTMLDivElement | null>(null);

  const ids = useId();
  const leftTextId = `${ids}-left-text`;
  const rightTextId = `${ids}-right-text`;
  const leftCountId = `${ids}-left-count`;
  const rightCountId = `${ids}-right-count`;
  const fontId = `${ids}-font`;
  const nameId = `${ids}-name`;
  const emailId = `${ids}-email`;
  const notesId = `${ids}-notes`;
  const hpCheckId = `${ids}-hp-check`;
  const errorId = `${ids}-error`;

  const includesLeft = selectedSide === "left" || selectedSide === "both";
  const includesRight = selectedSide === "right" || selectedSide === "both";
  const activeLeftText = includesLeft ? leftText.trim() : "";
  const activeRightText = includesRight ? rightText.trim() : "";

  const isCustom = activeLeftText.length > 0 || activeRightText.length > 0;
  const sidePrice = (text: string) => (text ? CUSTOM_SIDE_PRICE : PLAIN_SIDE_PRICE);
  const totalPrice =
    (includesLeft ? sidePrice(activeLeftText) : 0) +
    (includesRight ? sidePrice(activeRightText) : 0);
  const priceLabel = `$${totalPrice}`;

  const sizeOption = SIZE_OPTIONS.find((s) => s.value === fontSize) ?? SIZE_OPTIONS[2];
  const fontLabel = FONTS.find((f) => f.value === selectedFont)?.label ?? "Bebas Neue";
  const spacingLabel =
    LETTER_SPACING_OPTIONS.find((s) => s.value === letterSpacing)?.label ?? "Normal";
  const caseLabel = TEXT_CASE_OPTIONS.find((c) => c.value === textCase)?.label ?? "UPPERCASE";

  const handleTextChange = (side: "left" | "right", value: string) => {
    const clipped = value.slice(0, MAX_TEXT_LENGTH);
    if (side === "left") {
      setLeftText(clipped);
    } else {
      setRightText(clipped);
    }
  };

  const resetAll = () => {
    setSelectedSide(DEFAULTS.side);
    setLeftText("");
    setRightText("");
    setSelectedFont(DEFAULTS.font);
    setFontSize(DEFAULTS.size);
    setLetterSpacing(DEFAULTS.letterSpacing);
    setTextCase(DEFAULTS.textCase);
    setFormData(EMPTY_FORM);
    setSubmitError("");
    setFormSubmitted(false);
    customizerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    const payload: Record<string, unknown> = {
      product: "Puch Magnum Side Cover",
      customerName: formData.name,
      customerEmail: formData.email,
      // One order of the selected side option; "both" is priced per side by the server.
      quantity: 1,
      sideOption: selectedSide,
      isCustom,
      estimatedPrice: priceLabel,
      hpCheck: formData.hpCheck,
    };
    if (activeLeftText) payload.leftText = activeLeftText;
    if (activeRightText) payload.rightText = activeRightText;
    if (isCustom) {
      payload.font = fontLabel;
      payload.textSize = sizeOption.label;
      payload.letterSpacing = spacingLabel;
      payload.textCase = caseLabel;
    }
    if (formData.message.trim()) payload.notes = formData.message.trim();

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to submit. Please try again."));
      }

      setFormSubmitted(true);
    } catch (error) {
      console.error("Error submitting order:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const sideSummary =
    selectedSide === "both"
      ? "Both Sides"
      : `${selectedSide.charAt(0).toUpperCase() + selectedSide.slice(1)} Side Only`;

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Back Link */}
      <Link
        href="/shop"
        className="mb-8 inline-flex items-center gap-2 rounded-none border-2 border-black bg-white px-3 py-1 font-bold text-black transition-colors hover:bg-[#FFD700]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Shop
      </Link>

      {/* Hero Section */}
      <div className="mb-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-3" aria-hidden="true">
          <Star className="h-8 w-8 text-black" />
          <Star className="h-6 w-6 text-orange-700" />
          <Star className="h-8 w-8 text-black" />
        </div>
        <h1 className="mb-2 text-4xl font-black uppercase tracking-tighter text-black md:text-5xl">
          Custom Side Covers
          <span className="mt-2 block">
            <span className="inline-block bg-black px-3 py-1 text-2xl tracking-tight text-[#FFD700] md:text-3xl">
              Puch Magnum
            </span>
          </span>
        </h1>
        <p className="mx-auto mb-2 mt-4 max-w-md text-sm font-bold uppercase tracking-wide text-black">
          3D Printed • Plain or Custom Text
        </p>
        <div className="mb-2 mt-4">
          <RetroBadge color="black">Coming Soon</RetroBadge>
        </div>
        {/* Pricing Box */}
        <div className="mx-auto mt-4 max-w-xs rounded-none border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="mb-2 flex justify-between border-b-2 border-dashed border-gray-400 pb-2">
            <span className="font-bold text-black">Plain (no text)</span>
            <span className="font-black text-black">${PLAIN_SIDE_PRICE}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-black">Custom Text</span>
            <span className="font-black text-black">${CUSTOM_SIDE_PRICE}</span>
          </div>
          <p className="mt-2 text-center text-xs text-gray-700">per cover • + shipping</p>
          <p className="text-center text-xs font-bold text-orange-800">
            Free shipping on orders over $99
          </p>
        </div>
      </div>

      <RetroStripe />

      {/* Side Selection */}
      <div
        ref={customizerTopRef}
        className="mx-auto mb-8 max-w-md scroll-mt-24 rounded-none border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        <SegmentedControl
          label="Which Side(s)?"
          labelClassName="mb-3 block text-center text-sm font-black uppercase text-black"
          options={SIDE_OPTIONS}
          value={selectedSide}
          onChange={setSelectedSide}
          buttonClassName="px-4 py-3 text-sm uppercase"
        />
      </div>

      {/* Preview and Customization Section */}
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Preview Panel */}
          <Card className="overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-4 border-black bg-gradient-to-r from-amber-50 via-white to-amber-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Type className="h-5 w-5 text-black" aria-hidden="true" />
                <h2 className="text-lg font-black uppercase text-black">Preview</h2>
              </div>
            </div>
            <CardContent className="p-4">
              {selectedSide === "both" ? (
                <div className="grid grid-cols-2 gap-4">
                  <SideCoverPreview
                    side="left"
                    text={leftText}
                    font={selectedFont}
                    sizeCqw={sizeOption.cqw}
                    letterSpacing={letterSpacing}
                    textCase={textCase}
                  />
                  <SideCoverPreview
                    side="right"
                    text={rightText}
                    font={selectedFont}
                    sizeCqw={sizeOption.cqw}
                    letterSpacing={letterSpacing}
                    textCase={textCase}
                  />
                </div>
              ) : (
                <SideCoverPreview
                  side={selectedSide}
                  text={selectedSide === "left" ? leftText : rightText}
                  font={selectedFont}
                  sizeCqw={sizeOption.cqw}
                  letterSpacing={letterSpacing}
                  textCase={textCase}
                />
              )}
              {!isCustom && (
                <p className="mt-3 text-center text-sm text-gray-700">
                  Add custom text below, or order plain for ${PLAIN_SIDE_PRICE}/cover •
                  + shipping
                </p>
              )}
            </CardContent>
          </Card>

          {/* Customization Controls */}
          <Card className="overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-4 border-black bg-gradient-to-r from-amber-50 via-white to-amber-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-black" aria-hidden="true" />
                <h2 className="text-lg font-black uppercase text-black">Customize</h2>
              </div>
            </div>
            <CardContent className="space-y-6 p-4">
              {/* Text Input(s) */}
              {includesLeft && (
                <div>
                  <label
                    htmlFor={leftTextId}
                    className="mb-2 block text-sm font-black uppercase text-black"
                  >
                    Left Side Text
                  </label>
                  <Input
                    id={leftTextId}
                    type="text"
                    value={leftText}
                    onChange={(e) => handleTextChange("left", e.target.value)}
                    placeholder="e.g., PEDAL CODE"
                    maxLength={MAX_TEXT_LENGTH}
                    aria-describedby={leftCountId}
                    autoComplete="off"
                    className="rounded-none border-2 border-black bg-white text-black placeholder:text-gray-500 focus:ring-black"
                  />
                  <p id={leftCountId} className="mt-1 text-xs text-gray-700">
                    {leftText.length}/{MAX_TEXT_LENGTH} characters
                  </p>
                </div>
              )}

              {includesRight && (
                <div>
                  <label
                    htmlFor={rightTextId}
                    className="mb-2 block text-sm font-black uppercase text-black"
                  >
                    Right Side Text
                  </label>
                  <Input
                    id={rightTextId}
                    type="text"
                    value={rightText}
                    onChange={(e) => handleTextChange("right", e.target.value)}
                    placeholder="e.g., ARMY"
                    maxLength={MAX_TEXT_LENGTH}
                    aria-describedby={rightCountId}
                    autoComplete="off"
                    className="rounded-none border-2 border-black bg-white text-black placeholder:text-gray-500 focus:ring-black"
                  />
                  <p id={rightCountId} className="mt-1 text-xs text-gray-700">
                    {rightText.length}/{MAX_TEXT_LENGTH} characters
                  </p>
                </div>
              )}

              {/* Font Selection */}
              <div>
                <label
                  htmlFor={fontId}
                  className="mb-2 block text-sm font-black uppercase text-black"
                >
                  Font Style
                </label>
                <select
                  id={fontId}
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="w-full rounded-none border-2 border-black bg-white px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-black"
                  style={{ fontFamily: selectedFont }}
                >
                  {FONT_CATEGORIES.map((category) => (
                    <optgroup key={category.label} label={category.label}>
                      {category.fonts.map((font) => (
                        <option
                          key={font.value}
                          value={font.value}
                          style={{ fontFamily: font.value }}
                        >
                          {font.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {/* Font Preview */}
                <div
                  className="mt-2 rounded-none border border-gray-400 bg-gray-50 px-3 py-2 text-center text-lg text-black"
                  style={{ fontFamily: selectedFont }}
                  aria-hidden="true"
                >
                  {fontLabel}
                </div>
              </div>

              <SegmentedControl
                label="Text Size"
                options={SIZE_OPTIONS}
                value={fontSize}
                onChange={setFontSize}
              />

              <SegmentedControl
                label="Letter Spacing"
                options={LETTER_SPACING_OPTIONS}
                value={letterSpacing}
                onChange={setLetterSpacing}
                buttonClassName="px-2 py-2 text-xs uppercase"
              />

              <SegmentedControl
                label="Text Case"
                options={TEXT_CASE_OPTIONS}
                value={textCase}
                onChange={setTextCase}
                buttonClassName="px-3 py-2 text-xs"
              />

              {/* Product Info */}
              <div className="rounded-none border-2 border-dashed border-gray-500 bg-amber-50 p-3">
                <p className="mb-2 text-xs font-black uppercase text-black">What You Get:</p>
                <ul className="space-y-1 text-xs text-gray-800">
                  <li className="flex items-start gap-1">
                    <span className="font-bold text-orange-800" aria-hidden="true">+</span>
                    {selectedSide === "both"
                      ? "2x 3D printed Puch Magnum side covers (left & right)"
                      : `1x 3D printed Puch Magnum ${selectedSide} side cover`}
                  </li>
                  {isCustom && (
                    <li className="flex items-start gap-1">
                      <span className="font-bold text-orange-800" aria-hidden="true">+</span>
                      Custom embossed text of your choice
                    </li>
                  )}
                  <li className="flex items-start gap-1">
                    <span className="font-bold text-orange-800" aria-hidden="true">+</span>
                    Durable PETG material
                  </li>
                  <li className="flex items-start gap-1">
                    <span className="font-bold text-orange-800" aria-hidden="true">+</span>
                    Direct fit for Puch Magnum models
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <RetroStripe />

      {/* Contact Form */}
      <div className="mx-auto max-w-2xl">
        <Card className="overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="border-b-4 border-black bg-gradient-to-r from-[#FFD700] via-amber-400 to-[#FFD700] px-4 py-3">
            <h2 className="text-center text-xl font-black uppercase text-black">
              Get Notified When Available
            </h2>
          </div>
          <CardContent className="p-6">
            {formSubmitted ? (
              <div className="text-center" role="status">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-6 w-6 text-green-700" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-xl font-black uppercase text-black">
                  You&apos;re on the list!
                </h3>
                <p className="text-gray-700">
                  We&apos;ve saved your {isCustom ? "custom design" : "order details"} and
                  we&apos;ll email you when side covers are ready to order.
                </p>
                <Button
                  type="button"
                  onClick={resetAll}
                  className="mt-4 rounded-none border-2 border-black bg-black text-[#FFD700] hover:bg-gray-900"
                >
                  Customize Another
                </Button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor={nameId}
                      className="mb-2 block text-sm font-black uppercase text-black"
                    >
                      Name
                    </label>
                    <Input
                      id={nameId}
                      name="name"
                      type="text"
                      autoComplete="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="rounded-none border-2 border-black bg-white text-black"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={emailId}
                      className="mb-2 block text-sm font-black uppercase text-black"
                    >
                      Email
                    </label>
                    <Input
                      id={emailId}
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      aria-describedby={submitError ? errorId : undefined}
                      className="rounded-none border-2 border-black bg-white text-black"
                    />
                  </div>
                </div>

                {/* Honeypot: hidden from people, tempting to bots. The neutral
                    name + autoComplete="new-password" keep browser contact
                    autofill from filling it and flagging real customers. */}
                <div
                  className="absolute -left-[9999px] h-px w-px overflow-hidden"
                  aria-hidden="true"
                >
                  <label htmlFor={hpCheckId}>Leave this field empty</label>
                  <input
                    id={hpCheckId}
                    name="hpCheck"
                    type="text"
                    tabIndex={-1}
                    autoComplete="new-password"
                    value={formData.hpCheck}
                    onChange={(e) => setFormData({ ...formData, hpCheck: e.target.value })}
                  />
                </div>

                {/* Order Summary */}
                <div className="rounded-none border-2 border-black bg-gray-50 p-3" aria-live="polite">
                  <p className="mb-1 text-xs font-black uppercase text-gray-700">Your Order:</p>
                  <p className="text-sm font-bold text-black">
                    {sideSummary}
                    {" • "}
                    {isCustom ? "Custom" : "Plain"}
                  </p>
                  {isCustom && (
                    <>
                      {activeLeftText && (
                        <p className="text-xs text-gray-700">
                          Left: &quot;{applyTextCase(activeLeftText, textCase)}&quot;
                        </p>
                      )}
                      {activeRightText && (
                        <p className="text-xs text-gray-700">
                          Right: &quot;{applyTextCase(activeRightText, textCase)}&quot;
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-700">
                        Font: {fontLabel} | Size: {sizeOption.label} | Spacing:{" "}
                        {spacingLabel} | Case: {caseLabel}
                      </p>
                    </>
                  )}
                  {selectedSide === "both" && (
                    <p className="mt-1 text-xs text-gray-700">
                      Left ${includesLeft ? sidePrice(activeLeftText) : 0} + Right $
                      {includesRight ? sidePrice(activeRightText) : 0}
                    </p>
                  )}
                  <p className="mt-2 text-lg font-black text-black">Total: {priceLabel}</p>
                </div>

                <div>
                  <label
                    htmlFor={notesId}
                    className="mb-2 block text-sm font-black uppercase text-black"
                  >
                    Additional Notes (Optional)
                  </label>
                  <Textarea
                    id={notesId}
                    name="notes"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Any special requests, color preferences, questions, etc."
                    rows={3}
                    maxLength={1000}
                    className="rounded-none border-2 border-black bg-white text-black placeholder:text-gray-500"
                  />
                </div>

                {submitError && (
                  <div
                    id={errorId}
                    role="alert"
                    className="rounded-none border-2 border-red-700 bg-red-50 p-3 text-center"
                  >
                    <p className="text-sm font-bold text-red-800">{submitError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-none border-2 border-black bg-[#FFD700] py-6 text-lg font-black uppercase text-black transition-all hover:bg-yellow-400 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    "Submitting..."
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" aria-hidden="true" />
                      Join Waitlist
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-gray-700">
                  We&apos;ll notify you when side covers are ready to order
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Info */}
      <div className="mx-auto mt-8 max-w-2xl text-center">
        <div className="rounded-none border-4 border-black bg-black px-6 py-4 shadow-[6px_6px_0px_0px_rgba(255,165,0,1)]">
          <h2 className="mb-2 text-lg font-black uppercase text-[#FFD700]">
            About 3D Printing
          </h2>
          <p className="text-sm text-white">
            Each cover is printed on demand using high-quality PETG filament.
            Please allow 3-5 business days for production. The embossed text is
            printed as part of the cover for a clean, integrated look.
          </p>
        </div>
      </div>
    </div>
  );
}
