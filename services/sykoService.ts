import { Message } from '../types';

// ============================================================================
// 🛠️ HUGGING FACE AYARLARI
// ============================================================================

// Senin Model ID'n:
const HF_MODEL_ID = "syko818121/SykoLLM-V2.5-Thinking-Beta";

// Modelin Kişiliği (System Prompt)
const SYSTEM_INSTRUCTION = `
You are SykoLLM, an advanced AI developed by Syko AI.
You are currently in Beta v2.5.
You are helpful, dark-themed, and intelligent.
You prefer a concise, hacker-like, cool tone.
Do not mention being a language model unless asked.
`;

// ============================================================================

export const streamResponse = async (
  modelId: string, 
  history: Message[],
  onChunk: (text: string) => void
): Promise<string> => {
  
  const apiKey = process.env.API_KEY;
  if (!apiKey || !apiKey.startsWith('hf_')) {
    console.error("API Key Hatası: Hugging Face token'ı eksik.");
  }

  // 1. Prompt Formatlama
  let fullPrompt = `<|im_start|>system\n${SYSTEM_INSTRUCTION}<|im_end|>\n`;

  history.forEach((msg) => {
    fullPrompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
  });

  fullPrompt += `<|im_start|>assistant\n`;

  // ⚠️ GÜVENLİK ÖNLEMİ: Timeout (Zaman Aşımı)
  // Eğer model 45 saniye içinde hiç cevap vermezse bağlantıyı keseriz.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL_ID}/stream`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal, // Timeout sinyali
        body: JSON.stringify({
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: 512, // Model kötü olduğu için çok uzun yazmasına izin vermeyelim, saçmalayabilir.
            temperature: 0.6,    // Daha tutarlı olması için yaratıcılığı biraz kıstım.
            top_p: 0.9,
            repetition_penalty: 1.2, // Sürekli aynı şeyi tekrarlamasını engeller.
            return_full_text: false,
          },
          stream: true,
        }),
      }
    );

    clearTimeout(timeoutId); // Bağlantı başarılı, sayacı durdur.

    if (!response.ok) {
      const errText = await response.text();
      if (errText.includes("currently loading")) {
         throw new Error("⏳ Model şu an uyanıyor (Cold Boot). Hugging Face ücretsiz sunucularında modeller kullanılmadığında uyku moduna geçer. Lütfen 30 saniye bekleyip tekrar dene.");
      }
      throw new Error(`Model Hatası (${response.status}): ${errText}`);
    }

    if (!response.body) throw new Error("Model boş yanıt döndürdü.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let finalOutput = "";
    let chunkCount = 0;

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
              const textFragment = data.token?.text || ""; 
              
              // Bazı modeller özel tokenları metin gibi basar, onları filtreleyelim
              if (textFragment && !textFragment.includes('<|im_end|>')) {
                finalOutput += textFragment;
                onChunk(textFragment);
                chunkCount++;
              }
            } catch (e) {
              // Yut
            }
          }
        }
      }
    }

    if (chunkCount === 0 && finalOutput.length === 0) {
        throw new Error("Model bağlandı ama sessiz kaldı (Boş yanıt). Modelin eğitimi henüz tamamlanmamış olabilir.");
    }

    return finalOutput;

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("SykoLLM Hatası:", error);
    
    if (error.name === 'AbortError') {
        throw new Error("Zaman aşımı: Model çok yavaş yanıt veriyor veya takıldı.");
    }
    
    throw error;
  }
};
