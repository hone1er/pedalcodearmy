"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Printer, Star, ArrowLeft, Send, Type } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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

// Flat list for backwards compatibility and lookups
const FONTS = FONT_CATEGORIES.flatMap((category) => category.fonts);

const SIZE_OPTIONS = [
  { value: 20, label: "XS" },
  { value: 26, label: "S" },
  { value: 32, label: "M" },
  { value: 40, label: "L" },
  { value: 48, label: "XL" },
];

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

type SideOption = "left" | "right" | "both";

function RetroStripe() {
  return (
    <div className="my-8 flex items-center justify-center gap-1">
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
    orange: "bg-orange-500 text-white border-orange-700",
    gold: "bg-[#FFD700] text-black border-yellow-600",
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

function SideCoverPreview({
  side,
  text,
  font,
  fontSize,
  letterSpacing,
  textCase,
}: {
  side: "left" | "right";
  text: string;
  font: string;
  fontSize: number;
  letterSpacing: string;
  textCase: string;
}) {
  const isLeft = side === "left";

  const displayText =
    textCase === "uppercase"
      ? text.toUpperCase()
      : textCase === "lowercase"
        ? text.toLowerCase()
        : text;

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-none border-2 border-gray-300 bg-gray-100">
      <Image
        src="/images/products/SideCoverRight.png"
        alt={`Puch Magnum ${side} Side Cover`}
        fill
        className="object-contain"
        style={isLeft ? { transform: "scaleX(-1)" } : undefined}
        priority
      />
      {/* Embossed Text Overlay */}
      {text && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            paddingTop: "15%",
            paddingLeft: isLeft ? "0" : "5%",
            paddingRight: isLeft ? "5%" : "0",
          }}
        >
          <span
            className="select-none"
            style={{
              fontFamily: font,
              fontSize: `${fontSize}px`,
              fontWeight: "bold",
              color: "rgba(40, 40, 40, 0.85)",
              textShadow: `
                1px 1px 1px rgba(255,255,255,0.15),
                -1px -1px 1px rgba(0,0,0,0.35),
                0px 0px 2px rgba(0,0,0,0.2)
              `,
              letterSpacing: letterSpacing,
            }}
          >
            {displayText}
          </span>
        </div>
      )}
      {/* Side Label */}
      <div className="absolute bottom-2 left-2 rounded-none border-2 border-black bg-white px-2 py-1">
        <span className="text-xs font-black uppercase text-black">
          {side} Side
        </span>
      </div>
    </div>
  );
}

export default function SideCoverCustomizer() {
  const [selectedSide, setSelectedSide] = useState<SideOption>("right");
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [selectedFont, setSelectedFont] = useState("'Bebas Neue', sans-serif");
  const [fontSize, setFontSize] = useState(32);
  const [letterSpacing, setLetterSpacing] = useState("0.05em");
  const [textCase, setTextCase] = useState("uppercase");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleTextChange = (side: "left" | "right", value: string) => {
    if (value.length <= 15) {
      if (side === "left") {
        setLeftText(value);
      } else {
        setRightText(value);
      }
    }
  };

  const hasCustomText = () => {
    if (selectedSide === "left") return leftText.length > 0;
    if (selectedSide === "right") return rightText.length > 0;
    return leftText.length > 0 || rightText.length > 0;
  };

  const getPrice = () => {
    const basePrice = hasCustomText() ? 60 : 50;
    return selectedSide === "both" ? `$${basePrice * 2}` : `$${basePrice}`;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    const isCustom = hasCustomText();
    const quantity = selectedSide === "both" ? 2 : 1;

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: "Puch Magnum Side Cover",
          customerName: formData.name,
          customerEmail: formData.email,
          quantity,
          sideOption: selectedSide,
          leftText: leftText || null,
          rightText: rightText || null,
          font: FONTS.find((f) => f.value === selectedFont)?.label ?? "Bebas Neue",
          textSize: SIZE_OPTIONS.find((s) => s.value === fontSize)?.label ?? "M",
          letterSpacing: LETTER_SPACING_OPTIONS.find((s) => s.value === letterSpacing)?.label ?? "Normal",
          textCase: TEXT_CASE_OPTIONS.find((c) => c.value === textCase)?.label ?? "UPPERCASE",
          isCustom,
          estimatedPrice: getPrice(),
          notes: formData.message || null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to submit order");
      }

      setFormSubmitted(true);
    } catch (error) {
      console.error("Error submitting order:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Back Link */}
      <Link
        href="/shop"
        className="mb-8 inline-flex items-center gap-2 font-bold text-black transition-colors hover:text-orange-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Shop
      </Link>

      {/* Hero Section */}
      <div className="mb-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <Star className="h-8 w-8 text-orange-500" />
          <Star className="h-6 w-6 text-[#FFD700]" />
          <Star className="h-8 w-8 text-orange-500" />
        </div>
        <h1 className="mb-2 text-4xl font-black uppercase tracking-tighter text-black md:text-5xl">
          Custom Side Covers
        </h1>
        <h2 className="mb-4 text-2xl font-black uppercase tracking-tight text-orange-600 md:text-3xl">
          Puch Magnum
        </h2>
        <p className="mx-auto mb-2 max-w-md text-sm font-bold uppercase tracking-wide text-gray-600">
          3D Printed • Plain or Custom Text
        </p>
        <div className="mb-2 mt-4">
          <RetroBadge color="orange">Coming Soon</RetroBadge>
        </div>
        {/* Pricing Box */}
        <div className="mx-auto mt-4 max-w-xs rounded-none border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="mb-2 flex justify-between border-b-2 border-dashed border-gray-300 pb-2">
            <span className="font-bold text-black">Plain (no text)</span>
            <span className="font-black text-black">$50</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-black">Custom Text</span>
            <span className="font-black text-black">$60</span>
          </div>
          <p className="mt-2 text-center text-xs text-gray-500">
            per cover • + shipping
          </p>
          <p className="text-center text-xs font-bold text-orange-600">
            Free shipping on orders over $99
          </p>
        </div>
      </div>

      <RetroStripe />

      {/* Side Selection */}
      <div className="mx-auto mb-8 max-w-md">
        <label className="mb-3 block text-center text-sm font-black uppercase text-black">
          Which Side(s)?
        </label>
        <div className="flex gap-2">
          {(["left", "right", "both"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setSelectedSide(option)}
              className={`flex-1 rounded-none border-2 border-black px-4 py-3 text-sm font-bold uppercase transition-all ${
                selectedSide === option
                  ? "bg-black text-[#FFD700]"
                  : "bg-white text-black hover:bg-gray-100"
              }`}
            >
              {option === "both" ? "Both Sides" : `${option} Only`}
            </button>
          ))}
        </div>
      </div>

      {/* Preview and Customization Section */}
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Preview Panel */}
          <Card className="overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-4 border-black bg-gradient-to-r from-amber-50 via-white to-amber-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Type className="h-5 w-5 text-black" />
                <h3 className="text-lg font-black uppercase text-black">
                  Preview
                </h3>
              </div>
            </div>
            <CardContent className="p-4">
              {selectedSide === "both" ? (
                <div className="grid grid-cols-2 gap-4">
                  <SideCoverPreview
                    side="left"
                    text={leftText}
                    font={selectedFont}
                    fontSize={fontSize * 0.7}
                    letterSpacing={letterSpacing}
                    textCase={textCase}
                  />
                  <SideCoverPreview
                    side="right"
                    text={rightText}
                    font={selectedFont}
                    fontSize={fontSize * 0.7}
                    letterSpacing={letterSpacing}
                    textCase={textCase}
                  />
                </div>
              ) : (
                <SideCoverPreview
                  side={selectedSide}
                  text={selectedSide === "left" ? leftText : rightText}
                  font={selectedFont}
                  fontSize={fontSize}
                  letterSpacing={letterSpacing}
                  textCase={textCase}
                />
              )}
              {!hasCustomText() && (
                <p className="mt-3 text-center text-sm text-gray-500">
                  Add custom text below, or order plain for $50/cover • +
                  shipping
                </p>
              )}
            </CardContent>
          </Card>

          {/* Customization Controls */}
          <Card className="overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-4 border-black bg-gradient-to-r from-amber-50 via-white to-amber-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-black" />
                <h3 className="text-lg font-black uppercase text-black">
                  Customize
                </h3>
              </div>
            </div>
            <CardContent className="space-y-6 p-4">
              {/* Text Input(s) */}
              {(selectedSide === "left" || selectedSide === "both") && (
                <div>
                  <label className="mb-2 block text-sm font-black uppercase text-black">
                    Left Side Text
                  </label>
                  <Input
                    type="text"
                    value={leftText}
                    onChange={(e) => handleTextChange("left", e.target.value)}
                    placeholder="e.g., PEDAL CODE"
                    maxLength={15}
                    className="rounded-none border-2 border-black bg-white text-black placeholder:text-gray-400 focus:ring-orange-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {leftText.length}/15 characters
                  </p>
                </div>
              )}

              {(selectedSide === "right" || selectedSide === "both") && (
                <div>
                  <label className="mb-2 block text-sm font-black uppercase text-black">
                    Right Side Text
                  </label>
                  <Input
                    type="text"
                    value={rightText}
                    onChange={(e) => handleTextChange("right", e.target.value)}
                    placeholder="e.g., ARMY"
                    maxLength={15}
                    className="rounded-none border-2 border-black bg-white text-black placeholder:text-gray-400 focus:ring-orange-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {rightText.length}/15 characters
                  </p>
                </div>
              )}

              {/* Font Selection */}
              <div>
                <label className="mb-2 block text-sm font-black uppercase text-black">
                  Font Style
                </label>
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="w-full rounded-none border-2 border-black bg-white px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                  className="mt-2 rounded-none border border-gray-300 bg-gray-50 px-3 py-2 text-center text-lg"
                  style={{ fontFamily: selectedFont }}
                >
                  {FONTS.find((f) => f.value === selectedFont)?.label ?? "Preview"}
                </div>
              </div>

              {/* Size Selection */}
              <div>
                <label className="mb-2 block text-sm font-black uppercase text-black">
                  Text Size
                </label>
                <div className="flex gap-1">
                  {SIZE_OPTIONS.map((size) => (
                    <button
                      key={size.value}
                      onClick={() => setFontSize(size.value)}
                      className={`flex-1 rounded-none border-2 border-black px-2 py-2 text-sm font-bold uppercase transition-all ${
                        fontSize === size.value
                          ? "bg-black text-[#FFD700]"
                          : "bg-white text-black hover:bg-gray-100"
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Letter Spacing */}
              <div>
                <label className="mb-2 block text-sm font-black uppercase text-black">
                  Letter Spacing
                </label>
                <div className="flex gap-1">
                  {LETTER_SPACING_OPTIONS.map((spacing) => (
                    <button
                      key={spacing.value}
                      onClick={() => setLetterSpacing(spacing.value)}
                      className={`flex-1 rounded-none border-2 border-black px-2 py-2 text-xs font-bold uppercase transition-all ${
                        letterSpacing === spacing.value
                          ? "bg-black text-[#FFD700]"
                          : "bg-white text-black hover:bg-gray-100"
                      }`}
                    >
                      {spacing.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Case */}
              <div>
                <label className="mb-2 block text-sm font-black uppercase text-black">
                  Text Case
                </label>
                <div className="flex gap-2">
                  {TEXT_CASE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTextCase(option.value)}
                      className={`flex-1 rounded-none border-2 border-black px-3 py-2 text-xs font-bold transition-all ${
                        textCase === option.value
                          ? "bg-black text-[#FFD700]"
                          : "bg-white text-black hover:bg-gray-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Info */}
              <div className="rounded-none border-2 border-dashed border-gray-400 bg-amber-50 p-3">
                <p className="mb-2 text-xs font-black uppercase text-black">
                  What You Get:
                </p>
                <ul className="space-y-1 text-xs text-gray-700">
                  <li className="flex items-start gap-1">
                    <span className="font-bold text-orange-500">+</span>
                    {selectedSide === "both"
                      ? "2x 3D printed Puch Magnum side covers (left & right)"
                      : `1x 3D printed Puch Magnum ${selectedSide} side cover`}
                  </li>
                  <li className="flex items-start gap-1">
                    <span className="font-bold text-orange-500">+</span>
                    Custom embossed text of your choice
                  </li>
                  <li className="flex items-start gap-1">
                    <span className="font-bold text-orange-500">+</span>
                    Durable PETG material
                  </li>
                  <li className="flex items-start gap-1">
                    <span className="font-bold text-orange-500">+</span>
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
            <h3 className="text-center text-xl font-black uppercase text-black">
              Get Notified When Available
            </h3>
          </div>
          <CardContent className="p-6">
            {formSubmitted ? (
              <div className="text-center">
                <div className="mb-4 text-4xl">&#10003;</div>
                <h4 className="mb-2 text-xl font-black uppercase text-black">
                  You&apos;re on the list!
                </h4>
                <p className="text-gray-600">
                  Your email client should have opened with your details.
                  We&apos;ll notify you when side covers are ready!
                </p>
                <Button
                  onClick={() => setFormSubmitted(false)}
                  className="mt-4 rounded-none border-2 border-black bg-black text-[#FFD700] hover:bg-gray-900"
                >
                  Customize Another
                </Button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-black uppercase text-black">
                      Name
                    </label>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                      className="rounded-none border-2 border-black bg-white text-black"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-black uppercase text-black">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                      className="rounded-none border-2 border-black bg-white text-black"
                    />
                  </div>
                </div>

                {/* Order Summary */}
                <div className="rounded-none border-2 border-black bg-gray-50 p-3">
                  <p className="mb-1 text-xs font-black uppercase text-gray-600">
                    Your Order:
                  </p>
                  <p className="text-sm font-bold text-black">
                    {selectedSide === "both"
                      ? "Both Sides"
                      : `${selectedSide.charAt(0).toUpperCase() + selectedSide.slice(1)} Side Only`}
                    {" • "}
                    {hasCustomText() ? "Custom" : "Plain"}
                  </p>
                  {hasCustomText() && (
                    <>
                      {(selectedSide === "left" || selectedSide === "both") &&
                        leftText && (
                          <p className="text-xs text-gray-600">
                            Left: &quot;{leftText}&quot;
                          </p>
                        )}
                      {(selectedSide === "right" || selectedSide === "both") &&
                        rightText && (
                          <p className="text-xs text-gray-600">
                            Right: &quot;{rightText}&quot;
                          </p>
                        )}
                      <p className="mt-1 text-xs text-gray-600">
                        Font:{" "}
                        {FONTS.find((f) => f.value === selectedFont)?.label} |
                        Size:{" "}
                        {SIZE_OPTIONS.find((s) => s.value === fontSize)?.label} |
                        Spacing:{" "}
                        {LETTER_SPACING_OPTIONS.find((s) => s.value === letterSpacing)?.label} |
                        Case:{" "}
                        {TEXT_CASE_OPTIONS.find((c) => c.value === textCase)?.label}
                      </p>
                    </>
                  )}
                  <p className="mt-2 text-lg font-black text-black">
                    Total: {getPrice()}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black uppercase text-black">
                    Additional Notes (Optional)
                  </label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    placeholder="Any special requests, color preferences, questions, etc."
                    rows={3}
                    className="rounded-none border-2 border-black bg-white text-black placeholder:text-gray-400"
                  />
                </div>

                {submitError && (
                  <div className="rounded-none border-2 border-red-500 bg-red-50 p-3 text-center">
                    <p className="text-sm font-bold text-red-600">{submitError}</p>
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
                      <Send className="mr-2 h-5 w-5" />
                      Join Waitlist
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-gray-500">
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
          <h4 className="mb-2 text-lg font-black uppercase text-[#FFD700]">
            About 3D Printing
          </h4>
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
