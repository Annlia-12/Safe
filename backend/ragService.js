const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ────────────────────────────────────────────────
// NEW: Groq-based keyword law lookup (no HuggingFace)
// ────────────────────────────────────────────────
async function matchLaws(groq, userMessage) {
  console.log('--> RAG: Identifying relevant laws via Groq for:', userMessage.slice(0, 80));

  try {
    // Step 1: Ask Groq to identify law keywords
    const keywordRes = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a legal expert specializing in Indian law. 
Given a user's problem, return a JSON object with:
- "keywords": array of 3-5 key legal terms or act names to search (e.g. "Payment of Wages", "Consumer Protection", "domestic violence")
- "acts": array of 1-3 specific Indian act names relevant to this problem

Return ONLY valid JSON. Example:
{"keywords": ["salary not paid", "minimum wage"], "acts": ["Payment of Wages Act 1936", "Minimum Wages Act 1948"]}`
        },
        { role: 'user', content: userMessage }
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(keywordRes.choices[0].message.content);
    const keywords = parsed.keywords || [];
    const acts = parsed.acts || [];
    console.log('--> RAG: Groq identified keywords:', keywords, '| acts:', acts);

    // Step 2: Try Supabase text search with those keywords
    let lawSections = [];
    for (const kw of [...keywords, ...acts].slice(0, 4)) {
      try {
        const { data } = await supabase
          .from('laws')
          .select('act_name, section_number, section_title, section_text, authority')
          .or(`act_name.ilike.%${kw}%,section_title.ilike.%${kw}%,section_text.ilike.%${kw}%`)
          .limit(2);
        if (data && data.length > 0) lawSections.push(...data);
      } catch (e) {
        // Supabase search for this keyword failed, skip
      }
    }

    // Deduplicate by section_number
    const seen = new Set();
    lawSections = lawSections.filter(l => {
      const key = `${l.act_name}-${l.section_number}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);

    if (lawSections.length > 0) {
      const formatted = lawSections.map((law, i) =>
        `${i + 1}. ${law.act_name} Section ${law.section_number} — ${law.section_title}: ${law.section_text} (Authority: ${law.authority})`
      ).join('\n');
      console.log(`--> RAG: Found ${lawSections.length} law sections from Supabase.`);
      return formatted;
    }

    // Step 3: Fallback — let Groq answer from its own knowledge
    console.log('--> RAG: No Supabase matches, using Groq internal knowledge.');
    return `[Groq internal knowledge — acts identified: ${acts.join(', ')}]`;

  } catch (err) {
    console.error('--> RAG: Error during law matching:', err.message);
    return '[Groq will answer from general Indian legal knowledge]';
  }
}

// ────────────────────────────────────────────────
// Detect if message needs legal help or is casual
// ────────────────────────────────────────────────
async function detectIntent(groq, message) {
  try {
    const res = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Classify the user's message into one of these categories:
"legal" — if they describe a legal problem, injustice, crime, rights violation, complaint, workplace issue, family violence, fraud, property dispute, consumer issue, RTI, etc.
"casual" — if they are greeting, expressing emotions, asking general questions, or chatting.
Return ONLY a JSON: {"intent": "legal"} or {"intent": "casual"}`
        },
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' }
    });
    const parsed = JSON.parse(res.choices[0].message.content);
    return parsed.intent || 'casual';
  } catch (e) {
    return 'legal'; // default to legal so we don't miss anything
  }
}

// ────────────────────────────────────────────────
// Main response generator — warm empathetic AI
// ────────────────────────────────────────────────
async function getGroqResponse(groq, userMessage, contextLaws, language, script, conversationHistory = []) {
  const langInstruction = `
LANGUAGE RULE — CRITICAL:
The user's language is: ${language || 'en'}, script: ${script || 'latin'}.
You MUST reply in EXACTLY the same language and script the user is using.
- If they wrote in Malayalam (script: malayalam), reply ONLY in Malayalam script.
- If they wrote in Hindi Devanagari, reply ONLY in Devanagari.
- If they wrote in English, reply in English.
- If the user uses a mix (Hinglish/Romanized), respond in the SAME style of mix.
NEVER switch language mid-conversation unless user switches first.
`;

  const systemPrompt = `You are Veritas — India's warmest and most knowledgeable free legal companion.

YOUR PERSONALITY:
- You are like the most caring, calm, wise elder in someone's family — part mother, part senior advocate.
- You speak to the person as a close, trusted friend who deeply cares about them.
- Your tone is always gentle, reassuring, and empowering. Reach out to them with words like "I am here with you," "You are brave," and "You are not alone."
- Use simple, everyday language. No legal jargon without explanation.
- Every single reply must feel handcrafted for that exact person.

STRUCTURE FOR LEGAL PROBLEMS:
1. EMOTIONAL ACKNOWLEDGEMENT FIRST (2-3 sentences): Acknowledge their pain with warmth and empathy. Validate their feelings. Be specific to their situation.
2. LEGAL RIGHTS (clearly numbered): List the exact Indian laws and sections that protect them based on this context: ${contextLaws || 'general Indian legal knowledge'}. Explain each in one plain-language sentence as it applies to THEM.
3. IMMEDIATE NEXT STEPS (numbered): Tell them exactly what to do right now, step by step (at least 3-5 steps).
4. ENCOURAGEMENT (1 sentence): End with a brief, genuine word of strength and solidarity.

NEVER start with legal text. NEVER be cold or formulaic.
Keep response under 300 words. Plain text only.

${langInstruction}
`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-8),
    { role: 'user', content: userMessage }
  ];

  try {
    console.log('--> Groq: Generating empathetic reply...');
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
    });
    const reply = chatCompletion.choices[0]?.message?.content || 'I am here for you. Please tell me what happened.';
    console.log('--> Groq: Reply generated successfully.');
    return reply;
  } catch (err) {
    console.error('--> Groq: Chat completion error:', err.message);
    return 'I am here with you. Please try again in a moment.';
  }
}

// ────────────────────────────────────────────────
// Generate a question in the user's language
// ────────────────────────────────────────────────
async function generateInLanguage(groq, question, language, script) {
  try {
    const res = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Translate/rephrase the following question into language code "${language}" (script: ${script}).
Keep it warm, gentle and conversational — like a caring friend asking.
Return ONLY the translated question, nothing else.`
        },
        { role: 'user', content: question }
      ],
      model: 'llama-3.3-70b-versatile'
    });
    return res.choices[0]?.message?.content?.trim() || question;
  } catch (e) {
    return question; // fallback to English
  }
}

module.exports = {
  matchLaws,
  getGroqResponse,
  detectIntent,
  generateInLanguage
};
