
import { GoogleGenAI, Type } from "@google/genai";
import { Quiz, Citation, DocumentPart } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Identifies logical parts of a document to handle output limits
 */
export const analyzeDocumentStructure = async (base64Data: string): Promise<{ parts: DocumentPart[], citations: Citation }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data,
          },
        },
        { text: "Analyze this document. 1: Provide academic citations (APA7, MLA9, Chicago). 2: Divide the entire document into 5-10 logical parts/segments for reading (e.g., 'Part 1: Pages 1-15', 'Part 2: Chapter 1'). Return as JSON." },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          citations: {
            type: Type.OBJECT,
            properties: {
              apa7: { type: Type.STRING },
              mla9: { type: Type.STRING },
              chicago: { type: Type.STRING }
            },
            required: ["apa7", "mla9", "chicago"]
          },
          parts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                title: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["id", "title", "description"]
            }
          }
        },
        required: ["citations", "parts"]
      }
    }
  });

  const jsonStr = response.text || "";
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error("Failed to analyze document structure.");
  }
};

/**
 * Extracts raw text for a specific identified segment
 */
export const extractSegmentText = async (base64Data: string, partTitle: string, partDescription: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data,
          },
        },
        { text: `Extract and return the FULL RAW TEXT for the following section: "${partTitle} (${partDescription})". Do not summarize. Return only the verbatim text found in those pages/chapters.` },
      ],
    },
  });

  if (!response.text) throw new Error("Could not extract text for this part.");
  return response.text;
};

export const generateQuiz = async (text: string): Promise<Quiz> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on the following text, generate a 5-question multiple choice quiz. Return JSON.
    
    Text: ${text.substring(0, 8000)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING }
              },
              required: ["question", "options", "answer"]
            }
          }
        },
        required: ["title", "questions"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};
