module.exports = async (req, res) => {
  try {
    const videoId = req.query.id;
    if (!videoId) {
      return res.status(400).json({ error: 'Введіть ID відео' });
    }

    // Список надійних публічних дзеркал
    const instances = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.privacydev.net',
      'https://pipedapi.palvelu.org'
    ];

    let data = null;
    let lastError = null;

    // Пробуємо отримати дані з одного із дзеркал
    for (const instance of instances) {
      try {
        const response = await fetch(`${instance}/streams/${videoId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (response.ok) {
          data = await response.json();
          break;
        }
      } catch (e) {
        lastError = e;
      }
    }

    if (!data) {
      throw new Error(lastError ? lastError.message : 'Усі сервери дзеркал недоступні');
    }

    // Витягуємо рекомендації (relatedStreams)
    const related = (data.relatedStreams || [])
      .filter(item => item.url && item.type === 'stream')
      .slice(0, 5)
      .map(item => {
        // Отримуємо ID відео з URL (/watch?v=ID)
        const idMatch = item.url.match(/v=([^&]+)/);
        const id = idMatch ? idMatch[1] : item.url.replace('/watch?v=', '');
        
        return {
          id: id,
          title: item.title || 'Без назви',
          thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
        };
      });

    // Кешуємо результат на 1 годину
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    return res.status(200).json({
      current: {
        id: videoId,
        title: data.title || 'Відео',
        thumbnail: data.thumbnailUrl
      },
      related: related
    });

  } catch (err) {
    console.error('Помилка API:', err);
    return res.status(500).json({ 
      error: 'Не вдалося отримати рекомендації', 
      details: err.message 
    });
  }
};
