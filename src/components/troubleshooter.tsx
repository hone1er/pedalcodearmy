"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  troubleshootingCategories,
  findNodeById,
  type TroubleshootingCategory,
  type TroubleshootingNode,
} from "@/data/troubleshooting";
import {
  ArrowLeft,
  RotateCcw,
  Wrench,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Lightbulb,
  ShoppingCart,
  Calculator,
  ShoppingBag,
} from "lucide-react";

function RetroBadge({
  children,
  color = "orange",
}: {
  children: React.ReactNode;
  color?: "orange" | "gold" | "black" | "green" | "red";
}) {
  const colors = {
    orange: "bg-orange-500 text-black border-orange-700",
    gold: "bg-[#FFD700] text-black border-yellow-600",
    black: "bg-black text-[#FFD700] border-gray-700",
    green: "bg-green-700 text-white border-green-900",
    red: "bg-red-600 text-white border-red-800",
  };
  return (
    <span
      className={`inline-block rounded-none border-2 border-b-4 px-2 py-0.5 text-xs font-black uppercase tracking-wider ${colors[color]}`}
    >
      {children}
    </span>
  );
}

function CategorySelector({
  onSelect,
}: {
  onSelect: (category: TroubleshootingCategory) => void;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {troubleshootingCategories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category)}
          className="group block w-full text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black"
        >
          <Card className="h-full overflow-hidden rounded-none border-4 border-black bg-white text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <CardContent className="p-6">
              <div className="mb-4 text-5xl" aria-hidden="true">
                {category.icon}
              </div>
              <h3 className="mb-2 text-xl font-black uppercase tracking-tight text-gray-900">
                {category.name}
              </h3>
              <p className="text-gray-700">{category.description}</p>
              <div className="mt-4 flex items-center gap-2 font-black uppercase text-orange-700 group-hover:text-orange-800">
                Start Diagnosis{" "}
                <ChevronRight size={18} aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}

function QuestionCard({
  node,
  onAnswer,
  onBack,
  canGoBack,
  headingRef,
}: {
  node: TroubleshootingNode;
  onAnswer: (nextId: string) => void;
  onBack: () => void;
  canGoBack: boolean;
  headingRef: RefObject<HTMLDivElement>;
}) {
  return (
    <Card className="overflow-hidden rounded-none border-4 border-black bg-white text-gray-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <div
        ref={headingRef}
        tabIndex={-1}
        className="border-b-4 border-black bg-[#FFD700] p-4 text-black focus:outline-none"
      >
        <div className="flex items-center gap-3">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back to previous step"
              className="rounded-none border-2 border-black bg-white p-1.5 text-black transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          )}
          <h3 className="text-lg font-black uppercase tracking-tight">
            Question
          </h3>
        </div>
      </div>
      <CardContent className="p-6">
        <h4 className="mb-2 text-2xl font-black text-gray-900">{node.title}</h4>
        {node.description && (
          <p className="mb-6 text-gray-700">{node.description}</p>
        )}

        <div className="space-y-3">
          {node.options?.map((option, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onAnswer(option.nextId)}
              className="group flex w-full items-center justify-between rounded-none border-2 border-black bg-white p-4 text-left font-bold text-gray-900 transition-all hover:bg-[#FFD700] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD700]"
            >
              <span>{option.label}</span>
              <ChevronRight
                size={18}
                aria-hidden="true"
                className="shrink-0 text-gray-600 transition-transform group-hover:translate-x-1 group-hover:text-black"
              />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DiagnosisCard({
  node,
  onStartOver,
  onBack,
  headingRef,
}: {
  node: TroubleshootingNode;
  onStartOver: () => void;
  onBack: () => void;
  headingRef: RefObject<HTMLDivElement>;
}) {
  const diagnosis = node.diagnosis!;

  const difficultyColors = {
    easy: "green",
    moderate: "gold",
    advanced: "red",
  } as const;

  return (
    <Card className="overflow-hidden rounded-none border-4 border-black bg-white text-gray-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <div
        ref={headingRef}
        tabIndex={-1}
        className="border-b-4 border-black bg-green-700 p-4 text-white focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <CheckCircle size={24} aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight">
            Diagnosis Found
          </h3>
        </div>
      </div>

      <CardContent className="p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <RetroBadge color={difficultyColors[diagnosis.difficulty]}>
            {diagnosis.difficulty}
          </RetroBadge>
        </div>

        <h4 className="mb-4 text-2xl font-black text-gray-900">{node.title}</h4>

        <div className="space-y-6">
          {/* Problem */}
          <div className="rounded-none border-2 border-black bg-red-50 p-4 text-gray-900">
            <div className="mb-2 flex items-center gap-2 font-black uppercase text-red-700">
              <AlertTriangle size={18} aria-hidden="true" />
              Problem
            </div>
            <p className="font-semibold">{diagnosis.problem}</p>
          </div>

          {/* Solution */}
          <div className="rounded-none border-2 border-black bg-green-50 p-4 text-gray-900">
            <div className="mb-2 flex items-center gap-2 font-black uppercase text-green-700">
              <Wrench size={18} aria-hidden="true" />
              Solution
            </div>
            <p className="whitespace-pre-line">{diagnosis.solution}</p>
          </div>

          {/* Parts Needed */}
          {diagnosis.parts && diagnosis.parts.length > 0 && (
            <div className="rounded-none border-2 border-black bg-[#FFD700] p-4 text-black">
              <div className="mb-2 flex items-center gap-2 font-black uppercase">
                <ShoppingCart size={18} aria-hidden="true" />
                Parts You Might Need
              </div>
              <ul className="list-inside list-disc space-y-1">
                {diagnosis.parts.map((part, index) => (
                  <li key={index} className="font-semibold">
                    {part}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tips */}
          {diagnosis.tips && diagnosis.tips.length > 0 && (
            <div className="rounded-none border-2 border-black bg-blue-50 p-4 text-gray-900">
              <div className="mb-2 flex items-center gap-2 font-black uppercase text-blue-700">
                <Lightbulb size={18} aria-hidden="true" />
                Pro Tips
              </div>
              <ul className="space-y-2">
                {diagnosis.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1 font-bold text-blue-700">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={onBack}
            variant="outline"
            aria-label="Go back to previous question"
            className="rounded-none border-2 border-black bg-white font-bold text-black hover:bg-gray-100"
          >
            <ArrowLeft size={18} className="mr-2" aria-hidden="true" />
            Go Back
          </Button>
          <Button
            type="button"
            onClick={onStartOver}
            className="rounded-none border-2 border-black bg-[#FFD700] font-bold text-black hover:bg-yellow-400"
          >
            <RotateCcw size={18} className="mr-2" aria-hidden="true" />
            Start Over
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({
  history,
  categoryName,
  onReset,
}: {
  history: string[];
  categoryName: string;
  onReset: () => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-none border-4 border-black bg-white p-4 text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="rounded-none border-2 border-black bg-[#FFD700] px-2.5 py-1 font-black uppercase text-black">
          {categoryName}
        </span>
        <span className="text-gray-500" aria-hidden="true">
          →
        </span>
        <span>
          {history.length} step{history.length !== 1 ? "s" : ""} taken
        </span>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase text-black transition-colors hover:bg-[#FFD700]"
      >
        <RotateCcw size={14} aria-hidden="true" />
        All Categories
      </button>
    </div>
  );
}

export default function Troubleshooter() {
  const [selectedCategory, setSelectedCategory] =
    useState<TroubleshootingCategory | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const stepHeadingRef = useRef<HTMLDivElement>(null);

  const currentNode =
    selectedCategory && currentNodeId
      ? findNodeById(selectedCategory, currentNodeId)
      : null;

  const stepKey = selectedCategory
    ? `${selectedCategory.id}:${currentNodeId ?? ""}`
    : "categories";
  const prevStepKeyRef = useRef(stepKey);

  useEffect(() => {
    if (prevStepKeyRef.current === stepKey) return;
    prevStepKeyRef.current = stepKey;

    const headingEl = stepHeadingRef.current;
    if (!headingEl) return;
    headingEl.focus({ preventScroll: true });
    headingEl.scrollIntoView({ block: "start" });
  }, [stepKey]);

  const handleSelectCategory = (category: TroubleshootingCategory) => {
    setSelectedCategory(category);
    setCurrentNodeId(category.startNodeId);
    setHistory([]);
  };

  const handleAnswer = (nextId: string) => {
    if (currentNodeId) {
      setHistory((prev) => [...prev, currentNodeId]);
    }
    setCurrentNodeId(nextId);
  };

  const handleBack = () => {
    if (history.length > 0) {
      const previousId = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      if (previousId) {
        setCurrentNodeId(previousId);
      }
    } else if (selectedCategory) {
      setSelectedCategory(null);
      setCurrentNodeId(null);
    }
  };

  const handleStartOver = () => {
    setSelectedCategory(null);
    setCurrentNodeId(null);
    setHistory([]);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {!selectedCategory ? (
        <>
          <div
            ref={stepHeadingRef}
            tabIndex={-1}
            className="mb-8 border-4 border-black bg-white p-6 text-center text-gray-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
          >
            <h2 className="mb-2 text-3xl font-black uppercase tracking-tight md:text-4xl">
              What&apos;s the Problem?
            </h2>
            <p className="text-gray-700">
              Pick a symptom below and we&apos;ll help you figure out what&apos;s
              wrong with your moped.
            </p>
          </div>
          <CategorySelector onSelect={handleSelectCategory} />
        </>
      ) : (
        <>
          <ProgressBar
            history={history}
            categoryName={selectedCategory.name}
            onReset={handleStartOver}
          />

          {currentNode?.type === "question" ? (
            <QuestionCard
              node={currentNode}
              onAnswer={handleAnswer}
              onBack={handleBack}
              canGoBack={true}
              headingRef={stepHeadingRef}
            />
          ) : currentNode?.type === "diagnosis" ? (
            <DiagnosisCard
              node={currentNode}
              onStartOver={handleStartOver}
              onBack={handleBack}
              headingRef={stepHeadingRef}
            />
          ) : null}
        </>
      )}

      {/* Cross-Links to Build Calculator & Shop */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/build-calculator"
          className="group flex items-center justify-between border-4 border-black bg-white p-4 text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-[#FFD700]"
        >
          <div className="flex items-center gap-3">
            <Calculator className="h-6 w-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-black uppercase">Build Calculator</p>
              <p className="text-xs font-semibold text-gray-700">
                Ready for upgrades once it runs?
              </p>
            </div>
          </div>
          <ChevronRight
            className="h-5 w-5 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>

        <Link
          href="/shop"
          className="group flex items-center justify-between border-4 border-black bg-black p-4 text-[#FFD700] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-gray-900"
        >
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-black uppercase">Speed Shop</p>
              <p className="text-xs font-semibold text-white/80">
                Grab 3D printed parts &amp; gear
              </p>
            </div>
          </div>
          <ChevronRight
            className="h-5 w-5 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 rounded-none border-4 border-black bg-white p-4 text-center text-sm text-gray-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <p>
          <strong>Disclaimer:</strong> This tool provides general guidance based
          on common moped issues. Always exercise caution when working on
          vehicles. If unsure, consult a professional mechanic.
        </p>
      </div>
    </div>
  );
}
