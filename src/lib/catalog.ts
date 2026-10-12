import { api } from "@/lib/api";

type CatalogItem = {
  id: string;
  name: string;
  isActive: boolean;
};

export async function fetchClassOptions(): Promise<string[]> {
  const { data } = await api.get<CatalogItem[]>("/catalog/classes");
  return data.map((item) => item.name);
}

export async function fetchSubjectOptions(): Promise<string[]> {
  const { data } = await api.get<CatalogItem[]>("/catalog/subjects");
  return data.map((item) => item.name);
}
