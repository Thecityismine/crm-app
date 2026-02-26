// Server-side proxy that fetches a LinkedIn profile page and extracts the og:image.
// LinkedIn blocks direct browser requests but allows server-side fetches with
// a realistic User-Agent. The image URL is returned so the browser can display it.
//
// Usage: GET /api/linkedin-photo?url=https://linkedin.com/in/username

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.query
  if (!url) {
    return res.status(400).json({ error: 'url query param required' })
  }

  // Only allow LinkedIn profile URLs
  if (!/linkedin\.com\/in\//i.test(url)) {
    return res.status(400).json({ error: 'Only linkedin.com/in/ URLs are supported' })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return res.status(404).json({ error: 'Profile page not found' })
    }

    const html = await response.text()

    // Extract og:image meta tag
    const match =
      html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i)

    if (!match) {
      return res.status(404).json({ error: 'No og:image found' })
    }

    const imageUrl = match[1]

    // Filter out generic placeholder images LinkedIn uses when profile has no photo
    if (
      imageUrl.includes('static.licdn.com/sc/h/') ||
      imageUrl.includes('ghosts') ||
      imageUrl.includes('placeholder')
    ) {
      return res.status(404).json({ error: 'No profile photo set' })
    }

    // Cache for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    return res.status(200).json({ url: imageUrl })
  } catch (err) {
    console.error('linkedin-photo error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch profile' })
  }
}
