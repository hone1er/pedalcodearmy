"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Printer, Star, ArrowLeft, Send, Type } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const FONTS = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "Impact, sans-serif", label: "Impact" },
];

const SIZE_OPTIONS = [
  { value: 24, label: "Small" },
  { value: 32, label: "Medium" },
  { value: 40, label: "Large" },
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
}: {
  side: "left" | "right";
  text: string;
  font: string;
  fontSize: number;
}) {
  const isLeft = side === "left";

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
              letterSpacing: "0.05em",
            }}
          >
            {text}
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
  const [selectedFont, setSelectedFont] = useState("Arial, sans-serif");
  const [fontSize, setFontSize] = useState(32);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

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
    const basePrice = hasCustomText() ? 50 : 45;
    return selectedSide === "both" ? `$${basePrice * 2}` : `$${basePrice}`;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isCustom = hasCustomText();
    const subject = encodeURIComponent(`Side Cover Waitlist - ${isCustom ? "Custom" : "Plain"}`);

    let orderDetails = "";
    if (isCustom) {
      if (selectedSide === "left" || selectedSide === "both") {
        orderDetails += `Left Side Text: "${leftText || "(no text)"}"\n`;
      }
      if (selectedSide === "right" || selectedSide === "both") {
        orderDetails += `Right Side Text: "${rightText || "(no text)"}"\n`;
      }
      orderDetails += `Font: ${FONTS.find(f => f.value === selectedFont)?.label ?? "Arial"}\n`;
      orderDetails += `Size: ${SIZE_OPTIONS.find(s => s.value === fontSize)?.label ?? "Medium"}\n`;
    } else {
      orderDetails = "Plain (no custom text)\n";
    }

    const body = encodeURIComponent(
      `Name: ${formData.name}\n` +
      `Email: ${formData.email}\n\n` +
      `Order: ${selectedSide === "both" ? "Both Sides" : `${selectedSide.charAt(0).toUpperCase() + selectedSide.slice(1)} Side Only`}\n` +
      `Type: ${isCustom ? "Custom Text" : "Plain"}\n` +
      orderDetails +
      `Price: ${getPrice()}\n\n` +
      `Additional Notes:\n${formData.message}`
    );

    window.location.href = `mailto:pedalcodearmy@gmail.com?subject=${subject}&body=${body}`;
    setFormSubmitted(true);
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
        <div className="mt-4 mb-2">
          <RetroBadge color="orange">Coming Soon</RetroBadge>
        </div>
        {/* Pricing Box */}
        <div className="mx-auto mt-4 max-w-xs rounded-none border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between border-b-2 border-dashed border-gray-300 pb-2 mb-2">
            <span className="font-bold text-black">Plain (no text)</span>
            <span className="font-black text-black">$45</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-black">Custom Text</span>
            <span className="font-black text-black">$50</span>
          </div>
          <p className="mt-2 text-center text-xs text-gray-500">per cover • + shipping</p>
          <p className="text-center text-xs font-bold text-orange-600">Free shipping on orders over $99</p>
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
                  />
                  <SideCoverPreview
                    side="right"
                    text={rightText}
                    font={selectedFont}
                    fontSize={fontSize * 0.7}
                  />
                </div>
              ) : (
                <SideCoverPreview
                  side={selectedSide}
                  text={selectedSide === "left" ? leftText : rightText}
                  font={selectedFont}
                  fontSize={fontSize}
                />
              )}
              {!hasCustomText() && (
                <p className="mt-3 text-center text-sm text-gray-500">
                  Add custom text below, or order plain for $45/cover
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
                >
                  {FONTS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Size Selection */}
              <div>
                <label className="mb-2 block text-sm font-black uppercase text-black">
                  Text Size
                </label>
                <div className="flex gap-2">
                  {SIZE_OPTIONS.map((size) => (
                    <button
                      key={size.value}
                      onClick={() => setFontSize(size.value)}
                      className={`flex-1 rounded-none border-2 border-black px-4 py-2 text-sm font-bold uppercase transition-all ${
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
                    {selectedSide === "both" ? "Both Sides" : `${selectedSide.charAt(0).toUpperCase() + selectedSide.slice(1)} Side Only`}
                    {" • "}
                    {hasCustomText() ? "Custom" : "Plain"}
                  </p>
                  {hasCustomText() && (
                    <>
                      {(selectedSide === "left" || selectedSide === "both") && leftText && (
                        <p className="text-xs text-gray-600">
                          Left: &quot;{leftText}&quot;
                        </p>
                      )}
                      {(selectedSide === "right" || selectedSide === "both") && rightText && (
                        <p className="text-xs text-gray-600">
                          Right: &quot;{rightText}&quot;
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-600">
                        Font: {FONTS.find((f) => f.value === selectedFont)?.label} |
                        Size: {SIZE_OPTIONS.find((s) => s.value === fontSize)?.label}
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

                <Button
                  type="submit"
                  className="w-full rounded-none border-2 border-black bg-[#FFD700] py-6 text-lg font-black uppercase text-black transition-all hover:bg-yellow-400 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Send className="mr-2 h-5 w-5" />
                  Join Waitlist
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
