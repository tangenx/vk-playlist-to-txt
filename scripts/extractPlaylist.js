(async () => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const clean = text => (text || '').replace(/\s+/g, ' ').trim();

    // Актуальная разметка VK Music (vk.ru), актуально на 22.10.2026
    const ROW = '[data-testid="MusicTrackRow_Info"]';
    const TITLE = '[data-testid="MusicTrackRow_Title"]';
    const AUTHORS = '[data-testid="MusicTrackRow_Authors"]';

    const MAX_ITERATIONS = 600;   // ~10 минут при паузе 1 с
    const STEP_RATIO = 0.8;       // шаг прокрутки = 80% высоты экрана
    const STEP_RATIO_SLOW = 0.35; // шаг, когда список перестал расти
    const IDLE_BEFORE_WAKE = 3;   // итераций без роста до "оживления" скролла
    const IDLE_GIVE_UP = 12;      // итераций без роста до выхода
    const MAX_STALL_ROUNDS = 10;  // сколько раз подряд можем ждать недостающие треки

    const countRows = () => document.querySelectorAll(ROW).length;

    // Список может лежать не в окне, а во внутреннем скролл-контейнере
    function getScroller() {
        let el = document.querySelector(ROW)?.parentElement;

        while (el && el !== document.body && el !== document.documentElement) {
            const overflowY = getComputedStyle(el).overflowY;
            if (/auto|scroll/.test(overflowY) && el.scrollHeight > el.clientHeight + 10) {
                return el;
            }
            el = el.parentElement;
        }

        return null;
    }

    // Прокручиваем шагами, а не прыжком в конец: VK лениво грузит список
    // только когда скролл доходит до края уже загруженного куска.
    function scrollStep(ratio) {
        const step = Math.max(200, Math.round(window.innerHeight * ratio));
        const scroller = getScroller();

        window.scrollBy(0, step);
        scroller?.scrollBy(0, step);

        // Некоторые загрузчики реагируют только на событие колеса мыши
        const target = scroller ?? document.querySelector(ROW)?.parentElement ?? document;
        target.dispatchEvent(new WheelEvent('wheel', {
            deltaY: step,
            bubbles: true,
            cancelable: true
        }));
    }

    // Застряли: имитируем ручную прокрутку мышью (вверх-вниз) и ждём дольше
    async function wakeUp() {
        const back = Math.max(200, Math.round(window.innerHeight * 0.6));

        window.scrollBy(0, -back);
        await delay(300);
        window.scrollBy(0, back);

        const scroller = getScroller();
        if (scroller) {
            scroller.scrollBy(0, -back);
            await delay(200);
            scroller.scrollBy(0, back);
        }

        await delay(2000);
    }

    // VK пишет в шапке плейлиста "N треков" / "N песен" — сверяемся с этим
    function getExpectedTotal() {
        const head = document.body.innerText.slice(0, 2000);
        const re = /(\d[\d\s ]*)\s*(трек\w*|песен\w*|композици\w*)/gi;
        let max = 0;
        let match;

        while ((match = re.exec(head)) !== null) {
            const value = parseInt(match[1].replace(/[^\d]/g, ''), 10);
            if (value > max) max = value;
        }

        return max || null;
    }

    function parseTracks() {
        const rows = [...document.querySelectorAll(ROW)];
        const tracks = [];

        for (const row of rows) {
            // Название есть и у треков без ссылки на аудио (span, а не a)
            const title = clean(row.querySelector(TITLE)?.innerText);
            if (!title) continue;

            // Исполнителей может быть несколько, каждый — своя ссылка
            const artistEls = [...row.querySelectorAll(AUTHORS)];
            let artists = '';

            if (artistEls.length) {
                let box = artistEls[0];
                for (const el of artistEls) {
                    while (box && !box.contains(el)) box = box.parentElement;
                }
                artists = clean(box.innerText).replace(/\s*,\s*/g, ', ');
            }

            tracks.push(artists ? `${artists} - ${title}` : title);
        }

        // Дубли не выкидываем: один и тот же трек может лежать в плейлисте дважды
        return tracks;
    }

    function getPlaylistTitle() {
        const candidates = [
            '[data-testid="MusicPlaylistPage_Title"]',
            '[data-testid="breadcrumb-current"]',
            '[data-testid="breadcrumb-label"]'
        ];

        for (const selector of candidates) {
            const text = clean(document.querySelector(selector)?.innerText);
            if (text) return text;
        }

        return 'VK Music';
    }

    function saveToFile(filename, content) {
        const data = content.replace(/\n/g, '\r\n');
        const blob = new Blob(['\uFEFF', data], {
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
    let idle = 0;
    let expected = null;
    let stallRounds = 0;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        // Пока список растёт — идём быстро; если встали — медленно, чтобы
        // не улететь за пределы уже загруженного куска
        scrollStep(idle ? STEP_RATIO_SLOW : STEP_RATIO);
        await delay(1000);

        const count = countRows();

        if (count > previousCount) {
            idle = 0;
        } else {
            idle++;
        }

        previousCount = count;

        if (i % 10 === 0) {
            const known = getExpectedTotal();
            if (known) expected = known;
        }

        console.log(
            `Попытка ${i + 1}: строк ${count}` +
            (expected ? ` из ~${expected}` : '') +
            `, позиция ${Math.round(window.scrollY)}` +
            `, высота ${document.documentElement.scrollHeight}` +
            (idle ? `, без изменений ${idle}` : '')
        );

        if (idle >= IDLE_BEFORE_WAKE && idle % IDLE_BEFORE_WAKE === 0) {
            console.log('Загрузка встала, будим скролл...');
            await wakeUp();
        }

        // Выходим, только если список перестал расти и (если известно
        // ожидаемое число треков) мы его уже набрали.
        const enough = !expected || count >= expected;

        if (idle >= IDLE_GIVE_UP && enough) break;

        if (idle >= IDLE_GIVE_UP) {
            stallRounds++;
            console.warn(
                `Набрано ${count} из ~${expected} — жду дальше ` +
                `(${stallRounds}/${MAX_STALL_ROUNDS}). Если не поможет — прокрути ` +
                'список мышью до конца и запусти скрипт заново.'
            );
            if (stallRounds >= MAX_STALL_ROUNDS) break;
            idle = IDLE_BEFORE_WAKE - 1; // ещё попытка после оживления
        }
    }

    const tracks = parseTracks();

    console.log('Итого треков:', tracks.length);
    console.table(tracks);

    if (!tracks.length) {
        console.error('Треки не найдены. Проверь разметку MusicTrackRow_Info.');
        console.error('Доступные data-testid на странице:', [...new Set(
            [...document.querySelectorAll('[data-testid]')].map(el => el.getAttribute('data-testid'))
        )]);
        return;
    }

    const filename = `${getPlaylistTitle().replace(/[\\/:*?"<>|]/g, '_')}.txt`;
    saveToFile(filename, tracks.join('\n'));

    console.log('Файл подготовлен:', filename);

    if (expected && tracks.length < expected) {
        console.warn(
            `Внимание: в шапке плейлиста ~${expected} треков, а собрано ${tracks.length}. ` +
            'Прокрути список мышью до конца и запусти скрипт заново — он дозагрузит остаток.'
        );
    }
})();
