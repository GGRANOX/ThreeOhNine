# ThreeOhNine — AI Algorithm Visualizer

QAIRU AI Application Development Challenge 2026 (Final Project). Интерактивті веб-қосымша: AI алгоритмдерін қадамдап визуализациялайды, параметрлерін өзгертуге және нәтижелерді салыстыруға мүмкіндік береді. Барлық алгоритмдер **қолмен жазылған**, дайын AI API қолданылмайды.

## Іске асырылған 3 AI тақырыбы (силлабус аптасы)
| Апта | Тақырып | Алгоритмдер | Файл |
|---|---|---|---|
| 2 | Uninformed Search, A*, Heuristics | BFS, DFS, UCS, A* (Manhattan/Euclidean/h=0) | `src/search.js` |
| 3 | Local Search | Hill Climbing + random restarts (N-Queens) | `src/localsearch.js` |
| 4 | Adversarial Search | Minimax, Alpha-Beta (Tic-Tac-Toe) | `src/adversarial.js` |

## Мүмкіндіктер
- **Іздеу:** тор өлшемін таңдау, қабырға/салмақ (5, 9) салу, бастау/аяқтау орнын жылжыту, алгоритм мен эвристиканы таңдау, анимация жылдамдығы, төрт алгоритмді бір кестеде салыстыру (құн, ашылған түйін, уақыт).
- **Hill Climbing:** N (4–30), restarts, seed; қадамдық ойнату және слайдер, конфликттер саны h.
- **Minimax:** адаммен ойнау, AI алгоритмін таңдау, әр жүріс үшін Minimax және Alpha-Beta түйін санын салыстыру.
- Қате енгізуді өңдеу: қабырғадағы бастау, жол жоқ, жарамсыз N, тордан тыс нүкте.

## Іске қосу
Тәуелділіктер жоқ (таза JavaScript, ES modules).
```bash
git clone https://github.com/GGRANOX/ThreeOhNine.git
cd ThreeOhNine
npx serve .        # немесе: python -m http.server 8000
```
Браузерде `http://localhost:3000` (немесе `:8000`) ашыңыз. `index.html`-ді файл ретінде ашу модульдер үшін жұмыс істемейді — сервер қажет.

Live demo: https://threeohnine.vercel.app (дайын күйлер: `/?demo#search`, `#queens`, `#ttt`)

## Тестілеу
Node.js ≥ 20:
```bash
npm test
```
Тесттер (`tests/algorithms.test.js`): BFS/UCS/A* оңтайлылығы, салмақты торда айналма жол, A* ≤ UCS түйін саны, жол жоқ жағдайы, қате енгізулер, Hill Climbing шешімінің дұрыстығы, Alpha-Beta мәні = Minimax және түйін аз, AI ешқашан жеңілмейді, жеңіс жүрісін таңдайды.

Метрикалар: жол құны/ұзындығы, ашылған түйін саны, орындалу уақыты, конфликттер саны, қаралған ойын түйіндері.

## Архитектура
```
index.html, css/style.css, css/fonts.css, fonts/, img/logo.svg
src/search.js        # таза функциялар, UI-дан тәуелсіз
src/localsearch.js
src/adversarial.js
src/main.js          # UI: канвас, табтар, плеер
tests/               # node:test
docs/                # Technical Report, AI Usage Declaration, Team Contribution, слайд жоспары
```
Алгоритм логикасы мен UI бөлек, сондықтан логика браузерсіз тестіленеді.

## Шектеулер
- Іздеу 4 бағытты (диагональсыз) тор. BFS/DFS салмақты ескермейді.
- Hill Climbing жергілікті минимумда тұрып қалуы мүмкін — restarts қолданылады.
- Tic-Tac-Toe кішкентай ойын ағашы, толық Minimax қолданылады (тереңдік шектеуі жоқ).
- Құпия API кілттері жоқ және қажет емес.

## Құжаттама
`docs/technical-report.md` (нақты өлшеулермен, `npm run bench`), `docs/ai-usage-declaration.md`, `docs/team-contribution.md`, `docs/presentation-outline.md`, презентация: `docs/ThreeOhNine-presentation.pptx`.

## Әзірлеушілер
Krasnobrizh Artyom, Orazgali Daulet
