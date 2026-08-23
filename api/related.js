module.exports = async (req, res) => {
  try {
    const videoId = req.query.id;
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'YOUTUBE_API_KEY is not configured in environment variables' 
      });
    }

    // 1. Отримуємо деталі активного відео
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
    const videoRes = await fetch(videoUrl);
    const videoData = await videoRes.json();

    if (videoData.error) {
      return res.status(400).json({ error: videoData.error.message });
    }

    let currentTitle = videoId;
    let tags = [];

    if (videoData.items && videoData.items.length > 0) {
      const snippet = videoData.items[0].snippet;
      currentTitle = snippet.title;
      tags = snippet.tags || [];
    }

    // Очищення назви з збереженням кирилиці та всіх літер Unicode (\p{L})
    let cleanTitle = currentTitle
      .replace(/[\(\[\{].*?[\)\]\}]/g, '')  // прибираємо дужки
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')    // залишаємо будь-які букви, цифри та пробіли
      .trim();

    const words = cleanTitle.split(/\s+/).filter(w => w.length > 1);
    let queryKeywords = words.slice(0, 4).join(' ');

    if (!queryKeywords && tags.length > 0) {
      queryKeywords = tags.slice(0, 3).join(' ');
    }

    if (!queryKeywords) {
      queryKeywords = currentTitle;
    }

    // Функція пошуку в YouTube API
    async function searchYouTube(query, filterMedium = true) {
      let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=16&q=${encodeURIComponent(query)}&key=${apiKey}`;
      if (filterMedium) {
        url += '&videoDuration=medium'; // Без Shorts
      }
      const res = await fetch(url);
      return await res.json();
    }

    // 2. Пошук (Спочатку без Shorts)
    let searchData = await searchYouTube(queryKeywords, true);

    // Фолбек 1: Якщо з фільтром Shorts 0 результатів — шукаємо без нього
    if (!searchData.items || searchData.items.length === 0) {
      searchData = await searchYouTube(queryKeywords, false);
    }

    // Фолбек 2: Якщо все одно 0 результатів — шукаємо лише за першими 2 словами
    if (!searchData.items || searchData.items.length === 0) {
      const shortQuery = words.slice(0, 2).join(' ');
      if (shortQuery) {
        searchData = await searchYouTube(shortQuery, false);
      }
    }

    if (searchData.error) {
      return res.status(400).json({ error: searchData.error.message });
    }

    const related = (searchData.items || [])
      .filter(item => item.id && item.id.videoId && item.id.videoId !== videoId)
      .map(item => ({
        id: item.id.videoId,
        title: item.snippet.title || 'Untitled',
        channelTitle: item.snippet.channelTitle || '',
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`
      }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    return res.status(200).json({
      current: {
        id: videoId,
        title: currentTitle,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      },
      related: related
    });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Failed to fetch YouTube data', details: err.message });
  }
};
