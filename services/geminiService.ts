
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

export interface InventoryMatch {
  productName: string;
  confidence: number;
}

// Factory function per ottenere l'istanza AI solo quando necessario
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const identifyProductFromImage = async (base64Images: string | string[]): Promise<any> => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview';
  const images = Array.isArray(base64Images) ? base64Images : [base64Images];
  
  const imageParts = images.map(data => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data,
    },
  }));

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
          3. NON INVENTARE: Se i numeri nell'immagine iniziano con '5', il risultato DEVE iniziare con '5'. 
          4. ZERO ASSUNZIONI: Anche se il prodotto sembra Barilla o un marchio italiano famoso, NON scrivere automaticamente '8076...' se i numeri nell'immagine dicono altro.
          5. FORMATO: Solitamente sono 13 cifre (EAN-13) o 12 (UPC). Trascrivile tutte da sinistra a destra.
          
          Restituisci JSON con:
          - name: Nome preciso del prodotto (leggilo dalla confezione).
          - barcode: Solo la stringa numerica letta (es. '5000112565348').
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
          barcode: { type: Type.STRING, description: "La sequenza numerica esatta letta sotto le barre." },
          category: { type: Type.STRING, description: "fridge, freezer, or dispensa" }
        },
        required: ["name", "barcode"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateAIProductImage = async (productName: string): Promise<string | null> => {
  const ai = getAI();
  const model = 'gemini-2.5-flash-image';
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          text: `Generate a professional, clean, high-quality studio photograph of ${productName} on a neutral light background. Packshot style, centered.`,
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
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};

export const matchImageToInventory = async (base64Image: string, inventoryNames: string[]): Promise<InventoryMatch[]> => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview';
  
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

  try {
    const data = JSON.parse(response.text);
    return (data.matches || []).sort((a: any, b: any) => b.confidence - a.confidence);
  } catch (e) {
    return [];
  }
};

export const editProductImage = async (base64Image: string, prompt: string): Promise<string | null> => {
  const ai = getAI();
  const model = 'gemini-2.5-flash-image';
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
};
