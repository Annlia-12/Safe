const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Unicode-range-based fast language detection (same logic as index.js)
function detectLangFromText(text) {
    if (/[\u0D00-\u0D7F]/.test(text)) return { language: 'ml', script: 'malayalam' };
    if (/[\u0B80-\u0BFF]/.test(text)) return { language: 'ta', script: 'tamil' };
    if (/[\u0C00-\u0C7F]/.test(text)) return { language: 'te', script: 'telugu' };
    if (/[\u0C80-\u0CFF]/.test(text)) return { language: 'kn', script: 'kannada' };
    if (/[\u0900-\u097F]/.test(text)) return { language: 'hi', script: 'devanagari' };
    if (/[\u0A80-\u0AFF]/.test(text)) return { language: 'gu', script: 'gujarati' };
    if (/[\u0A00-\u0A7F]/.test(text)) return { language: 'pa', script: 'gurmukhi' };
    if (/[\u0980-\u09FF]/.test(text)) return { language: 'bn', script: 'bengali' };
    return { language: 'en', script: 'latin' };
}

async function processAudioMessage(mediaUrl, groqClient) {
    console.log('--> Voice: Starting audio download from Twilio:', mediaUrl);
    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const tempFilePath = path.join(tmpDir, uuidv4() + '.ogg');

    try {
        // Step 1: Download with Twilio basic auth
        console.log('--> Voice: Downloading with Twilio credentials...');
        const response = await axios.get(mediaUrl, {
            auth: {
                username: process.env.TWILIO_ACCOUNT_SID,
                password: process.env.TWILIO_AUTH_TOKEN
            },
            responseType: 'arraybuffer',
            timeout: 15000
        });

        console.log('--> Voice: Download complete. Size:', response.data.byteLength, 'bytes. Saving...');
        fs.writeFileSync(tempFilePath, Buffer.from(response.data));
        console.log('--> Voice: Saved to:', tempFilePath);

        // Step 2: Send to Groq Whisper
        console.log('--> Voice: Sending to Groq Whisper (whisper-large-v3)...');
        const transcription = await groqClient.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: 'whisper-large-v3',
            response_format: 'text'
        });

        console.log('--> Voice: Transcription complete:', transcription);

        // Step 3: Detect language from transcription
        const detectedLang = detectLangFromText(transcription || '');
        console.log('--> Voice: Detected language from transcription:', detectedLang);

        // Step 4: Clean up temp file
        try { fs.unlinkSync(tempFilePath); } catch (e) { /* ignore */ }
        console.log('--> Voice: Temp file deleted.');

        // Return both text and detected language
        return { text: transcription, detectedLang };

    } catch (err) {
        console.error('--> Voice: Error processing audio:', err.message);
        if (err.response) {
            console.error('--> Voice: HTTP status:', err.response.status);
        }
        try { fs.unlinkSync(tempFilePath); } catch (e) { /* ignore */ }
        return null;
    }
}

module.exports = { processAudioMessage };
