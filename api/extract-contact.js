import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = `You are extracting contact information from an image (email signature, business card, screenshot, LinkedIn profile, etc.).

Return ONLY a valid JSON object with exactly these fields. Use an empty string "" for any field you cannot find — never use null or undefined:

{
  "firstName": "",
  "lastName": "",
  "email": "",
  "mobilePhone": "",
  "officePhone": "",
  "company": "",
  "title": "",
  "linkedin": "",
  "website": "",
  "address": "",
  "location": "",
  "university": ""
}

Rules:
- Split full names into firstName and lastName
- location should be "City, State" format if you can infer it
- linkedin should be the full profile URL if present
- website should be the full URL (add https:// if missing)
- phones: prefer mobile if only one number is present
- Return ONLY the JSON object, no explanation or extra text`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, mediaType } = req.body

  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: 'imageBase64 and mediaType are required' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const text = message.content[0]?.text?.trim() ?? ''

    // Strip markdown code fences if Claude wrapped the JSON
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const contact = JSON.parse(jsonText)

    return res.status(200).json(contact)
  } catch (err) {
    console.error('extract-contact error:', err)
    return res.status(500).json({ error: err.message ?? 'Extraction failed' })
  }
}
