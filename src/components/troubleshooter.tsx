"use client";

import { useState } from "react";
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
} from "lucide-react";

function RetroBadge({
  children,
  color = "orange",
}: {
  children: React.ReactNode;
  color?: "orange" | "gold" | "black" | "green" | "red";
}) {
  const colors = {
    orange: "bg-orange-500 text-white border-orange-700",
    gold: "bg-[#FFD700] text-black border-yellow-600",
    black: "bg-black text-[#FFD700] border-gray-700",
    green: "bg-green-500 text-white border-green-700",
    red: "bg-red-500 text-white border-red-700",
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
        <Card
          key={category.id}
          className="group cursor-pointer overflow-hidden rounded-none border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          onClick={() => onSelect(category)}
        >
          <CardContent className="p-6">
            <div className="mb-4 text-5xl">{category.icon}</div>
            <h3 className="mb-2 text-xl font-black uppercase tracking-tight">
              {category.name}
            </h3>
            <p className="text-gray-600">{category.description}</p>
            <div className="mt-4 flex items-center gap-2 font-bold text-orange-500 group-hover:text-orange-600">
              Start Diagnosis <ChevronRight size={18} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function QuestionCard({
  node,
  onAnswer,
  onBack,
  canGoBack,
}: {
  node: TroubleshootingNode;
  onAnswer: (nextId: string) => void;
  onBack: () => void;
  canGoBack: boolean;
}) {
  return (
    <Card className="overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <div className="border-b-4 border-black bg-[#FFD700] p-4">
        <div className="flex items-center gap-2">
          {canGoBack && (
            <button
              onClick={onBack}
              className="rounded-none border-2 border-black bg-white p-1 hover:bg-gray-100"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h3 className="text-lg font-black uppercase tracking-tight">
            Question
          </h3>
        </div>
      </div>
      <CardContent className="p-6">
        <h4 className="mb-2 text-2xl font-black">{node.title}</h4>
        {node.description && (
          <p className="mb-6 text-gray-600">{node.description}</p>
        )}

        <div className="space-y-3">
          {node.options?.map((option, index) => (
            <button
              key={index}
              onClick={() => onAnswer(option.nextId)}
              className="group flex w-full items-center justify-between rounded-none border-2 border-black bg-white p-4 text-left font-semibold transition-all hover:border-[#FFD700] hover:bg-gray-50 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <span>{option.label}</span>
              <ChevronRight
                size={18}
                className="text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-[#FFD700]"
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
}: {
  node: TroubleshootingNode;
  onStartOver: () => void;
  onBack: () => void;
}) {
  const diagnosis = node.diagnosis!;

  const difficultyColors = {
    easy: "green",
    moderate: "gold",
    advanced: "red",
  } as const;

  return (
    <Card className="overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <div className="border-b-4 border-black bg-green-500 p-4">
        <div className="flex items-center gap-2 text-white">
          <CheckCircle size={24} />
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

        <h4 className="mb-4 text-2xl font-black">{node.title}</h4>

        <div className="space-y-6">
          {/* Problem */}
          <div className="rounded-none border-2 border-black bg-red-50 p-4">
            <div className="mb-2 flex items-center gap-2 font-black uppercase text-red-600">
              <AlertTriangle size={18} />
              Problem
            </div>
            <p className="font-semibold">{diagnosis.problem}</p>
          </div>

          {/* Solution */}
          <div className="rounded-none border-2 border-black bg-green-50 p-4">
            <div className="mb-2 flex items-center gap-2 font-black uppercase text-green-600">
              <Wrench size={18} />
              Solution
            </div>
            <p className="whitespace-pre-line">{diagnosis.solution}</p>
          </div>

          {/* Parts Needed */}
          {diagnosis.parts && diagnosis.parts.length > 0 && (
            <div className="rounded-none border-2 border-black bg-[#FFD700] p-4">
              <div className="mb-2 flex items-center gap-2 font-black uppercase">
                <ShoppingCart size={18} />
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
            <div className="rounded-none border-2 border-black bg-blue-50 p-4">
              <div className="mb-2 flex items-center gap-2 font-black uppercase text-blue-600">
                <Lightbulb size={18} />
                Pro Tips
              </div>
              <ul className="space-y-2">
                {diagnosis.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1 text-blue-500">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <Button
            onClick={onBack}
            variant="outline"
            className="rounded-none border-2 border-black font-bold hover:bg-gray-100"
          >
            <ArrowLeft size={18} className="mr-2" />
            Go Back
          </Button>
          <Button
            onClick={onStartOver}
            className="rounded-none border-2 border-black bg-[#FFD700] font-bold text-black hover:bg-yellow-400"
          >
            <RotateCcw size={18} className="mr-2" />
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
}: {
  history: string[];
  categoryName: string;
}) {
  return (
    <div className="mb-6 rounded-none border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="rounded-none border-2 border-black bg-[#FFD700] px-2 py-1">
          {categoryName}
        </span>
        <span className="text-gray-400">→</span>
        <span>
          {history.length} step{history.length !== 1 ? "s" : ""} taken
        </span>
      </div>
    </div>
  );
}

export default function Troubleshooter() {
  const [selectedCategory, setSelectedCategory] =
    useState<TroubleshootingCategory | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const currentNode =
    selectedCategory && currentNodeId
      ? findNodeById(selectedCategory, currentNodeId)
      : null;

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
          <div className="mb-8 text-center">
            <h2 className="mb-4 text-3xl font-black uppercase tracking-tight md:text-4xl">
              What&apos;s the Problem?
            </h2>
            <p className="text-gray-600">
              Pick a category and we&apos;ll help you figure out what&apos;s
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
          />

          {currentNode?.type === "question" ? (
            <QuestionCard
              node={currentNode}
              onAnswer={handleAnswer}
              onBack={handleBack}
              canGoBack={true}
            />
          ) : currentNode?.type === "diagnosis" ? (
            <DiagnosisCard
              node={currentNode}
              onStartOver={handleStartOver}
              onBack={handleBack}
            />
          ) : null}
        </>
      )}

      {/* Disclaimer */}
      <div className="mt-8 rounded-none border-2 border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
        <p>
          <strong>Disclaimer:</strong> This tool provides general guidance based
          on common moped issues. Always exercise caution when working on
          vehicles. If unsure, consult a professional mechanic.
        </p>
      </div>
    </div>
  );
}
