(async () => {
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const clean = text => (text || '').replace(/\s+/g, ' ').trim();


function parseTracks() {
    const rows = [...document.querySelectorAll('[data-testid="MusicTrackRow_Info"]')];
    const tracks = [];

    for (const row of rows) {
        const links = [...row.querySelectorAll('a[href]')];

        // В найденной разметке информация о треке
        // содержит ссылки на название и исполнителя.
        const values = links
            .map(link => clean(link.innerText || link.textContent))
            .filter(Boolean);

        const uniqueValues = [...new Set(values)];

        if (uniqueValues.length >= 2) {
            tracks.push(`${uniqueValues[1]} - ${uniqueValues[0]}`);
        } else if (uniqueValues.length === 1) {
            tracks.push(uniqueValues[0]);
        }
    }

    return [...new Set(tracks)];
}

function saveToFile(filename, content) {
    const blob = new Blob(['\uFEFF', content], {
        type: 'text/plain;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

console.log('Начинаем сбор музыки VK...');

let previousCount = 0;
let unchanged = 0;

for (let i = 0; i < 150; i++) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await delay(1000);

    const count = document.querySelectorAll(
        '[data-testid="MusicTrackRow_Info"]'
    ).length;

    console.log(`Попытка ${i + 1}: найдено строк ${count}`);

    if (count === previousCount) {
        unchanged++;
    } else {
        unchanged = 0;
    }

    previousCount = count;

    if (unchanged >= 5) break;
}

const tracks = parseTracks();

console.log('Итого треков:', tracks.length);
console.table(tracks);

if (!tracks.length) {
    console.error('Треки не найдены. Проверь разметку MusicTrackRow_Info.');
    return;
}

const filename = 'VK Music.txt';
saveToFile(filename, tracks.join('\n'));

console.log('Файл подготовлен:', filename);

})();