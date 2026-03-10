const fs = require('fs');
const path = require('path');

async function generateComplaintLetter(groq, type, details) {
  console.log('--> PDF: Generating Groq-written complaint letter for type:', type);

  const { name, opponentName, details: incidentDetails, language, script } = details;
  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const authorityMap = {
    wage: 'The Labour Commissioner, Labour Department',
    consumer: 'The District Consumer Disputes Redressal Commission',
    cyber: 'The Cyber Crime Cell, Police Department',
    domestic: 'The One Stop Centre / Protection Officer',
    property: 'The Civil Court / Revenue Department',
    rti: 'The Public Information Officer (PIO)',
    general: 'The District Legal Services Authority'
  };

  const authorityName = authorityMap[type] || authorityMap.general;
  const langInstruction = (language && language !== 'en')
    ? `Write the entire letter in ${language} language (script: ${script}). Every word must be in that language.`
    : 'Write the letter in formal English.';

  const prompt = `You are a professional legal letter writer in India. Write a complete, formal Indian legal complaint letter.

${langInstruction}

Complainant name: ${name || '[Name]'}
Opponent / Respondent: ${opponentName || '[Opponent Name]'}
Date: ${dateStr}
Authority: ${authorityName}
Issue type: ${type}
Facts of the incident: ${incidentDetails || '[No details provided]'}

Write a COMPLETE letter following this EXACT format:

${name ? name.toUpperCase() : '[COMPLAINANT NAME]'}
[Address of Complainant]
${dateStr}

To,
${authorityName},
[Authority Address]

Subject: [Write a concise relevant subject line based on the issue]

Respected Sir/Madam,

[First paragraph: introduce yourself and state the purpose of the complaint]

[Second paragraph: describe the facts clearly and chronologically]

FACTS OF THE COMPLAINT:
1. [Fact 1]
2. [Fact 2]
3. [Fact 3]
[add more as needed]

LEGAL PROVISIONS VIOLATED:
[List the actual sections of Indian law that apply]

RELIEF SOUGHT:
[What specific action or compensation is being requested]

I hereby declare that the facts stated above are true and correct to the best of my knowledge and belief.

Yours faithfully,
${name ? name.toUpperCase() : '[NAME]'}
Date: ${dateStr}
Signature: _______________________

Do NOT use placeholder text like [X] unless you genuinely don't have the info. Write the actual letter content professionally. Make it sound human, dignified and professional.`;

  try {
    const res = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
    });
    const letterContent = res.choices[0]?.message?.content || '';
    console.log('--> PDF: Groq generated letter successfully.');

    const timestamp = Date.now();
    const filename = `complaint_${timestamp}.txt`;
    const filePath = path.join(__dirname, 'tmp', filename);
    fs.writeFileSync(filePath, letterContent, 'utf8');
    console.log('--> PDF: Letter saved to:', filePath);
    return filePath;
  } catch (err) {
    console.error('--> PDF: Error generating letter:', err.message);
    throw err;
  }
}

module.exports = { generateComplaintLetter };
