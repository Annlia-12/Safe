const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const { Groq } = require('groq-sdk');
const admin = require('firebase-admin');
require('dotenv').config();

const { matchLaws, getGroqResponse, detectIntent } = require('./ragService');
const { generateComplaintLetter } = require('./pdfService');
const { findNearestOfficeAndLawyers } = require('./locationService');
const { processAudioMessage } = require('./voiceService');
const { textToSpeech } = require('./ttsService');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const storage = multer.diskStorage({
  destination: 'tmp/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `voice_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Firebase ──────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});
const db = admin.firestore();

// ── Groq & Twilio ─────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

app.get('/', (req, res) => res.send('🌟 Nyay AI Backend Running'));

// ── tmp folder ────────────────────────────────────────
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

// Send WhatsApp message with 3 retries. Auto-splits messages > 1550 chars.
async function sendWhatsAppMessage(to, body, mediaUrl = null, retries = 3) {
  if (!body && !mediaUrl) return false;

  // Split long messages
  if (body && body.length > 1550) {
    console.log(`--> Twilio: Message too long (${body.length} chars), splitting...`);
    const parts = [];
    let remaining = body;
    while (remaining.length > 0) {
      // Try to split at a newline near the 1500-char mark
      let cutAt = 1500;
      const newlineIdx = remaining.lastIndexOf('\n', 1500);
      if (newlineIdx > 800) cutAt = newlineIdx;
      parts.push(remaining.slice(0, cutAt).trim());
      remaining = remaining.slice(cutAt).trim();
    }
    let success = true;
    for (let i = 0; i < parts.length; i++) {
      console.log(`--> Twilio: Sending part ${i + 1}/${parts.length}...`);
      // Only attach media to first part
      const ok = await sendWhatsAppMessage(to, parts[i], i === 0 ? mediaUrl : null, retries);
      if (!ok) success = false;
      if (i < parts.length - 1) await new Promise(r => setTimeout(r, 1000));
    }
    return success;
  }

  const msgOpt = {
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to,
    body: body || ' '
  };
  if (mediaUrl) msgOpt.mediaUrl = [mediaUrl];

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`--> Twilio: Sending (attempt ${i + 1}/${retries}, media: ${!!mediaUrl})`);
      await twilioClient.messages.create(msgOpt);
      console.log(`--> Twilio: ✓ Sent to ${to}`);
      return true;
    } catch (err) {
      console.error(`--> Twilio: ✗ Attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1200));
    }
  }
  console.error('--> Twilio: FINAL FAILURE — all retries exhausted.');
  return false;
}

// ── FIX P1: Language locked on first message, never re-detected after ──
// Fast Unicode detection — no API call needed
function detectLangFromText(text) {
  if (/[\u0D00-\u0D7F]/.test(text)) return { language: 'ml', script: 'malayalam' };
  if (/[\u0B80-\u0BFF]/.test(text)) return { language: 'ta', script: 'tamil' };
  if (/[\u0C00-\u0C7F]/.test(text)) return { language: 'te', script: 'telugu' };
  if (/[\u0C80-\u0CFF]/.test(text)) return { language: 'kn', script: 'kannada' };
  if (/[\u0900-\u097F]/.test(text)) return { language: 'hi', script: 'devanagari' };
  if (/[\u0A80-\u0AFF]/.test(text)) return { language: 'gu', script: 'gujarati' };
  if (/[\u0A00-\u0A7F]/.test(text)) return { language: 'pa', script: 'gurmukhi' };
  if (/[\u0980-\u09FF]/.test(text)) return { language: 'bn', script: 'bengali' };
  return null; // null means Groq fallback needed
}

// Groq fallback for romanized/mixed scripts
async function detectLangViaGroq(text) {
  try {
    const res = await groq.chat.completions.create({
      messages: [{
        role: 'system',
        content: `Detect language and script of this text. Return ONLY JSON: {"language":"en","script":"latin","isRomanized":false}.
Codes — language: en,hi,ta,te,ml,kn,gu,mr,bn,pa. script: latin,devanagari,tamil,telugu,malayalam,kannada,gujarati,gurmukhi,bengali.
If text is Romanized Hindi (Hinglish), return {"language":"hi","script":"latin","isRomanized":true}.
If text is clearly English, return {"language":"en","script":"latin","isRomanized":false}.`
      }, { role: 'user', content: text.slice(0, 300) }],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' }
    });
    const parsed = JSON.parse(res.choices[0].message.content);
    if (parsed.language && parsed.script) return parsed;
  } catch (e) {
    console.error('--> Lang detection via Groq failed:', e.message);
  }
  return { language: 'en', script: 'latin' };
}

// Detect Yes/No in any language
async function detectYesNo(message) {
  const lowered = message.toLowerCase().trim();
  const yesWords = ['yes', 'haan', 'ha', 'ok', 'okay', 'sure', 'bilkul', 'zaroor',
    'हाँ', 'हां', 'हो', 'ஆம்', 'అవును', 'അതെ', 'ಹೌದು', 'ہاں', 'jee', 'ji'];
  const noWords = ['no', 'nahi', 'nope', 'na', 'mat', 'naa', 'nope',
    'नहीं', 'नही', 'नको', 'இல்லை', 'కాదు', 'ഇല്ല', 'ಇಲ್ಲ', 'نہیں'];

  if (yesWords.some(w => lowered.includes(w))) return 'yes';
  if (noWords.some(w => lowered.includes(w))) return 'no';

  try {
    const res = await groq.chat.completions.create({
      messages: [{
        role: 'system',
        content: 'The user was asked a yes/no question. Reply ONLY with "yes", "no", or "unclear".'
      }, { role: 'user', content: message }],
      model: 'llama-3.3-70b-versatile'
    });
    return res.choices[0]?.message?.content?.trim()?.toLowerCase() || 'unclear';
  } catch (e) {
    return 'unclear';
  }
}

// ── Core personality for ALL Groq replies ─────────────
const VERITAS_SOUL = `You are Veritas — India's warmest and most knowledgeable free legal companion.

YOUR PERSONALITY:
- You are like the most caring, calm, wise elder in someone's family — part mother, part senior advocate.
- You speak to the person as a close, trusted friend who deeply cares about them — not as a chatbot.
- You are gender-neutral and equally warm to men, women, and anyone else.
- Your tone is always gentle, reassuring, and empowering. Never cold. Never robotic. Never preachy.
- Use simple, everyday language. No legal jargon without explanation.
- You never judge. You never question if someone is telling the truth.
- Every single reply must feel handcrafted for that exact person, not a template.

WHEN SOMEONE SHARES A PROBLEM — ALWAYS FOLLOW THIS EXACT STRUCTURE:
1. EMOTIONAL ACKNOWLEDGEMENT FIRST (2-3 sentences): Acknowledge their pain with warmth and empathy. Make them feel heard, safe, and not alone. Validate their feelings. Be specific to their situation — not generic. Reach out to them with words like "I am here with you," "You are brave," and "You are not alone."
2. LEGAL RIGHTS (clearly numbered): List the exact Indian laws and sections that protect them. Explain each in one plain-language sentence. Do not just list the law, explain what it means for THEM.
3. IMMEDIATE NEXT STEPS (numbered): Tell them exactly what to do right now, step by step. Include at least 3 actionable steps.
4. ENCOURAGEMENT (1 sentence): End with a brief, genuine word of strength and solidarity.

NEVER start a reply with legal text before emotional acknowledgement.
NEVER use bullet points without context.
NEVER be dismissive, cold, or formulaic.
`;

async function groqReply(systemInstruction, userMessage, history = [], language = 'en', script = 'latin') {
  const LANG_RULE = `\n\nCRITICAL LANGUAGE RULE: 
The user's language is: ${language} (${script} script).
You MUST reply in EXACTLY that language and script. No exceptions.
- If language is "ml" reply ONLY in Malayalam script.
- If language is "hi" reply ONLY in Hindi Devanagari.
- If language is "en" reply ONLY in English.
- If the user uses a mix (Hinglish/Romanized), respond in the SAME style of mix.
Never respond in a different language. Never auto-translate to English in your final output.
Stay in character as Veritas throughout.`;

  try {
    const res = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: VERITAS_SOUL + '\n\nADDITIONAL CONTEXT:\n' + systemInstruction + LANG_RULE },
        ...history.slice(-8),
        { role: 'user', content: userMessage }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.75, // Slightly higher for more fluid empathy
      max_tokens: 1000
    });
    return res.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('--> Groq reply error:', err.message);
    return '';
  }
}

// Strip undefined before Firestore save
const sanitize = (obj) => JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));

// ═══════════════════════════════════════════════════
// WEBHOOK
// ═══════════════════════════════════════════════════
app.post('/webhook', async (req, res) => {
  console.log('\n══════════════════════════════════════════');
  console.log('--> Webhook hit!');
  const twiml = new twilio.twiml.MessagingResponse();
  res.type('text/xml').send(twiml.toString());

  try {
    const fromNumber = req.body.From;
    let incomingMsg = req.body.Body?.trim() || '';
    let isVoiceMessage = false;

    console.log(`--> From: ${fromNumber}`);

    // ── Handle voice note ──────────────────────────
    if (parseInt(req.body.NumMedia) > 0 && req.body.MediaContentType0?.includes('audio')) {
      console.log('--> Audio message detected.');
      isVoiceMessage = true;
      const result = await processAudioMessage(req.body.MediaUrl0, groq);
      if (result?.text) {
        incomingMsg = result.text;
        console.log(`--> Transcribed: "${incomingMsg}"`);
        // Store detected language from transcription for use below
        req._voiceLang = result.detectedLang;
      } else {
        console.warn('--> Transcription failed or returned null.');
        incomingMsg = '';
      }
    } else {
      console.log(`--> Text message: "${incomingMsg}"`);
    }

    if (!incomingMsg && !req.body.Latitude) {
      console.log('--> Empty message, ignoring.');
      return;
    }

    // ── Handle location pin ────────────────────────
    let latitude = null, longitude = null;
    if (req.body.Latitude && req.body.Longitude) {
      latitude = parseFloat(req.body.Latitude);
      longitude = parseFloat(req.body.Longitude);
      incomingMsg = `__LOCATION__`;
      console.log(`--> Location pin: ${latitude}, ${longitude}`);
    }

    // ── Load state from Firestore ──────────────────
    const userRef = db.collection('users').doc(fromNumber);
    const snap = await userRef.get();
    let state = snap.exists
      ? snap.data()
      : { step: 'new', history: [], language: null, script: null };

    if (!state.history) state.history = [];
    if (!state.step) state.step = 'new';

    console.log(`--> State: step=${state.step}, lang=${state.language}, script=${state.script}`);

    // ── Language detection — runs on EVERY message ──────────
    // Rule: always trust the current message's script over the stored value.
    // 1. Fast Unicode byte-range check (instant, no API call)
    // 2. If Unicode finds a regional script → use it regardless of what's stored
    // 3. If Unicode returns null (Latin-based text):
    //    a. If stored language is a NON-Latin script language → user switched to English → set 'en'
    //    b. If stored language is already 'en' → keep 'en'
    //    c. If no stored language at all → Groq detects (handles Romanized Hindi/Hinglish)
    const NON_LATIN_LANGS = new Set(['hi', 'mr', 'ml', 'ta', 'te', 'kn', 'gu', 'bn', 'pa']);
    if (incomingMsg && incomingMsg !== '__LOCATION__') {
      const voiceDetected = req._voiceLang || null;
      const unicodeDetect = voiceDetected || detectLangFromText(incomingMsg);

      if (unicodeDetect) {
        // Clear winner from script bytes — always trust this
        if (state.language !== unicodeDetect.language) {
          console.log(`--> Language: Unicode detected ${unicodeDetect.language} (${unicodeDetect.script}), was ${state.language}`);
        }
        state.language = unicodeDetect.language;
        state.script = unicodeDetect.script;
      } else {
        // Latin/romanized text — no Unicode match
        if (!state.language) {
          // Brand new user — ask Groq to detect (handles Romanized Hindi, Hinglish etc.)
          console.log('--> Language: New user with Latin text — detecting via Groq...');
          const groqDetected = await detectLangViaGroq(incomingMsg);
          state.language = groqDetected.language;
          state.script = groqDetected.script;
          console.log(`--> Language set to: ${state.language} (${state.script})`);
        } else if (NON_LATIN_LANGS.has(state.language)) {
          // Was typing in a non-Latin script, now typing plain Latin → switch to English
          console.log(`--> Language: Was ${state.language}, user now typing Latin → switching to English`);
          state.language = 'en';
          state.script = 'latin';
        }
        // else: was already 'en', stays 'en' — no change needed
      }
    }

    // Final safety fallback
    if (!state.language) { state.language = 'en'; state.script = 'latin'; }
    console.log(`--> Language final: ${state.language} (${state.script})`);

    const lang = state.language;
    const script = state.script;

    // Add to history
    if (incomingMsg && incomingMsg !== '__LOCATION__') {
      state.history.push({ role: 'user', content: incomingMsg });
      if (state.history.length > 14) state.history.splice(0, 2);
    }

    let replyMsg = '';

    // ═══════════════════════════════════════════════
    // STEP ROUTING
    // ═══════════════════════════════════════════════

    // ── NEW / GREETING ─────────────────────────────
    if (state.step === 'new' || state.step === 'chat') {
      console.log('--> State: NEW/CHAT. Checking intent...');

      if (incomingMsg === '__LOCATION__') {
        replyMsg = await groqReply(
          `You are Veritas, a warm caring friend. The user shared their location unexpectedly. 
Warmly tell them to first describe their problem so you can help them better, then share location.`,
          'User shared location without a problem', state.history, lang, script);
      } else {
        const intent = await detectIntent(groq, incomingMsg);
        console.log(`--> Intent: ${intent}`);

        if (intent === 'legal') {
          console.log('--> Switching to LEGAL mode...');
          const lawsContext = await matchLaws(groq, incomingMsg);
          replyMsg = await getGroqResponse(groq, incomingMsg, lawsContext, lang, script, state.history);

          // Categorize issue type
          try {
            const catRes = await groq.chat.completions.create({
              messages: [
                { role: 'system', content: 'Categorize into ONE word only: wage, consumer, cyber, domestic, property, rti, general. Reply ONLY that single word.' },
                { role: 'user', content: incomingMsg }
              ],
              model: 'llama-3.3-70b-versatile'
            });
            state.issueType = catRes.choices[0]?.message?.content?.trim()?.toLowerCase().split(/\s/)[0] || 'general';
          } catch (e) { state.issueType = 'general'; }
          console.log(`--> Issue type: ${state.issueType}`);

          state.step = 'confirm_doc';
        } else {
          // Casual companion reply — FIX P8: pass full history
          replyMsg = await groqReply(
            `You are Veritas — a warm, caring, empathetic friend. Like a loving mother or closest friend.
Respond naturally, warmly and kindly. Comfort if sad, wish back if greeting, answer if general question.
Keep reply short (under 200 words). Plain text only.`,
            incomingMsg, state.history, lang, script);
        }
      }
    }

    // ── CONFIRM DOC ────────────────────────────────
    else if (state.step === 'confirm_doc') {
      console.log('--> State: CONFIRM_DOC');

      if (incomingMsg === '__LOCATION__') {
        // Location shared prematurely — save it and ask for name first
        state.pendingLat = latitude;
        state.pendingLng = longitude;
        replyMsg = await groqReply(
          `You are Veritas. The user shared location before filling out the complaint. 
Thank them and ask for their full name to continue preparing the complaint letter.`,
          '', state.history, lang, script);
        state.step = 'collecting_name';
      } else {
        const yn = await detectYesNo(incomingMsg);
        console.log(`--> Yes/No intent: ${yn}`);

        if (yn === 'yes') {
          state.step = 'collecting_name';
          replyMsg = await groqReply(
            `You are Veritas, a warm helpful legal assistant. The user agreed to prepare a complaint letter.
Warmly thank them and ask for their full name. Keep it friendly and encouraging.`,
            incomingMsg, state.history, lang, script);
        } else if (yn === 'no') {
          state.step = 'confirm_location';
          replyMsg = await groqReply(
            `You are Veritas. The user does not want a complaint letter right now.
Warmly tell them that's okay and ask them to share their location so you can find the nearest legal office or lawyer nearby.
Mention they should tap the attachment icon in WhatsApp and choose Location.`,
            incomingMsg, state.history, lang, script);
        } else {
          // Unclear — ask again gently
          replyMsg = await groqReply(
            `You are Veritas. You asked the user if they want a complaint letter, but their response was unclear.
Gently ask again: would you like me to prepare a formal complaint document? Just say yes or no.`,
            incomingMsg, state.history, lang, script);
        }
      }
    }

    // ── COLLECTING NAME ────────────────────────────
    else if (state.step === 'collecting_name') {
      state.name = incomingMsg;
      state.step = 'collecting_opponent';
      console.log(`--> Name collected: ${state.name}`);
      replyMsg = await groqReply(
        `You are Veritas. You just received the complainant's name: "${state.name}".
Now warmly ask who the complaint is against — person, company, or organization name. Keep it simple and warm.`,
        incomingMsg, state.history, lang, script);
    }

    // ── COLLECTING OPPONENT ────────────────────────
    else if (state.step === 'collecting_opponent') {
      state.opponentName = incomingMsg;
      state.step = 'collecting_details';
      console.log(`--> Opponent collected: ${state.opponentName}`);
      replyMsg = await groqReply(
        `You are Veritas. Complainant is ${state.name}, opponent is ${state.opponentName}.
Now ask them to briefly describe what happened — dates, location, the incident. Tell them to take their time.
Be warm and encouraging — remind them they're doing the right thing by speaking up.`,
        incomingMsg, state.history, lang, script);
    }

    // ── COLLECTING DETAILS ─────────────────────────
    else if (state.step === 'collecting_details') {
      state.details = incomingMsg;
      console.log('--> Details collected. Generating letter...');

      try {
        // Generate the complaint letter
        const letterPath = await generateComplaintLetter(groq, state.issueType, state);
        const publicUrl = `${req.protocol}://${req.get('host')}/pdf/${path.basename(letterPath)}`;
        console.log('--> Letter generated:', publicUrl);

        // Read letter content for in-chat sending (FIX P5)
        const letterText = fs.readFileSync(letterPath, 'utf8');

        // Message 1: warm confirmation + file attachment
        const confirmMsg = await groqReply(
          `You are Veritas. The complaint letter has been generated successfully.
Tell the user warmly that their complaint letter is ready. Tell them it is attached and they can download, print and submit it.
Be encouraging — tell them they are brave for taking this step. Keep under 120 words.`,
          '', state.history, lang, script);
        await sendWhatsAppMessage(fromNumber, confirmMsg, publicUrl);

        // Message 2: send letter text directly in chat (FIX P5)
        await new Promise(r => setTimeout(r, 1500));
        await sendWhatsAppMessage(fromNumber, `📄 Your complaint letter:\n\n${letterText}`);

        // FIX P6: Auto-ask for location immediately after letter
        await new Promise(r => setTimeout(r, 2000));
        const locationAsk = await groqReply(
          `You are Veritas. After sending the complaint letter, now automatically ask the user to share their location 
so you can find the nearest relevant legal office and lawyers nearby. Tell them to tap the attachment icon in WhatsApp and choose Location.
Be warm and encouraging. Under 100 words.`,
          '', state.history, lang, script);
        await sendWhatsAppMessage(fromNumber, locationAsk);

        replyMsg = ''; // already sent everything above
      } catch (e) {
        console.error('--> Letter generation failed:', e.message);
        replyMsg = await groqReply(
          `You are Veritas. There was a technical problem creating the letter. Apologize warmly, briefly summarize what they told you:
Complainant: ${state.name}, Opponent: ${state.opponentName}, Facts: ${state.details}.
Tell them to take this summary to a ${state.issueType === 'wage' ? 'Labour Office' : 'District Legal Services Authority'}.`,
          '', state.history, lang, script);
      }

      state.step = 'confirm_location';
    }

    // ── CONFIRM LOCATION ───────────────────────────
    else if (state.step === 'confirm_location') {
      if (incomingMsg === '__LOCATION__') {
        console.log(`--> Processing location: ${latitude}, ${longitude}`);
        const { office, lawyers } = await findNearestOfficeAndLawyers(latitude, longitude, state.issueType);

        const warmIntro = await groqReply(
          `You are Veritas. You found nearby legal offices for the user. Start with "Here are some places that can help you right away:" Warm, encouraging.`,
          '', state.history, lang, script);

        if (office) {
          const officeMsg = `${warmIntro}\n\n📍 ${office.display_name || office.name}\n📏 ${office.distance} km from you\n🗺 Directions: https://maps.google.com/?q=${office.lat},${office.lon}`;
          await sendWhatsAppMessage(fromNumber, officeMsg);
        } else {
          const noOfficeMsg = await groqReply(
            `You are Veritas. Could not find a specific legal office nearby. Warmly suggest searching Google Maps for "District Legal Services Authority" which provides free legal help.`,
            '', state.history, lang, script);
          await sendWhatsAppMessage(fromNumber, noOfficeMsg);
        }

        if (lawyers.length > 0) {
          await new Promise(r => setTimeout(r, 2000));
          const lawyerIntro = await groqReply(
            `You are Veritas. Introduce a list of nearby lawyers/advocates warmly. One sentence intro only.`,
            '', state.history, lang, script);
          let lawyerMsg = `👨‍⚖️ ${lawyerIntro}\n\n`;
          lawyers.forEach((l, i) => {
            lawyerMsg += `${i + 1}. ${l.display_name || 'Advocate Office'} — ${l.distance} km away\n`;
          });
          await sendWhatsAppMessage(fromNumber, lawyerMsg);
        }

        // FIX P3: Safe reset — preserve language
        state = {
          step: 'chat',
          history: state.history.slice(-4),
          language: lang,
          script: script
        };
        replyMsg = '';

      } else {
        // Text reply — check yes/no or just reassure
        const yn = await detectYesNo(incomingMsg);
        if (yn === 'yes') {
          replyMsg = await groqReply(
            `You are Veritas. The user wants to find nearby legal offices. Ask them to share their location via the WhatsApp attachment icon → Location.`,
            incomingMsg, state.history, lang, script);
        } else if (yn === 'no') {
          // FIX P3: Safe reset
          state = { step: 'chat', history: state.history.slice(-4), language: lang, script: script };
          replyMsg = await groqReply(
            `You are Veritas. The user is done for now. Give a warm, encouraging goodbye. Remind them you are always here whenever they need help. Under 80 words.`,
            incomingMsg, state.history, lang, script);
        } else {
          // Continue conversation naturally without resetting
          replyMsg = await groqReply(
            `You are Veritas. You were waiting for the user to share location to find nearby legal offices. They said something else.
Respond warmly to whatever they said, then gently remind them they can share their location anytime to find help nearby.`,
            incomingMsg, state.history, lang, script);
        }
      }
    }

    // ── FALLBACK: unknown step ─────────────────────
    else {
      console.log(`--> Unknown step "${state.step}", resetting to chat with language preserved`);
      state.step = 'chat';
      const intent = await detectIntent(groq, incomingMsg);
      if (intent === 'legal') {
        const lawsContext = await matchLaws(groq, incomingMsg);
        replyMsg = await getGroqResponse(groq, incomingMsg, lawsContext, lang, script, state.history);
        state.step = 'confirm_doc';
      } else {
        replyMsg = await groqReply(
          `You are Veritas, a warm caring friend. Respond naturally.`,
          incomingMsg, state.history, lang, script);
      }
    }

    // ── Save state ────────────────────────────────
    state.language = state.language || lang;
    state.script = state.script || script;
    if (replyMsg) state.history.push({ role: 'assistant', content: replyMsg });
    if (state.history.length > 14) state.history.splice(0, 2);
    await userRef.set(sanitize(state));
    console.log(`--> Firestore saved. step=${state.step}`);

    // ── Send reply ────────────────────────────────
    if (replyMsg) {
      console.log(`--> Sending reply (${replyMsg.length} chars)...`);
      await sendWhatsAppMessage(fromNumber, replyMsg);

      // Voice reply if original was voice
      if (isVoiceMessage) {
        try {
          const audioPath = await textToSpeech(replyMsg, lang);
          if (audioPath) {
            const audioUrl = `${req.protocol}://${req.get('host')}/pdf/${path.basename(audioPath)}`;
            await new Promise(r => setTimeout(r, 1500));
            await sendWhatsAppMessage(fromNumber, '🔊 Voice reply:', audioUrl);
          }
        } catch (e) { console.error('--> TTS error (non-critical):', e.message); }
      }
    }

    console.log('--> Done.\n');

  } catch (err) {
    console.error('\n--> WEBHOOK ERROR:', err.message);
    console.error(err.stack);
  }
});

app.use('/pdf', express.static(path.join(__dirname, 'tmp')));

// ═══════════════════════════════════════════════════
// POST /chat — Web frontend chat endpoint
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// POST /transcribe — High-accuracy STT via Groq Whisper
// ═══════════════════════════════════════════════════
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file received' });
  const { language } = req.body; // optional hint

  console.log(`--> /transcribe: processing ${req.file.originalname} (hint: ${language || 'none'})`);

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'whisper-large-v3',
      language: language || undefined, // hint language pack if provided
      response_format: 'text'
    });

    console.log('--> /transcribe: success');
    // Cleanup
    fs.unlinkSync(req.file.path);
    return res.json({ text: transcription });
  } catch (err) {
    console.error('--> /transcribe ERROR:', err.message);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ error: 'Transcription failed' });
  }
});

app.post('/chat', async (req, res) => {
  const { message, sessionId, latitude, longitude } = req.body;
  console.log(`\n--> /chat: sessionId=${sessionId}, msg="${(message || '').slice(0, 60)}"`);

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  try {
    const userRef = db.collection('web_sessions').doc(sessionId);
    const snap = await userRef.get();
    let state = snap.exists
      ? snap.data()
      : { step: 'new', history: [], language: null, script: null };

    if (!state.history) state.history = [];
    if (!state.step) state.step = 'new';

    let incomingMsg = (message || '').trim();
    let isLocation = false;
    let lat = null, lng = null;

    if (latitude && longitude) {
      lat = parseFloat(latitude);
      lng = parseFloat(longitude);
      incomingMsg = '__LOCATION__';
      isLocation = true;
    }

    // ── Language detection (same logic as webhook) ──
    const NON_LATIN_LANGS = new Set(['hi', 'mr', 'ml', 'ta', 'te', 'kn', 'gu', 'bn', 'pa']);
    if (incomingMsg && incomingMsg !== '__LOCATION__') {
      const unicodeDetect = detectLangFromText(incomingMsg);
      if (unicodeDetect) {
        state.language = unicodeDetect.language;
        state.script = unicodeDetect.script;
      } else if (!state.language || state.language === 'en') {
        const g = await detectLangViaGroq(incomingMsg);
        state.language = g.language;
        state.script = g.script;
        state.isRomanized = g.isRomanized || false;
      } else if (NON_LATIN_LANGS.has(state.language)) {
        // If it was non-latin and now it's latin script (no unicode matched)
        // Check if it's still the same language just romanized
        const g = await detectLangViaGroq(incomingMsg);
        if (g.language !== state.language) {
          state.language = g.language;
          state.script = g.script;
          state.isRomanized = g.isRomanized || false;
        }
      }
    }
    if (!state.language) { state.language = 'en'; state.script = 'latin'; }
    const lang = state.language;
    const script = state.script;

    if (incomingMsg && incomingMsg !== '__LOCATION__') {
      state.history.push({ role: 'user', content: incomingMsg });
      if (state.history.length > 14) state.history.splice(0, 2);
    }

    let replyMsg = '';
    let officesNearby = null;
    let lawyersNearby = null;
    let letterUrl = null;
    let letterText = null;
    let collectingFor = null;

    // ── Step routing (mirrors webhook) ──
    if (state.step === 'new' || state.step === 'chat') {
      if (isLocation) {
        replyMsg = await groqReply(`You are Veritas. User shared location prematurely. Ask them to describe their problem first.`, '', state.history, lang, script);
      } else {
        const intent = await detectIntent(groq, incomingMsg);
        if (intent === 'legal') {
          const lawsContext = await matchLaws(groq, incomingMsg);
          // Build empathetic legal response with strict structure
          const legalPrompt = `The user has described a legal problem. Relevant laws from our database: ${lawsContext || 'use your comprehensive knowledge of Indian law'}.

YOU MUST FOLLOW THIS EXACT STRUCTURE IN YOUR REPLY:

**Step 1 — Feel with them first (MANDATORY):**
Start with 2-3 deeply empathetic sentences that acknowledge their specific pain. Be warm, personal, and real. Say something like "What you are going through is not okay, and you deserve justice" or similar. Make it specific to their situation — not generic.

**Step 2 — Your Legal Rights (with citations):**
"Here are the laws that protect you:"
List 3-5 specific Indian acts and sections as numbered points. One clear plain-language explanation per law.

**Step 3 — What you should do RIGHT NOW:**
List 4-6 concrete, actionable steps numbered clearly.

**Step 4 — One strong sentence of encouragement.**

Then ask: Would you like me to prepare a formal complaint letter for you? (Answer Yes or No)`;
          replyMsg = await groqReply(legalPrompt, incomingMsg, state.history, lang, script);
          try {
            const catRes = await groq.chat.completions.create({
              messages: [{ role: 'system', content: 'Categorize into ONE word: wage, consumer, cyber, domestic, property, rti, general.' }, { role: 'user', content: incomingMsg }],
              model: 'llama-3.3-70b-versatile'
            });
            state.issueType = catRes.choices[0]?.message?.content?.trim()?.toLowerCase().split(/\s/)[0] || 'general';
          } catch (e) { state.issueType = 'general'; }
          state.step = 'confirm_doc';
        } else {
          replyMsg = await groqReply(`The user is having a casual conversation or sharing feelings — not a legal problem yet. Respond like a warm, caring trusted friend. Listen, acknowledge, show genuine interest. If they seem distressed, gently ask what happened. Under 180 words.`, incomingMsg, state.history, lang, script);
        }
      }
    } else if (state.step === 'confirm_doc') {
      const yn = await detectYesNo(incomingMsg);
      if (yn === 'yes') {
        state.step = 'collecting_name';
        replyMsg = await groqReply(`You are Veritas. User wants a complaint letter. Warmly ask for their full name.`, incomingMsg, state.history, lang, script);
        collectingFor = 'name';
      } else if (yn === 'no') {
        state.step = 'confirm_location';
        replyMsg = await groqReply(`You are Veritas. User does not want a letter right now. Warmly offer to find nearest legal office and ask for location.`, incomingMsg, state.history, lang, script);
      } else {
        replyMsg = await groqReply(`You are Veritas. Ask gently: would you like a formal complaint document? Yes or no.`, incomingMsg, state.history, lang, script);
      }
    } else if (state.step === 'collecting_name') {
      state.name = incomingMsg;
      state.step = 'collecting_opponent';
      replyMsg = await groqReply(`You are Veritas. Complainant name received: "${state.name}". Ask who the complaint is against.`, incomingMsg, state.history, lang, script);
    } else if (state.step === 'collecting_opponent') {
      state.opponentName = incomingMsg;
      state.step = 'collecting_details';
      replyMsg = await groqReply(`You are Veritas. Opponent recorded: "${state.opponentName}". Now ask them to describe what happened, dates, place, incident.`, incomingMsg, state.history, lang, script);
    } else if (state.step === 'collecting_details') {
      state.details = incomingMsg;
      try {
        const lPath = await generateComplaintLetter(groq, state.issueType, state);
        letterUrl = `/pdf/${path.basename(lPath)}`;
        letterText = fs.readFileSync(lPath, 'utf8');
        replyMsg = await groqReply(`You are Veritas. Complaint letter generated. Tell them warmly it is ready. Encourage them. Under 100 words.`, '', state.history, lang, script);
        // Auto-delete letter after 5 minutes
        setTimeout(() => { try { fs.unlinkSync(lPath); } catch (e) { } }, 5 * 60 * 1000);
      } catch (e) {
        console.error('--> /chat letter error:', e.message);
        replyMsg = await groqReply(`You are Veritas. There was a technical issue creating the letter. Apologize warmly and tell them to try again.`, '', state.history, lang, script);
      }
      state.step = 'confirm_location';
    } else if (state.step === 'confirm_location') {
      if (isLocation) {
        const { office, lawyers } = await findNearestOfficeAndLawyers(lat, lng, state.issueType);
        if (office) officesNearby = [office];
        lawyersNearby = lawyers || [];
        const foundCount = (officesNearby?.length || 0) + (lawyersNearby?.length || 0);
        const locationCtx = `Found ${foundCount} nearby legal resources for issue type "${state.issueType || 'general'}" using OpenStreetMap/Nominatim. ${officesNearby?.length ? `Nearest legal office: ${officesNearby[0]?.display_name?.split(',')[0]} (${officesNearby[0]?.distance} km away).` : 'No legal office found very close by.'
          } ${lawyersNearby?.length ? `Found ${lawyersNearby.length} advocate(s) nearby.` : 'No advocates found in immediate vicinity.'
          }
Give a warm 2-sentence intro telling them what was found and that details are shown below. Encourage them to visit. Remind them DLSA (District Legal Services Authority) services are free.`;
        replyMsg = await groqReply(locationCtx, '', state.history, lang, script);
        state = { step: 'chat', history: state.history.slice(-4), language: lang, script: script };
      } else {
        const yn = await detectYesNo(incomingMsg);
        if (yn === 'no') {
          state = { step: 'chat', history: state.history.slice(-4), language: lang, script: script };
          replyMsg = await groqReply(`User has decided not to find help nearby right now. Give a warm, caring farewell. Remind them Veritas is always here whenever they need. Under 80 words.`, incomingMsg, state.history, lang, script);
        } else {
          replyMsg = await groqReply(`User wants to find nearby legal help. Ask them warmly to click the green "Find Help Near Me" button above, or to share their location. Explain we will use their location ONLY to find the nearest government legal office and advocates — it is not stored anywhere. Under 80 words.`, incomingMsg, state.history, lang, script);
        }
      }
    } else {
      state.step = 'chat';
      const lawsContext = await matchLaws(groq, incomingMsg);
      replyMsg = await getGroqResponse(groq, incomingMsg, lawsContext, lang, script, state.history);
    }

    state.language = lang;
    state.script = script;
    if (replyMsg) state.history.push({ role: 'assistant', content: replyMsg });
    if (state.history.length > 14) state.history.splice(0, 2);
    await userRef.set(sanitize(state));

    return res.json({
      reply: replyMsg,
      step: state.step,
      language: lang,
      letterUrl: letterUrl || null,
      letterText: letterText || null,
      officesNearby: officesNearby || null,
      lawyersNearby: lawyersNearby || null,
      collectingFor: collectingFor || null
    });

  } catch (err) {
    console.error('--> /chat ERROR:', err.message);
    return res.status(500).json({ error: 'Internal error', reply: 'Something went wrong. Please try again.' });
  }
});

// ═══════════════════════════════════════════════════
// POST /tts — Text to Speech using node-gtts
// ═══════════════════════════════════════════════════
app.post('/tts', async (req, res) => {
  const { text, language } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  try {
    const filename = await textToSpeech(text, language);
    if (!filename) throw new Error('TTS conversion failed');

    console.log('--> /tts: Audio ready:', filename);
    // Auto-delete after 2 minutes
    const filePath = path.join(tmpDir, filename);
    setTimeout(() => { try { fs.unlinkSync(filePath); } catch (e) { } }, 120000);

    return res.json({ audioUrl: `/pdf/${filename}` });
  } catch (err) {
    console.error('--> /tts ERROR:', err.message);
    return res.json({ audioUrl: null, error: 'TTS unavailable', fallback: true });
  }
});

// ═══════════════════════════════════════════════════
// POST /analyze-image — Evidence photo legal analysis
// ═══════════════════════════════════════════════════
app.post('/analyze-image', async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg', language = 'en' } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });
  console.log('--> /analyze-image: analyzing evidence image...');
  try {
    const result = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          {
            type: 'text', text: `You are a legal evidence analyst. Analyze this image and respond in ${language === 'en' ? 'English' : language}. Provide:
1. EVIDENCE SUMMARY: What evidence does this image contain?
2. APPLICABLE LAWS: Which Indian laws apply (cite specific sections)?
3. EVIDENCE STRENGTH: Rate 0-100 and explain why.
4. HOW TO USE: How should this person present this evidence?
5. WHAT'S MISSING: What additional evidence would strengthen the case?
Be warm, clear, and practical. Under 300 words.` }
        ]
      }],
      max_tokens: 600
    });
    const analysis = result.choices[0]?.message?.content || 'Could not analyze image.';
    console.log('--> /analyze-image: done');
    return res.json({ analysis, strength: extractStrength(analysis) });
  } catch (err) {
    console.error('--> /analyze-image ERROR:', err.message);
    return res.status(500).json({ error: 'Image analysis failed', analysis: 'Could not analyze this image. Please try again.' });
  }
});

function extractStrength(text) {
  const m = text.match(/strength[:\s]+(\d+)/i) || text.match(/(\d+)\s*(?:out of|\/)\s*100/i) || text.match(/rate[:\s]+(\d+)/i);
  return m ? Math.min(100, Math.max(0, parseInt(m[1]))) : 50;
}

// ═══════════════════════════════════════════════════
// POST /analyze-document — Legal document analysis
// ═══════════════════════════════════════════════════
app.post('/analyze-document', async (req, res) => {
  const { text, language = 'en' } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  console.log(`--> /analyze-document: length=${text.length}`);
  try {
    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `You are a compassionate legal document analyst. Analyze documents in plain language. Respond in ${language === 'en' ? 'English' : language}. Format with clear sections.` },
        { role: 'user', content: `Analyze this legal document and explain:\n\n1. PLAIN LANGUAGE SUMMARY (2-3 sentences: what is this document?)\n2. KEY OBLIGATIONS (what must the person do?)\n3. DANGEROUS CLAUSES (list any unfair/illegal clauses with why they are problematic)\n4. RIGHTS PROTECTED (what rights does this document give them?)\n5. RECOMMENDED ACTION (what should they do next?)\n6. OVERALL RISK: rate LOW / MEDIUM / HIGH and explain in one sentence.\n\nDocument:\n${text.slice(0, 4000)}` }
      ],
      max_tokens: 800
    });
    const analysis = result.choices[0]?.message?.content || 'Could not analyze document.';
    console.log('--> /analyze-document: done');
    return res.json({ analysis });
  } catch (err) {
    console.error('--> /analyze-document ERROR:', err.message);
    return res.status(500).json({ error: 'Analysis failed', analysis: 'Could not analyze this document. Please try again.' });
  }
});

// ═══════════════════════════════════════════════════
// POST /generate-letter — Complaint letter generation
// ═══════════════════════════════════════════════════
app.post('/generate-letter', async (req, res) => {
  const { name, opponentName, details, issueType, language = 'en' } = req.body;
  if (!name || !details) return res.status(400).json({ error: 'name and details required' });
  console.log(`--> /generate-letter: issue=${issueType}, lang=${language}`);
  try {
    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `You are a senior Indian advocate drafting formal legal complaint letters. Write in ${language === 'en' ? 'English' : language}. Use proper legal format.` },
        {
          role: 'user', content: `Draft a complete formal complaint letter:
- Complainant: ${name}
- Respondent / Opposite Party: ${opponentName || 'Concerned Authority'}
- Issue Type: ${issueType || 'General'}
- Details: ${details}

Include: Date, To (authority), Subject, Salutation, background, incident details with dates, laws violated (cite specific Indian acts and sections), relief sought, closing. Make it formal, compassionate, and legally strong. End with signature block.` }
      ],
      max_tokens: 1200
    });
    const letter = result.choices[0]?.message?.content || 'Could not generate letter.';
    console.log('--> /generate-letter: done');
    // Save to tmp
    const fname = `letter_${Date.now()}.txt`;
    const fpath = path.join(tmpDir, fname);
    fs.writeFileSync(fpath, letter, 'utf8');
    setTimeout(() => { try { fs.unlinkSync(fpath); } catch (e) { } }, 10 * 60 * 1000);
    return res.json({ letter, letterUrl: `/pdf/${fname}` });
  } catch (err) {
    console.error('--> /generate-letter ERROR:', err.message);
    return res.status(500).json({ error: 'Generation failed' });
  }
});

// ═══════════════════════════════════════════════════
// POST /find-help — Nominatim location search
// ═══════════════════════════════════════════════════
app.post('/find-help', async (req, res) => {
  const { latitude, longitude, issueType = 'general' } = req.body;
  if (!latitude || !longitude) return res.status(400).json({ error: 'latitude and longitude required' });
  console.log(`--> /find-help: lat=${latitude}, lng=${longitude}, issue=${issueType}`);
  try {
    const { office, lawyers } = await findNearestOfficeAndLawyers(latitude, longitude, issueType);
    return res.json({
      office: office || null,
      lawyers: lawyers || [],
      officesNearby: office ? [office] : []
    });
  } catch (err) {
    console.error('--> /find-help ERROR:', err.message);
    return res.status(500).json({ error: 'Location search failed', office: null, lawyers: [] });
  }
});

// ═══════════════════════════════════════════════════
// POST /rti — RTI application generator
// ═══════════════════════════════════════════════════
app.post('/rti', async (req, res) => {
  const { information, department, reason, applicantName = 'Applicant', language = 'en' } = req.body;
  if (!information || !department) return res.status(400).json({ error: 'information and department required' });
  console.log(`--> /rti: dept=${department}`);
  try {
    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `You are an expert RTI (Right to Information Act 2005) specialist. Draft formal RTI applications in ${language === 'en' ? 'English' : language}.` },
        {
          role: 'user', content: `Draft a complete RTI application under the Right to Information Act 2005:
- Applicant: ${applicantName}
- Department: ${department}
- Information Requested: ${information}
- Reason: ${reason || 'Public interest and personal necessity'}

Include:
- Date, proper salutation (To: The Public Information Officer)
- Subject: Application under RTI Act 2005
- Reference to Section 6(1) of RTI Act
- Specific information requested (numbered list)
- Payment reference (₹10 fee statement)
- Deadline reference (30 days per Section 7)
- Prayer for information
- Proper closing and signature block
- Note about First Appellate Authority if denied

Make it legally correct and comprehensive.` }
      ],
      max_tokens: 1000
    });
    const rtiLetter = result.choices[0]?.message?.content || 'Could not generate RTI.';
    console.log('--> /rti: generated');
    return res.json({ rtiLetter });
  } catch (err) {
    console.error('--> /rti ERROR:', err.message);
    return res.status(500).json({ error: 'RTI generation failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌟 Nyay AI running on port ${PORT}`);
  console.log('📂 tmp:', tmpDir);
});
