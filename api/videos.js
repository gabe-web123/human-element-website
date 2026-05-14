export default async function handler(req, res) {
  const CHANNEL_ID = 'UCm18ZT7uNKxjY8f_9XlgiCA';
  const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

  try {
    const response = await fetch(FEED_URL);
    const xml = await response.text();

    // Parse entries from XML
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];
      const videoId = (entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1];
      const title = (entry.match(/<title>(.*?)<\/title>/) || [])[1];
      const published = (entry.match(/<published>(.*?)<\/published>/) || [])[1];
      const description = (entry.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '';
      const link = (entry.match(/<link rel="alternate" href="(.*?)"/) || [])[1] || '';

      // Skip Shorts — YouTube RSS uses /shorts/ URLs for them
      const isShort = link.includes('/shorts/');
      if (isShort) continue;

      if (videoId && title) {
        entries.push({
          videoId,
          title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
          published,
          description: description.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim(),
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${videoId}`
        });
      }
    }

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ videos: entries });
  } catch (err) {
    console.error('Failed to fetch YouTube feed:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
}
