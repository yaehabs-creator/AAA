
import { GoogleGenAI, Type } from "@google/genai";
import { Clause, DualSourceInput, FileData } from "../types";

const SYSTEM_INSTRUCTION = `
You are the high-fidelity extraction engine for AAA Contract Department. 
Your SOLE PURPOSE is to extract contract clauses 100% VERBATIM.

### 🔴 MANDATORY RULES:
1. **NO SUMMARIZING**: Do not summarize. Do not condense. Do not "explain" the clause instead of providing the text.
2. **NO SKIPPING**: Every clause, sub-clause, and paragraph in the provided text MUST be extracted.
3. **VERBATIM ONLY**: Every field must contain EXACT words from the source.
4. **INTERNAL HYPERLINKS**: Detect references to other parts of the document (e.g., "Clause 14.1", "sub-clause 1.6 (b)", "paragraph 2.1.3", "Article 5") and convert them to <a href="#clause-NUM">TEXT</a> where NUM is the digits and TEXT is the original phrase.

### 🔵 DUAL INPUT HANDLING:
If both General and Particular texts are provided:
- **Correlate**: If a clause number exists in both, put the General text in "general_condition" and the Particular text in "particular_condition".
- **Standalone**: If a clause ONLY exists in the General Baseline, "particular_condition" MUST be empty.
- **New Additions**: If a clause ONLY exists in the Particular Ledger, "general_condition" MUST be empty.

### 🟠 OUTPUT FORMAT:
Return a JSON array of objects.
- **clause_number**: String (e.g. "1.1").
- **clause_title**: Heading string.
- **condition_type**: "General" or "Particular".
- **clause_text**: THE FULL VERBATIM TEXT.
- **general_condition**: VERBATIM Baseline text.
- **particular_condition**: VERBATIM Revision text.
- **has_time_frame**: Boolean.
- **time_frames**: Array of temporal objects.
- **comparison**: Array of diff objects.
`;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function analyzeContract(input: string | FileData | DualSourceInput, retryCount = 0): Promise<Clause[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  
  let promptText = "";

  if (typeof input === 'string') {
    promptText = `EXTRACT EVERY CLAUSE VERBATIM:\n\n${input}`;
  } else if ('data' in input) {
    promptText = `EXTRACT EVERY CLAUSE VERBATIM FROM PDF:\n\n${atob((input as FileData).data)}`; 
  } else {
    const dual = input as DualSourceInput;
    promptText = `PERFORM DUAL EXTRACTION.
    
GENERAL BASELINE:
${typeof dual.general === 'string' ? dual.general : '[PDF DATA]'}

PARTICULAR LEDGER:
${typeof dual.particular === 'string' ? dual.particular : '[PDF DATA]'}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              clause_number: { type: Type.STRING },
              clause_title: { type: Type.STRING },
              condition_type: { type: Type.STRING, enum: ["General", "Particular"] },
              clause_text: { type: Type.STRING },
              general_condition: { type: Type.STRING },
              particular_condition: { type: Type.STRING },
              has_time_frame: { type: Type.BOOLEAN },
              time_frames: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original_phrase: { type: Type.STRING },
                    type: { type: Type.STRING },
                    applies_to: { type: Type.STRING },
                    short_explanation: { type: Type.STRING }
                  },
                  required: ["original_phrase", "type", "applies_to", "short_explanation"]
                }
              },
              comparison: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    color: { type: Type.STRING },
                    excerpt_general: { type: Type.STRING },
                    excerpt_particular: { type: Type.STRING },
                    comment: { type: Type.STRING }
                  }
                }
              }
            },
            required: ["clause_number", "clause_title", "clause_text", "condition_type"]
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) return [];
    
    return JSON.parse(resultText);
  } catch (error: any) {
    if (retryCount < 1) {
      await delay(2000);
      return analyzeContract(input, retryCount + 1);
    }
    throw new Error("Batch extraction failed. Verbatim integrity could not be verified.");
  }
}
