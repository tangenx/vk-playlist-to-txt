(async () => {
    // SOURCE FROM https://github.com/fivemru/export-vk-playlist-to-file
    const scroll = (top) => window.scrollTo({ top });
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    async function loadFullPlaylist() {
       return;
    }
  
    function parsePlaylist() {
        if (document.querySelectorAll('[data-testid="MusicTrackRow_Info"]').length) {
            return [...document.querySelectorAll('[data-testid="MusicTrackRow_Info"]')].map(
                (row) => {
                  const artist = row.children[0].textContent;
                  const title = row.children[1].textContent;
                  return [artist, title]
                    .map((v) => v.replace(/[\s\n ]+/g, ' ').trim())
                    .join(' - ');
                },
              );
        } else {
             return [...document.querySelectorAll('.audio_row__performer_title')].map(
                (row) => {
                  const artist = row.querySelector('.audio_row__performers').textContent;
                  const title = row.querySelector('._audio_row__title a').textContent;
                  return [artist, title]
                    .map((v) => v.replace(/[\s\n ]+/g, ' ').trim())
                    .join(' - ');
                },
             );
        const userTitle = document.querySelector('.ui_tab.ui_tab_sel');
        return userTitle.textContent.trim();
        }
      
    }
  
    function saveToFile(filename, content) {
      const data = content.replace(/\n/g, '\r\n');
      const blob = new Blob([data], { type: 'text/plain' });
      const link = document.createElement('a');
      link.download = filename;
      link.href = URL.createObjectURL(blob);
      link.target = '_blank';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function getPlaylistTitle() {
        // Плейлист на отдельной странице
        const playlistTitle = document.querySelector('.AudioPlaylistSnippet__title--main');

        if (playlistTitle !== null) {
          return playlistTitle.textContent.trim();
        }

        const userTitle = document.querySelector('.ui_tab.ui_tab_sel');
        return 'Мне нравится';
    }
  
    await loadFullPlaylist();
    const list = parsePlaylist();
    const playlistTitle = getPlaylistTitle();
    saveToFile(`${playlistTitle} (created by github.com_tangenx).txt`, list.join('\n'));
})();
