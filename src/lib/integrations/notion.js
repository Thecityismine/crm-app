// Notion Import Utility
// Uses Notion API to pull data and map to CRM schema

const NOTION_API_BASE = 'https://api.notion.com/v1'

export const fetchNotionDatabase = async (databaseId, notionToken) => {
  const res = await fetch(`${NOTION_API_BASE}/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  })
  return res.json()
}

// Map Notion contact properties to CRM contact schema
export const mapNotionContactToCRM = (notionPage) => {
  const props = notionPage.properties
  return {
    firstName: props['First Name']?.title?.[0]?.plain_text || '',
    lastName: props['Last Name']?.rich_text?.[0]?.plain_text || '',
    email: [props['Email']?.email || ''].filter(Boolean),
    phone: [props['Phone']?.phone_number || ''].filter(Boolean),
    contactType: props['Type']?.select?.name?.toLowerCase() || 'other',
    notes: props['Notes']?.rich_text?.[0]?.plain_text || '',
    tags: props['Tags']?.multi_select?.map((t) => t.name) || [],
    source: 'notion_import',
  }
}

// Map Notion deal properties to CRM deal schema
export const mapNotionDealToCRM = (notionPage) => {
  const props = notionPage.properties
  return {
    name: props['Name']?.title?.[0]?.plain_text || 'Untitled Deal',
    value: props['Value']?.number || 0,
    dealType: props['Type']?.select?.name?.toLowerCase() || 'other',
    notes: props['Notes']?.rich_text?.[0]?.plain_text || '',
    source: 'notion_import',
  }
}
