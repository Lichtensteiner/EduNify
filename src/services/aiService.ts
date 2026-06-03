import { GoogleGenAI } from "@google/genai";

export interface AIRequest {
  model?: string;
  contents: any;
  config?: any;
}

// Lazy initialization of GoogleGenAI for client-side fallback
let genAI: GoogleGenAI | null = null;

const getClientSideApiKey = (): string | null => {
  // 1. Try Vite env first
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  // 2. Try localStorage check
  try {
    return localStorage.getItem("GEMINI_API_KEY");
  } catch {
    return null;
  }
};

const getGenAI = () => {
  if (!genAI) {
    const apiKey = getClientSideApiKey();
    if (!apiKey) {
      throw new Error(
        "L'Assistant IA n'est pas configuré sur Vercel. Pour résoudre ce problème, configurez la variable d'environnement VITE_GEMINI_API_KEY dans votre dashboard Vercel, ou ajoutez-la localement. Pour tester immédiatement, vous pouvez également définir votre clé dans la console de votre navigateur en exécutant: localStorage.setItem('GEMINI_API_KEY', 'VOTRE_CLE_ICI')"
      );
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
};

export const generateAIContent = async (request: AIRequest): Promise<{ text: string }> => {
  // 1. Try executing on the server proxy first (recommended)
  try {
    const response = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ request }),
    });

    if (response.ok) {
      const data = await response.json();
      return { text: data.text };
    }
    
    // If we received a structured 500 error from our proxy with details, throw it
    if (response.status === 500) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error) {
        throw new Error(errorData.error);
      }
    }
    
    // If it's a 404, it means the server endpoint does not exist (static SPA build e.g. on Vercel)
    if (response.status === 404) {
      throw new Error("SERVER_ROUTE_NOT_FOUND");
    }
  } catch (error: any) {
    // If it's a real server error or route not found, let's fall back to client-side GoogleGenAI
    if (error.message === "SERVER_ROUTE_NOT_FOUND" || error.name === "TypeError") {
      console.warn("Server AI route not available. Falling back to client-side direct API call...", error);
    } else {
      // Propagate direct server configured errors (like actual invalid keys, etc.)
      throw error;
    }
  }

  // 2. Fallback to client-side execution (e.g. for static SPA preview or simple Vercel deploys)
  try {
    const client = getGenAI();
    
    // Normalize contents for the SDK
    const contents = normalizeContents(request.contents);
    
    // Always use the recommended model
    let modelName = request.model || "gemini-3.5-flash";
    if (modelName === "gemini-1.5-flash" || modelName === "gemini-1.5-pro" || modelName === "gemini-pro" || modelName === "gemini-3-flash-preview") {
      modelName = "gemini-3.5-flash";
    }

    const response = await client.models.generateContent({
      model: modelName,
      contents,
      config: request.config
    });

    if (!response.text) {
      throw new Error("L'IA a retourné une réponse vide.");
    }

    return { text: response.text };
  } catch (error: any) {
    console.error("AI Client Service Error:", error);
    
    if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("400")) {
      throw new Error("Clé API Gemini invalide. Veuillez vérifier votre configuration dans votre dashboard d'hébergement ou localStorage.");
    }
    
    if (error.message?.includes("PERMISSION_DENIED") || error.message?.includes("403")) {
      throw new Error("Accès refusé. Veuillez vérifier les permissions de votre clé API Gemini.");
    }

    if (error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("429")) {
      throw new Error("Quota épuisé. Si vous utilisez le compte gratuit, essayez d'attendre un peu ou configurez une clé payante.");
    }

    throw new Error(error.message || "Erreur lors de la génération avec l'IA");
  }
};

// Helper to normalize contents for Gemini
function normalizeContents(contents: any) {
  if (Array.isArray(contents)) return contents;
  if (contents && contents.contents) {
    return Array.isArray(contents.contents) ? contents.contents : [contents.contents];
  }
  if (contents && contents.parts) {
    return [{ parts: contents.parts }];
  }
  return [contents];
}
