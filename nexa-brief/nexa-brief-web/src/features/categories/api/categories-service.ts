import { httpClient } from "@/infrastructure/api/http-client";

/** Estrategia editorial de una categoría principal (público, ángulo, ideas…). */
export interface CategoryStrategy {
  audience: string;
  angle: string;
  tone: string;
  titleFormulas: string[];
  titleExamples: string[];
  topicIdeas: string[];
  hashtags: string[];
  rules: string[];
  language: string;
  defaultCadence: "daily" | "alternate";
}

export interface CategoryNode {
  id: string;
  path: string;
  displayName: string;
  topic: string;
  status: "active" | "planned" | "empty";
  engine: "pipeline" | "explainer_kit";
  niches: string[];
  designs: string[];
  strategy: CategoryStrategy | null;
  children: CategoryNode[];
}

interface CategoryDto {
  id: string;
  path: string;
  display_name: string;
  topic: string;
  status: CategoryNode["status"];
  engine: CategoryNode["engine"];
  niches: string[];
  designs: string[];
  strategy?: {
    audience?: string;
    angle?: string;
    tone?: string;
    title_formulas?: string[];
    title_examples?: string[];
    topic_ideas?: string[];
    hashtags?: string[];
    rules?: string[];
    language?: string;
    default_cadence?: CategoryStrategy["defaultCadence"];
  } | null;
  children: CategoryDto[];
}

function mapStrategy(dto: CategoryDto["strategy"]): CategoryStrategy | null {
  if (!dto) return null;
  return {
    audience: dto.audience ?? "",
    angle: dto.angle ?? "",
    tone: dto.tone ?? "",
    titleFormulas: dto.title_formulas ?? [],
    titleExamples: dto.title_examples ?? [],
    topicIdeas: dto.topic_ideas ?? [],
    hashtags: dto.hashtags ?? [],
    rules: dto.rules ?? [],
    language: dto.language ?? "es",
    defaultCadence: dto.default_cadence ?? "daily",
  };
}

function mapCategory(dto: CategoryDto): CategoryNode {
  return {
    id: dto.id,
    path: dto.path,
    displayName: dto.display_name,
    topic: dto.topic,
    status: dto.status,
    engine: dto.engine,
    niches: dto.niches,
    designs: dto.designs,
    strategy: mapStrategy(dto.strategy),
    children: dto.children.map(mapCategory),
  };
}

export async function getCategories(signal?: AbortSignal): Promise<CategoryNode[]> {
  const dtos = await httpClient<CategoryDto[]>("/api/v1/categories", { signal });
  return dtos.map(mapCategory);
}

/** Árbol → lista plana para un <select>: "NodeMotion", "NodeMotion › Videos de letras", … */
export function flattenCategories(
  nodes: CategoryNode[],
  parentLabel = "",
): { path: string; label: string; status: CategoryNode["status"] }[] {
  return nodes.flatMap((node) => {
    const label = parentLabel ? `${parentLabel} › ${node.displayName}` : node.displayName;
    return [
      { path: node.path, label, status: node.status },
      ...flattenCategories(node.children, label),
    ];
  });
}
