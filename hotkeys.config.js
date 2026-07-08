/**
 * Конфигурация горячих клавиш интерактивной доски.
 * code — физическая клавиша (работает на любой раскладке, включая RU).
 */
(function (global) {
  /** @type {Record<string, { key?: string; keys?: string[]; code?: string; codes?: string[]; ctrl?: boolean; shift?: boolean; drag?: boolean; description?: string }>} */
  global.HOTKEYS_CONFIG = {
    createRectangle: { key: "r", code: "KeyR", description: "Создать прямоугольник" },
    createSpace: { key: "e", code: "KeyE", description: "Создать пространство" },
    createSquare: { key: "f", code: "KeyF", description: "Создать квадрат" },
    undo: { key: "z", code: "KeyZ", ctrl: false, description: "Отменить (также Ctrl+Z)" },
    duplicate: { key: " ", code: "Space", description: "Дублировать выделенный объект" },
    delete: { keys: ["Delete", "Backspace"], codes: ["Delete", "Backspace"], description: "Удалить" },
    copy: { key: "c", code: "KeyC", ctrl: true, description: "Копировать" },
    paste: { key: "v", code: "KeyV", ctrl: true, description: "Вставить" },
    zoomIn: { keys: ["+", "="], codes: ["Equal", "NumpadAdd"], description: "Приблизить" },
    zoomOut: { key: "-", codes: ["Minus", "NumpadSubtract"], description: "Отдалить" },
    zoomReset: { key: "0", code: "Digit0", description: "Масштаб 100%" },
    marqueeSelect: { shift: true, drag: true, description: "Выделение рамкой (Shift + Drag)" },
  };
})(typeof window !== "undefined" ? window : globalThis);
