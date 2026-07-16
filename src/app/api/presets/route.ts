import { NextRequest, NextResponse } from "next/server";
import {
  getPromptPresetCategories,
  savePromptPresetCategories,
} from "@/shared/lib/data";
import { checkProjectAccess, denied } from "@/shared/lib/projectContext";
import {
  PromptPresetCategory,
  PromptPresetScope,
} from "@/shared/types";

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function collections(projectId: string | null) {
  return {
    global: getPromptPresetCategories("global"),
    project: projectId
      ? getPromptPresetCategories("project", projectId)
      : [],
  };
}

function combined(projectId: string | null) {
  const data = collections(projectId);
  return [...data.global, ...data.project];
}

function findCategory(
  data: ReturnType<typeof collections>,
  categoryId: string,
) {
  const globalIndex = data.global.findIndex((item) => item.id === categoryId);
  if (globalIndex >= 0) {
    return {
      scope: "global" as const,
      list: data.global,
      category: data.global[globalIndex],
    };
  }

  const projectIndex = data.project.findIndex((item) => item.id === categoryId);
  if (projectIndex >= 0) {
    return {
      scope: "project" as const,
      list: data.project,
      category: data.project[projectIndex],
    };
  }

  return null;
}

function saveCollection(
  scope: PromptPresetScope,
  list: PromptPresetCategory[],
  projectId: string | null,
) {
  savePromptPresetCategories(scope, list, projectId);
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const access = checkProjectAccess(req);
  if (!access.ok) return denied(access);
  return NextResponse.json(combined(access.projectId));
}

export async function POST(req: NextRequest) {
  const access = checkProjectAccess(req);
  if (!access.ok) return denied(access);

  const body = await req.json();
  const data = collections(access.projectId);

  if (body.type === "category") {
    const name = String(body.name || "").trim();
    const scope: PromptPresetScope = body.scope === "project" ? "project" : "global";
    if (!name) return error("Введите название категории.");
    if (scope === "project" && !access.projectId) {
      return error("Проектную категорию можно создать только внутри проекта.");
    }

    const category: PromptPresetCategory = {
      id: createId(),
      name,
      scope,
      projectId: scope === "project" ? access.projectId : null,
      variants: [],
    };
    const list = scope === "global" ? data.global : data.project;
    list.push(category);
    saveCollection(scope, list, access.projectId);
    return NextResponse.json([...data.global, ...data.project]);
  }

  if (body.type === "variant") {
    const found = findCategory(data, String(body.categoryId || ""));
    if (!found) return error("Категория не найдена.", 404);

    const name = String(body.name || "").trim();
    const prompt = String(body.prompt || "").trim();
    if (!name || !prompt) return error("Заполните название и prompt варианта.");

    found.category.variants.push({ id: createId(), name, prompt });
    saveCollection(found.scope, found.list, access.projectId);
    return NextResponse.json([...data.global, ...data.project]);
  }

  return error("Неизвестный тип пресета.");
}

export async function PUT(req: NextRequest) {
  const access = checkProjectAccess(req);
  if (!access.ok) return denied(access);

  const body = await req.json();
  const data = collections(access.projectId);
  const found = findCategory(data, String(body.categoryId || ""));
  if (!found) return error("Категория не найдена.", 404);

  if (body.type === "category") {
    const name = String(body.name || "").trim();
    if (!name) return error("Введите название категории.");
    found.category.name = name;
  } else if (body.type === "variant") {
    const variant = found.category.variants.find(
      (item) => item.id === String(body.variantId || ""),
    );
    if (!variant) return error("Вариант не найден.", 404);

    const name = String(body.name || "").trim();
    const prompt = String(body.prompt || "").trim();
    if (!name || !prompt) return error("Заполните название и prompt варианта.");
    variant.name = name;
    variant.prompt = prompt;
  } else {
    return error("Неизвестный тип пресета.");
  }

  saveCollection(found.scope, found.list, access.projectId);
  return NextResponse.json([...data.global, ...data.project]);
}

export async function DELETE(req: NextRequest) {
  const access = checkProjectAccess(req);
  if (!access.ok) return denied(access);

  const categoryId = req.nextUrl.searchParams.get("categoryId") || "";
  const variantId = req.nextUrl.searchParams.get("variantId");
  const data = collections(access.projectId);
  const found = findCategory(data, categoryId);
  if (!found) return error("Категория не найдена.", 404);

  if (variantId) {
    found.category.variants = found.category.variants.filter(
      (item) => item.id !== variantId,
    );
  } else {
    const index = found.list.findIndex((item) => item.id === categoryId);
    found.list.splice(index, 1);
  }

  saveCollection(found.scope, found.list, access.projectId);
  return NextResponse.json([...data.global, ...data.project]);
}
