export function getFormUrl(formId) {
  const vercelUrl = process.env.REACT_APP_VERCEL_URL;

  if (vercelUrl) {
    const cleanUrl = vercelUrl.replace(/^https?:\/\//, "");
    return `https://${cleanUrl}/api/f/${formId}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/f/${formId}`;
  }

  const baseUrl = process.env.REACT_APP_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/api/f/${formId}`;
}
