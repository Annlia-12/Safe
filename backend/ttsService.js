const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// ──────────────────────────────────────────────────────
// TTS Service: Convert text to audio using Google TTS
// Sends back audio URL to Twilio for voice replies
// ──────────────────────────────────────────────────────

async function textToSpeech(text, language = 'en') {
  console.log('--> TTS: Converting text to speech. Language:', language, '| Length:', text.length);

  const langMap = { hi: 'hi', en: 'en', ta: 'ta', te: 'te', ml: 'ml', kn: 'kn', gu: 'gu', bn: 'bn', pa: 'pa', mr: 'mr' };
  const ttsLang = langMap[language] || 'en';
  const filename = `tts_${Date.now()}.mp3`;
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, filename);

  // Clear markdown and special chars
  const cleanText = text.replace(/[*_#`~\[\]]/g, '').replace(/\s+/g, ' ').trim();

  // Google TTS limit is 200 chars. For now, we'll take the first 200 to ensure a fast response.
  // In a full implementation, we could concatenate multiple chunks.
  const shortText = cleanText.length > 200 ? cleanText.slice(0, 197) + '...' : cleanText;
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(shortText)}&tl=${ttsLang}&client=tw-ob`;

  return new Promise((resolve) => {
    const file = fs.createWriteStream(filePath);
    https.get(ttsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(filename); });
    }).on('error', () => { resolve(null); });
  });
}

module.exports = { textToSpeech };
