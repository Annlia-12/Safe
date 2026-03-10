require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Include all laws with full text as requested
const laws = [
  // BNS 2023
  { act_name: 'BNS 2023', section_number: '101', section_title: 'Culpable homicide not amounting to murder', section_text: 'Culpable homicide not amounting to murder. Whoever commits culpable homicide not amounting to murder shall be punished...', keywords: 'homicide, death, kill, murder', authority: 'Police Station / Court' },
  { act_name: 'BNS 2023', section_number: '103', section_title: 'Murder', section_text: 'Murder, punishment is death or life imprisonment with fine.', keywords: 'murder, kill, death', authority: 'Police Station / Court' },
  { act_name: 'BNS 2023', section_number: '115', section_title: 'Grievous hurt', section_text: 'Grievous hurt, imprisonment up to 7 years.', keywords: 'hurt, injury, blood, beating, attack', authority: 'Police Station / Court' },
  { act_name: 'BNS 2023', section_number: '64', section_title: 'Rape and sexual assault', section_text: 'Rape and sexual assault, minimum 10 years imprisonment.', keywords: 'rape, sexual assault, violence, non-consensual', authority: 'Police Station / Court' },
  { act_name: 'BNS 2023', section_number: '74', section_title: 'Assault or use of criminal force on woman with intent to outrage modesty', section_text: 'Assault or use of criminal force on woman with intent to outrage modesty.', keywords: 'assault, modesty, molestation, harassement', authority: 'Police Station / Court' },
  { act_name: 'BNS 2023', section_number: '75', section_title: 'Sexual harassment', section_text: 'Sexual harassment at workplace or public place.', keywords: 'sexual harassment, eve teasing, workplace', authority: 'Internal Complaints Committee / Police Station' },
  { act_name: 'BNS 2023', section_number: '79', section_title: 'Voyeurism', section_text: 'Voyeurism, capturing or transmitting private images without consent.', keywords: 'voyeurism, hidden camera, non-consensual images, photos', authority: 'Cyber Crime Cell / Police Station' },
  { act_name: 'BNS 2023', section_number: '80', section_title: 'Stalking', section_text: 'Stalking, following or contacting a woman repeatedly despite disinterest.', keywords: 'stalking, following, cyber stalking, harassment', authority: 'Cyber Crime Cell / Police Station' },
  { act_name: 'BNS 2023', section_number: '318', section_title: 'Cheating', section_text: 'Cheating and dishonestly inducing delivery of property, up to 7 years imprisonment.', keywords: 'cheating, fraud, scammed, money taken', authority: 'Police Station / Court' },
  { act_name: 'BNS 2023', section_number: '303', section_title: 'Theft', section_text: 'Theft, imprisonment up to 3 years.', keywords: 'theft, stolen, robbery', authority: 'Police Station' },
  { act_name: 'BNS 2023', section_number: '308', section_title: 'Extortion', section_text: 'Extortion, imprisonment up to 3 years.', keywords: 'extortion, blackmail, threat', authority: 'Police Station' },
  { act_name: 'BNS 2023', section_number: '310', section_title: 'Dacoity', section_text: 'Dacoity, imprisonment up to 10 years.', keywords: 'dacoity, gang, robbery', authority: 'Police Station' },
  { act_name: 'BNS 2023', section_number: '351', section_title: 'Criminal intimidation', section_text: 'Criminal intimidation, up to 2 years imprisonment.', keywords: 'intimidation, threat, blackmail', authority: 'Police Station' },
  { act_name: 'BNS 2023', section_number: '356', section_title: 'Defamation', section_text: 'Defamation.', keywords: 'defamation, slander, reputation, insult', authority: 'Court' },
  { act_name: 'BNS 2023', section_number: '316', section_title: 'Criminal breach of trust', section_text: 'Criminal breach of trust.', keywords: 'breach of trust, fraud, betrayal', authority: 'Police Station' },

  // BNSS 2023
  { act_name: 'BNSS 2023', section_number: '173', section_title: 'Compulsory FIR registration', section_text: 'Police must compulsorily register FIR for any cognizable offense, cannot refuse, e-FIR is valid, refusal is itself a punishable offense.', keywords: 'FIR, police refuses, online FIR, complaint', authority: 'Police Station' },
  { act_name: 'BNSS 2023', section_number: '175', section_title: 'Magistrate complaint if police refuse', section_text: 'If police refuse FIR complainant can approach magistrate directly with complaint.', keywords: 'magistrate, court, police refusal, direct complaint', authority: 'Judicial Magistrate' },
  { act_name: 'BNSS 2023', section_number: '176', section_title: 'Magistrate order to investigate', section_text: 'Magistrate can order police to investigate.', keywords: 'investigation, magistrate order, police inaction', authority: 'Judicial Magistrate' },
  { act_name: 'BNSS 2023', section_number: '479', section_title: 'Undertrial bail', section_text: 'Undertrial prisoner entitled to bail if they have served half the maximum sentence for that offense.', keywords: 'bail, prison, undertrial, waiting for trial', authority: 'Court' },
  { act_name: 'BNSS 2023', section_number: '530', section_title: 'Zero FIR', section_text: 'Zero FIR can be filed at any police station regardless of jurisdiction, transferred to correct station later.', keywords: 'zero FIR, jurisdiction, anywhere FIR, police', authority: 'Any Police Station' },
  { act_name: 'BNSS 2023', section_number: '43', section_title: 'Rights of arrested person', section_text: 'Rights of arrested person including right to inform family member.', keywords: 'arrested, rights, call family, detention', authority: 'Police Station / Court' },
  { act_name: 'BNSS 2023', section_number: '58', section_title: 'Grounds of arrest', section_text: 'Arrested person must be informed of grounds of arrest immediately.', keywords: 'arrest reasons, why arrested, detention', authority: 'Police Station' },

  // BSA 2023
  { act_name: 'BSA 2023', section_number: '57', section_title: 'Electronic records', section_text: 'Electronic records including WhatsApp chats, emails, screenshots, call recordings are admissible as evidence in court.', keywords: 'evidence, electronic, whatsapp, screenshot, recording', authority: 'Court' },
  { act_name: 'BSA 2023', section_number: '63', section_title: 'Secondary evidence', section_text: 'Secondary evidence rules and admissibility.', keywords: 'secondary evidence, copy, document', authority: 'Court' },
  { act_name: 'BSA 2023', section_number: '23', section_title: 'Admission by party', section_text: 'Admission by party is relevant fact.', keywords: 'admission, confession, relevant fact', authority: 'Court' },

  // Consumer Protection Act 2019
  { act_name: 'Consumer Protection Act 2019', section_number: '2', section_title: 'Definition of consumer', section_text: 'Definition of consumer, deficiency of service, unfair trade practice.', keywords: 'consumer, bad service, unfair trade, deficiency', authority: 'District Consumer Disputes Redressal Commission' },
  { act_name: 'Consumer Protection Act 2019', section_number: '35', section_title: 'District Commission', section_text: 'File complaint at District Consumer Disputes Redressal Commission for claims up to 1 crore.', keywords: 'complaint, district commission, under 1 crore, compensation', authority: 'District Consumer Disputes Redressal Commission' },
  { act_name: 'Consumer Protection Act 2019', section_number: '47', section_title: 'State Commission', section_text: 'State Commission for claims up to 10 crore.', keywords: 'state commission, under 10 crore, consumer case', authority: 'State Consumer Disputes Redressal Commission' },
  { act_name: 'Consumer Protection Act 2019', section_number: '58', section_title: 'National Commission', section_text: 'National Commission for above 10 crore.', keywords: 'national commission, above 10 crore, big consumer case', authority: 'National Consumer Disputes Redressal Commission' },
  { act_name: 'Consumer Protection Act 2019', section_number: '69', section_title: 'Limitation period', section_text: 'Limitation period is 2 years from date cause of action arose.', keywords: 'time limit, 2 years, limitation period, late', authority: 'Consumer Commission' },
  { act_name: 'Consumer Protection Act 2019', section_number: '72', section_title: 'Penalties for non-compliance', section_text: 'Penalties for non-compliance with commission orders including imprisonment.', keywords: 'penalty, ignore order, jail, enforcement', authority: 'Consumer Commission' },

  // Payment of Wages Act 1936
  { act_name: 'Payment of Wages Act 1936', section_number: '3', section_title: 'Employer responsibility', section_text: 'Employer solely responsible for wages on time.', keywords: 'salary, wage, boss, responsible, payment', authority: 'Labour Commissioner Office in your district' },
  { act_name: 'Payment of Wages Act 1936', section_number: '5', section_title: 'Time of payment', section_text: 'Wages must be paid before 7th day after wage period for under 1000 workers, 10th for others.', keywords: 'late salary, 7th day, delay payment, unpaid wages', authority: 'Labour Commissioner Office in your district' },
  { act_name: 'Payment of Wages Act 1936', section_number: '9', section_title: 'Deductions', section_text: 'No deductions without written authorization.', keywords: 'cut salary, deduction, illegal deduction', authority: 'Labour Commissioner Office in your district' },
  { act_name: 'Payment of Wages Act 1936', section_number: '15', section_title: 'Claim before Authority', section_text: 'Worker can file claim before Authority.', keywords: 'file claim, labour complaint, wage complaint', authority: 'Labour Commissioner Office in your district' },
  { act_name: 'Payment of Wages Act 1936', section_number: '17', section_title: 'Compensation', section_text: 'Authority can award up to 10 times the delayed or deducted wages as compensation.', keywords: 'compensation, 10 times, penalty, reward', authority: 'Labour Commissioner Office in your district' },

  // Minimum Wages Act 1948
  { act_name: 'Minimum Wages Act 1948', section_number: '12', section_title: 'Payment of minimum wages', section_text: 'Employer must pay minimum wages fixed by state or central government.', keywords: 'minimum wage, less pay, underpaid', authority: 'Labour Commissioner Office' },
  { act_name: 'Minimum Wages Act 1948', section_number: '20', section_title: 'Complaint before Authority', section_text: 'Worker can file complaint before Authority.', keywords: 'complaint, minimum wage claim, less salary', authority: 'Labour Commissioner Office' },
  { act_name: 'Minimum Wages Act 1948', section_number: '22', section_title: 'Penalties', section_text: 'Imprisonment up to 6 months and fine for employer paying below minimum wage.', keywords: 'employer jail, penalty for less pay', authority: 'Labour Commissioner Office / Court' },

  // RTI Act 2005
  { act_name: 'RTI Act 2005', section_number: '6', section_title: 'Request for information', section_text: 'Submit application to Public Information Officer with Rs.10 fee, BPL applicants exempt.', keywords: 'RTI, information, application, fee, ask government', authority: 'PIO of concerned department' },
  { act_name: 'RTI Act 2005', section_number: '7', section_title: 'Disposal of request', section_text: 'PIO must reply within 30 days, 48 hours for life and liberty matters.', keywords: 'RTI reply, 30 days, time limit, fast reply', authority: 'PIO of concerned department' },
  { act_name: 'RTI Act 2005', section_number: '8', section_title: 'Exemptions', section_text: 'Exemptions from mandatory disclosure.', keywords: 'secret, exemption, cannot tell, refuse information', authority: 'PIO of concerned department' },
  { act_name: 'RTI Act 2005', section_number: '19', section_title: 'First appeal', section_text: 'First appeal to senior officer within 30 days if no reply or unsatisfactory reply.', keywords: 'RTI appeal, no reply, unsatisfied, senior officer', authority: 'First Appellate Authority' },
  { act_name: 'RTI Act 2005', section_number: '20', section_title: 'Penalties', section_text: 'Information Commission can penalize Rs.250 per day up to Rs.25000 for delay.', keywords: 'delay penalty, RTI fine, punishment for not telling', authority: 'Information Commission' },

  // Protection of Women from Domestic Violence Act 2005
  { act_name: 'Domestic Violence Act 2005', section_number: '3', section_title: 'Definition of domestic violence', section_text: 'Domestic violence includes physical, sexual, emotional, verbal, economic abuse and threats.', keywords: 'domestic violence, husband beating, abuse, emotional abuse, threats', authority: 'Protection Officer, Judicial Magistrate, One Stop Centre' },
  { act_name: 'Domestic Violence Act 2005', section_number: '12', section_title: 'Application to Magistrate', section_text: 'Survivor applies for protection order to magistrate through Protection Officer.', keywords: 'protection order, apply, domestic violence case', authority: 'Protection Officer / Magistrate' },
  { act_name: 'Domestic Violence Act 2005', section_number: '17', section_title: 'Right to reside in shared household', section_text: 'Every woman has right to reside in shared household regardless of ownership.', keywords: 'kicked out, home, shared household, residence', authority: 'Court / Magistrate' },
  { act_name: 'Domestic Violence Act 2005', section_number: '18', section_title: 'Protection orders', section_text: 'Protection orders to stop contact.', keywords: 'stop contact, protection order, restraining order', authority: 'Court / Magistrate' },
  { act_name: 'Domestic Violence Act 2005', section_number: '20', section_title: 'Monetary relief', section_text: 'Monetary relief for expenses and losses.', keywords: 'money, expenses, relief, maintenance', authority: 'Court / Magistrate' },
  { act_name: 'Domestic Violence Act 2005', section_number: '22', section_title: 'Compensation orders', section_text: 'Compensation and damages orders.', keywords: 'compensation, damages, injuries, trauma', authority: 'Court / Magistrate' },

  // POCSO Act 2012
  { act_name: 'POCSO Act 2012', section_number: '4', section_title: 'Penetrative sexual assault', section_text: 'Penetrative sexual assault on child, minimum 20 years imprisonment.', keywords: 'child rape, POCSO, penetrative assault, minor', authority: 'Special POCSO Court, nearest Police Station' },
  { act_name: 'POCSO Act 2012', section_number: '8', section_title: 'Sexual assault', section_text: 'Sexual assault on child, minimum 3 years.', keywords: 'child assault, minor touch, inappropriate', authority: 'Special POCSO Court, nearest Police Station' },
  { act_name: 'POCSO Act 2012', section_number: '12', section_title: 'Sexual harassment', section_text: 'Sexual harassment of child.', keywords: 'child harassment, eve teasing minor, inappropriate words', authority: 'Special POCSO Court, nearest Police Station' },
  { act_name: 'POCSO Act 2012', section_number: '19', section_title: 'Mandatory reporting', section_text: 'Any person with knowledge of offense against child MUST report to police, failure to report is itself punishable.', keywords: 'report child abuse, must tell police, hide abuse', authority: 'Special POCSO Court, nearest Police Station' },
  { act_name: 'POCSO Act 2012', section_number: '21', section_title: 'Punishment for non-reporting', section_text: 'Punishment for failure to report.', keywords: 'jail for not reporting, hidden child abuse', authority: 'Court' },

  // IT Act 2000 and Cyber Laws
  { act_name: 'IT Act 2000', section_number: '66', section_title: 'Hacking', section_text: 'Hacking and computer related offenses, 3 years imprisonment.', keywords: 'hacking, computer, cyber attack, access, virus', authority: 'Cyber Crime Cell (cybercrime.gov.in)' },
  { act_name: 'IT Act 2000', section_number: '66C', section_title: 'Identity theft', section_text: 'Identity theft, 3 years and 1 lakh fine.', ব্যাঙ্ক: 'Cyber Crime Cell (cybercrime.gov.in)' },
  { act_name: 'IT Act 2000', section_number: '66D', section_title: 'Cheating by impersonation', section_text: 'Cheating by impersonation using computer, 3 years and 1 lakh fine.', keywords: 'impersonation, fake profile, cheating computer', authority: 'Cyber Crime Cell (cybercrime.gov.in)' },
  { act_name: 'IT Act 2000', section_number: '66E', section_title: 'Violation of privacy', section_text: 'Violation of privacy.', keywords: 'privacy, leak, pictures online', authority: 'Cyber Crime Cell (cybercrime.gov.in)' },
  { act_name: 'IT Act 2000', section_number: '67', section_title: 'Publishing obscene material', section_text: 'Publishing obscene material online.', keywords: 'obscene, pornography, nude photos website, dirty', authority: 'Cyber Crime Cell (cybercrime.gov.in)' },

  // Rent and Tenancy
  { act_name: 'Transfer of Property Act', section_number: '106', section_title: 'Notice period', section_text: 'Notice period for termination of monthly tenancy is 15 days.', keywords: 'eviction notice, 15 days, tenant, landlord, rental', authority: 'Rent Control Court, District Civil Court' },
  { act_name: 'Rent Control Acts', section_number: 'General', section_title: 'Eviction and deposit', section_text: 'Tenant cannot be evicted without court order, security deposit must be returned with interest.', keywords: 'illegal eviction, security deposit, rent control, landlord', authority: 'Rent Control Court, District Civil Court' },

  // NALSA and Free Legal Aid
  { act_name: 'Legal Services Authorities Act 1987', section_number: '12', section_title: 'Free legal aid', section_text: 'Free legal aid for women regardless of income, children, SC and ST, disabled persons, victims of trafficking, persons in custody, income below 1 lakh.', keywords: 'free lawyer, legal aid, poor, women lawyer, free advice', authority: 'District Legal Services Authority DLSA (nalsa.nic.in)' },

  // Labour Laws (Additional)
  { act_name: 'EPF Act', section_number: 'General', section_title: 'PF Deposit', section_text: 'Employer must deposit PF within 15 days, check balance at epfindia.gov.in, complaint to Regional PF Commissioner.', keywords: 'PF, provident fund, EPF, employer not paying pf', authority: 'Regional EPFO Office' },
  { act_name: 'Gratuity Act', section_number: 'General', section_title: 'Gratuity payment', section_text: 'Eligible after 5 years continuous service, must be paid within 30 days of leaving.', keywords: 'gratuity, 5 years, leaving job, unpaid gratuity', authority: 'Labour Commissioner' },
  { act_name: 'POSH Act 2013', section_number: 'General', section_title: 'Internal Complaints Committee', section_text: 'Employer with 10 or more workers must have Internal Complaints Committee, complaint within 3 months of incident.', keywords: 'POSH, workplace harassment, ICC, sexual harassment boss', authority: 'Internal Complaints Committee / Labour Commissioner' },

  // Medical and Insurance
  { act_name: 'Consumer Protection Act 2019', section_number: 'Medical', section_title: 'Medical negligence', section_text: 'Consumer Protection Act covers medical negligence as deficiency of service, file at Consumer Forum.', keywords: 'doctor mistake, medical negligence, hospital fraud', authority: 'District Consumer Forum' },
  { act_name: 'Insurance Ombudsman', section_number: 'General', section_title: 'Insurance claim rejection', section_text: 'Insurance claim rejected - file with IRDAI Ombudsman.', keywords: 'insurance rejected, health insurance, life insurance claim', authority: 'IRDAI Ombudsman (cioins.co.in)' },
  { act_name: 'Banking Ombudsman', section_number: 'General', section_title: 'Bank fraud', section_text: 'Bank fraud or wrong charges - file with Banking Ombudsman through RBI portal, free.', keywords: 'bank fraud, wrong charges, RBI ombudsman', authority: 'Banking Ombudsman (rbi.org.in)' }
];

async function getEmbedding(text) {
  const response = await fetch(
    "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: text })
    }
  );

  if (!response.ok) {
     throw new Error(`Failed to get embedding: ${response.statusText}`);
  }

  const result = await response.json();
  // Depending on HF response, it might be nested
  if (Array.isArray(result) && Array.isArray(result[0])) {
    return result[0];
  }
  return result;
}

async function seedDatabase() {
  console.log('Seeding Database...');
  for (const law of laws) {
    try {
      const textToEmbed = `${law.act_name} Section ${law.section_number}: ${law.section_title}. ${law.section_text}. Keywords: ${law.keywords}`;
      console.log(`Getting embedding for: ${law.act_name} Section ${law.section_number}`);
      const embedding = await getEmbedding(textToEmbed);

      const { data, error } = await supabase
        .from('law_sections')
        .insert({
          act_name: law.act_name,
          section_number: law.section_number,
          section_title: law.section_title,
          section_text: law.section_text,
          keywords: law.keywords,
          authority: law.authority,
          embedding: embedding
        });

      if (error) {
        console.error(`Error inserting ${law.act_name} Section ${law.section_number}:`, error);
      } else {
        console.log(`Inserted ${law.act_name} Section ${law.section_number} successfully.`);
      }
      
      // small delay to respect rate limits on hugging face
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error('Error processing law:', err);
    }
  }
  console.log('Seeding completed.');
}

seedDatabase().catch(console.error);
