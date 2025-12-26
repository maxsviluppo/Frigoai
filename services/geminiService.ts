
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

export interface InventoryMatch {
  productName: string;
  confidence: number;
}

const cleanJsonResponse = (text: string) => {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
};

export const identifyProductFromImage = async (base64Images: string | string[]): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
            text: `AGISCI COME UN LETTORE DI CODICI A BARRE PROFESSIONALE.
            
            OPERAZIONI:
            1. Scansiona l'immagine alla ricerca di un codice a barre (EAN-13, EAN-8, UPC).
            2. Estrai il numero esatto.
            3. Identifica il prodotto associato (marca e nome).
            4. Se non c'è un codice a barre leggibile, prova a identificare il prodotto dall'etichetta visiva.
            
            RESTITUISCI SEMPRE UN JSON VALIDO:
            - name: Nome completo del prodotto.
            - barcode: Solo i numeri (se presenti, altrimenti stringa vuota).
            - category: 'fridge', 'freezer', o 'dispensa'.`,
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
          required: ["name", "barcode", "category"]
        }
      }
    });

    return JSON.parse(cleanJsonResponse(response.text));
  } catch (error) {
    console.error("Errore identifyProductFromImage:", error);
    throw error;
  }
};

export const generateAIProductImage = async (productName: string): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-2.5-flash-image'; 
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: `A professional studio packshot of ${productName}, white background, 4k, realistic.` }],
      },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) {
    console.error("Errore generateAIProductImage:", error);
    throw error;
  }
};

export const matchImageToInventory = async (base64Image: string, inventoryNames: string[]): Promise<InventoryMatch[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: `Trova corrispondenze in questo inventario: ${inventoryNames.join(", ")}.` },
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
    const data = JSON.parse(cleanJsonResponse(response.text));
    return (data.matches || []).sort((a: any, b: any) => b.confidence - a.confidence);
  } catch (e) {
    return [];
  }
};

export const editProductImage = async (base64Image: string, prompt: string): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) {
    return null;
  }
};
