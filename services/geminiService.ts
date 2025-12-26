
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

export interface InventoryMatch {
  productName: string;
  confidence: number;
}

// Funzione helper per pulire il JSON dalle risposte del modello
const cleanJsonResponse = (text: string) => {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
};

export const identifyProductFromImage = async (base64Images: string | string[]): Promise<any> => {
  // Use process.env.API_KEY directly and create new instance per call as required
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Utilizziamo gemini-3-flash-preview per l'OCR
  const model = 'gemini-3-flash-preview';
  const images = Array.isArray(base64Images) ? base64Images : [base64Images];
  
  const imageParts = images.map(data => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data,
    },
  }));

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          ...imageParts,
          {
            text: `AGISCI COME UN LETTORE OCR DI PRECISIONE PER CODICI A BARRE.
            
            ISTRUZIONI TASSATIVE:
            1. INDIVIDUA il blocco del codice a barre (barre nere su fondo bianco).
            2. LEGGI LETTERALMENTE le cifre stampate IMMEDIATAMENTE SOTTO le barre.
            3. FORMATO: Solitamente sono 13 cifre (EAN-13) o 12 (UPC). Trascrivile tutte.
            
            Restituisci JSON con:
            - name: Nome preciso del prodotto.
            - barcode: Solo la stringa numerica letta.
            - category: Una tra 'fridge', 'freezer', 'dispensa'.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            barcode: { type: Type.STRING },
            category: { type: Type.STRING }
          },
          required: ["name", "barcode"]
        }
      }
    });

    const jsonStr = response.text.trim();
    return JSON.parse(cleanJsonResponse(jsonStr));
  } catch (error) {
    console.error("Errore identifyProductFromImage:", error);
    throw error;
  }
};

export const generateAIProductImage = async (productName: string): Promise<string | null> => {
  // Use process.env.API_KEY directly and create new instance per call as required
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Utilizziamo gemini-2.5-flash-image per la generazione di immagini
  const model = 'gemini-2.5-flash-image'; 
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            text: `Generate a professional, clean, high-quality studio photograph of ${productName} on a neutral light background. Packshot style, centered. Realistic lighting.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      // Find the image part as per guidelines
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Errore generateAIProductImage:", error);
    throw error;
  }
};

export const matchImageToInventory = async (base64Image: string, inventoryNames: string[]): Promise<InventoryMatch[]> => {
  // Use process.env.API_KEY directly and create new instance per call as required
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: `Confronta l'immagine con questo inventario: ${inventoryNames.join(", ")}. Restituisci le corrispondenze in JSON.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  confidence: { type: Type.NUMBER }
                },
                required: ["productName", "confidence"]
              }
            }
          },
          required: ["matches"]
        }
      }
    });

    const jsonStr = response.text.trim();
    const data = JSON.parse(cleanJsonResponse(jsonStr));
    return (data.matches || []).sort((a: any, b: any) => b.confidence - a.confidence);
  } catch (e) {
    console.error("Errore matchImageToInventory:", e);
    return [];
  }
};

export const editProductImage = async (base64Image: string, prompt: string): Promise<string | null> => {
  // Use process.env.API_KEY directly and create new instance per call as required
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Utilizziamo gemini-2.5-flash-image per l'editing
  const model = 'gemini-2.5-flash-image'; 
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/png' } },
          { text: prompt },
        ],
      },
    });
    for (const part of response.candidates[0].content.parts) {
      // Find the image part as per guidelines
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) {
    console.error("Errore editProductImage:", error);
    return null;
  }
};
