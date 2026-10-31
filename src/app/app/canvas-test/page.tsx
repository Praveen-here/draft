import { notFound } from "next/navigation";
import { CanvasLab } from "@/components/app/CanvasLab";

export default function CanvasTestPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CanvasLab />;
}
