import { apiRequest } from "./users";

export interface LinkPreview {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
}

export const getLinkPreview = async (url: string): Promise<LinkPreview> => {
  const params = new URLSearchParams({ url });
  return apiRequest(`/api/links/preview?${params.toString()}`);
};
