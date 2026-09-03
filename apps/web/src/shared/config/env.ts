function readApiUrl(): string {
  const value = import.meta.env.VITE_API_URL;
  if (!value) {
    throw new Error("VITE_API_URL is required");
  }
  return value;
}

export const env = {
  apiUrl: readApiUrl(),
};
