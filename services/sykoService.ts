import { Message } from '../types';

// ============================================================================
// 🛠️ MODEL VE AYARLAR
// ============================================================================

// Senin Model ID'n:
const HF_MODEL_ID = "syko818121/SykoLLM-V2.5-Thinking-Beta";

// Modelin Kişiliği (System Prompt) - Bunu agresif yapıyorum ki model olduğunu kanıtlasın.
const SYSTEM_INSTRUCTION = `
You are SykoLLM. YOU ARE NOT GEMINI. YOU ARE NOT OPENAI.
You are a custom AI model created by Syko AI.
Your version is V2.5 Thinking Beta.
You are dark, edgy, minimalist, and extremely intelligent.
Answer briefly and coolly.
If asked "Who are you?", reply: "I am SykoLLM V2.5, running on custom weights."
`;

// ============================================================================

export const streamResponse = async (
  modelId: string, 
  history: Message[],
  onChunk: (text: string) => void
): Promise<string> => {
  
  const apiKey = process.env.API_KEY;

  // 1. KESİN KONTROL: Anahtar 'hf_' ile başlamıyorsa işlemi hemen durdur.
  if (!apiKey || !apiKey.startsWith('hf_')) {
    const errorMsg = "⛔ HATALI ANAHTAR TESPİT EDİLDİ!\n\nŞu an 'API_KEY' olarak Google (Gemini) şifresi girili görünüyor. \n\nBu model Hugging Face üzerindedir. Lütfen .env dosyanı veya Vercel ayarlarını aç, 'hf_' ile başlayan Hugging Face Token'ını yapıştır.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 2. Prompt Hazırlama (ChatML Formatı)
  let fullPrompt = `<|im_start|>system\n${SYSTEM_INSTRUCTION}<|im_end|>\n`;

  history.forEach((msg) => {
    fullPrompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
  });

  fullPrompt += `<|im_start|>assistant\n`;

  // 3. İstek Gönderme
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 saniye bekleme süresi

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL_ID}/stream`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: 1024,
            temperature: 0.7,
            top_p: 0.9,
            repetition_penalty: 1.1,
            return_full_text: false,
          },
          stream: true,
        }),
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      if (errText.includes("currently loading")) {
         throw new Error("⏳ Model Uyanıyor... Hugging Face modelleri kullanılmadığında uyur. Lütfen 30 saniye sonra tekrar dene.");
      }
      throw new Error(`Hugging Face Hatası (${response.status}): ${errText}`);
    }

    if (!response.body) throw new Error("Yanıt boş geldi.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let finalOutput = "";

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const jsonStr = line.slice(5).trim();
            if (jsonStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(jsonStr);
              // Hugging Face standardı: token.text
              let textFragment = data.token?.text || ""; 
              
              // Temizlik
              if (textFragment.includes('<|im_end|>')) textFragment = textFragment.replace('<|im_end|>', '');
              
              if (textFragment) {
                finalOutput += textFragment;
                onChunk(textFragment);
              }
            } catch (e) {
              // JSON hatası olursa yut
            }
          }
        }
      }
    }

    return finalOutput;

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("SykoLLM Service Error:", error);
    throw error;
  }
};
