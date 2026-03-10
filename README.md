# NYAY AI ⚖️
Justice for Every Indian on WhatsApp

NYAY AI is a complete full-stack WhatsApp legal assistant for India.
Users can message a WhatsApp number with any legal problem in any Indian language (or via Voice Note). The AI understands the problem, finds relevant laws from a database, explains their rights simply, generates a ready-to-submit complaint PDF, and finds the nearest legal office using their location.

## Features
*   **Multilingual Script Matching**: Replies in the exact script the user wrote in (Devanagari, Tamil, Telugu, English, Hinglish, etc.)
*   **Voice Notes Support**: Native Whisper V3 transcription for rural/illiterate accessibility.
*   **RAG Legal Database**: Vector matching against Indian laws (BNS, BNSS, Labour, Consumer, POCSO, etc.) using Supabase and HuggingFace sentence-transformers.
*   **Automated PDF Drafting**: Generates formal complaint letters and Police FIR drafts with Unicode font support for all Indian scripts.
*   **Location Tracking**: Finds the nearest relevant legal authority (Labour Commissioner, Consumer Forum, Cyber Cell, DLSA) based on the user's WhatsApp Location pin.
*   **Modern Dashboard**: React + Tailwind dashboard demonstrating the tech and impact.

## Tech Stack
*   **Backend**: Node.js, Express
*   **WhatsApp**: Twilio
*   **AI Models**: Groq (`llama-3.3-70b-versatile`, `whisper-large-v3`)
*   **RAG/Embeddings**: Supabase pgvector, HuggingFace `all-MiniLM-L6-v2`
*   **Frontend**: React, Tailwind CSS, Vite

## Setup Instructions

**1. Clone Repo**
```bash
git clone <repository-url>
cd nyay-ai
```

**2. Backend Setup**
```bash
cd backend
npm install
```

**3. Configure Environment Variables**
Create a `.env` file in the `backend/` directory by copying `.env.example` and filling it with all your keys.
*You will need:*
- Groq API Key
- HuggingFace Inference API Key
- Twilio Account SID, Auth Token, and Sandbox WhatsApp Number
- Supabase URL and Anon Key
- Firebase Service Account details (Project ID, Private Key, Client Email)

*(No credit cards required. Groq, HF, Supabase, Nominatim, and Twilio Sandbox are free.)*

**4. Supabase Setup**
In your Supabase SQL Editor, run the following:
```sql
create extension if not exists vector;

create table law_sections (
  id bigint primary key generated always as identity,
  act_name text,
  section_number text,
  section_title text,
  section_text text,
  keywords text,
  authority text,
  embedding vector(384)
);

create or replace function match_laws(
  query_embedding vector(384),
  match_count int default 5
)
returns table(
  act_name text,
  section_number text,
  section_title text,
  section_text text,
  authority text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    law_sections.act_name,
    law_sections.section_number,
    law_sections.section_title,
    law_sections.section_text,
    law_sections.authority,
    1 - (law_sections.embedding <=> query_embedding) as similarity
  from law_sections
  order by law_sections.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

**5. Seed Legal Database**
Run the seeding script to convert the hardcoded laws to embeddings via HuggingFace and insert them into Supabase.
```bash
node seedLaws.js
```

**6. Start the Backend Server**
```bash
npm run dev
# OR simply
node index.js
```

**7. Setup Webhook Tunnel**
Since Twilio needs a public URL to send messages to your local machine, use ngrok.
```bash
ngrok http 3000
```

**8. Configure Twilio WhatsApp Sandbox**
Paste the ngrok URL into your Twilio Sandbox settings:
`https://<your-ngrok-url>/webhook`

**9. Test**
Message the Twilio Sandbox WhatsApp number from your phone. Send a text like "My boss didn't pay me." or send a Voice Note!

**10. Run the Frontend Dashboard**
Open a new terminal.
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` to see the animated website!
