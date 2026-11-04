# 3D-кубики

Модуль VTT с физическими 3D-кубиками d4–d100. Сделан на
[`@3d-dice/dice-box-threejs`](https://github.com/3d-dice/dice-box-threejs)
(Three.js + Cannon ES, MIT). Движок и текстуры лежат локально — интернет
для бросков не нужен.

## Состав

- `dice-box-threejs.umd.js` — собранный движок (включает Three.js и Cannon ES).
- `assets/textures/` — текстуры кубиков.
- `app.js`, `index.html`, `styles.css` — панель: выбор кубика, количество,
  повтор броска, результат и история.
- `LICENSE-dice-box-threejs.txt` — лицензия движка.

## Интеграция с VTT

Модуль не хранит состояние в сессии. После броска он отправляет результат
родительскому окну сообщением `chat`, и тот публикует его в общий чат:

```js
window.parent.postMessage({ __vttExt: 'dice3d', type: 'chat', text }, '*')
```

Так все участники видят результат, а анимация остаётся локальной.
