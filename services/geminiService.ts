
import { GoogleGenAI, Type } from "@google/genai";
import { Quiz, Citation } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractTextFromPdf = async (base64Data: string): Promise<string> => {
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
        { text: "Extract all the readable text from this PDF document. Provide only the plain text content." },
      ],
    },
  });

  return response.text || "Failed to extract text.";
};

export const generateQuiz = async (text: string): Promise<Quiz> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on the following text, generate a 5-question multiple choice quiz to test reading comprehension. Return it as a JSON object.
    
    Text: ${text.substring(0, 5000)}`,
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
                answer: { type: Type.STRING, description: "The correct option text" }
              },
              required: ["question", "options", "answer"]
            }
          }
        },
        required: ["title", "questions"]
      }
    }
  });

  const jsonStr = response.text || "";
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("AI Quiz JSON parse error:", err);
    throw new Error("Could not parse quiz response from AI.");
  }
};

export const generateCitations = async (text: string): Promise<Citation> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the provided text fragment to identify the author(s), title, year of publication, and publisher/source. Generate academic citations in APA 7th Edition, MLA 9th Edition, and Chicago (Author-Date) styles.
    
    Text Fragment: ${text.substring(0, 3000)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          apa7: { type: Type.STRING, description: "APA 7th Edition citation" },
          mla9: { type: Type.STRING, description: "MLA 9th Edition citation" },
          chicago: { type: Type.STRING, description: "Chicago style citation" }
        },
        required: ["apa7", "mla9", "chicago"]
      }
    }
  });

  const jsonStr = response.text || "";
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("AI Citation JSON parse error:", err);
    throw new Error("Could not parse citation response from AI.");
  }
};
