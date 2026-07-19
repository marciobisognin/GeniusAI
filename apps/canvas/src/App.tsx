import { useState } from "react";
import { CanvasBoard } from "./CanvasBoard.js";
import { ConstructorScreen } from "./constructor/ConstructorScreen.js";

export function App() {
  const [view, setView] = useState<"canvas" | "construtor">("canvas");

  if (view === "construtor") {
    return <ConstructorScreen onBackToCanvas={() => setView("canvas")} />;
  }
  return <CanvasBoard onOpenConstructor={() => setView("construtor")} />;
}
