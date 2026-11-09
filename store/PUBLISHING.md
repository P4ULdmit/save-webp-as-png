# Публикация в Chrome Web Store

Всё нужное лежит в этой папке:

| Что | Где |
|---|---|
| Архив для загрузки | `dist/save-webp-as-png-1.0.0.zip` (пересобрать: `python pack.py`; тот же файл есть в [релизе на GitHub](https://github.com/P4ULdmit/save-webp-as-png/releases/latest)) |
| Тексты карточки | `store/listing.en.md`, `store/listing.ru.md` |
| Ответы для вкладки Privacy practices | `store/privacy-tab.md` |
| Политика конфиденциальности (EN + RU) | `store/privacy-policy.md` |
| Иконка магазина 128×128 | `icons/icon128.png` |
| Скриншоты 1280×800 | `store/images/screenshot-{1,2}-{en,ru}.png` |
| Малая промо-плитка 440×280 | `store/images/promo-tile-{en,ru}.png` |
| Исходник картинок | `store/src/screens.html` (перерисовать: `bash store/src/render.sh`) |

## Шаги

1. **Проверьте финальную сборку.** Распакуйте ZIP в отдельную папку, загрузите её через
   `chrome://extensions` → «Загрузить распакованное расширение» и сохраните пару WebP.
   Переключите язык Chrome на английский и убедитесь, что пункт меню называется «Save as PNG».
2. **Зарегистрируйтесь как разработчик:** https://chrome.google.com/webstore/devconsole.
   Регистрация разовая и стоит $5. Оплатить и принять соглашение нужно самостоятельно.
   Подтвердите контактный email в разделе Account: без этого публикация не пройдёт.
3. **New item** → загрузите `dist/save-webp-as-png-1.0.0.zip`.
4. **Store listing**:
   - Описание — из `store/listing.en.md`. Category: *Tools*. Language: English.
   - Graphic assets: иконка `icons/icon128.png`, скриншоты `screenshot-1-en.png` и `screenshot-2-en.png`,
     Small promo tile `promo-tile-en.png`.
   - Русская версия карточки: переключите язык карточки на «Русский» (он появится автоматически,
     потому что в пакете есть `_locales/ru`). Вставьте описание из `store/listing.ru.md`
     и загрузите `-ru` скриншоты.
   - Homepage URL: https://github.com/P4ULdmit/save-webp-as-png,
     Support URL: https://github.com/P4ULdmit/save-webp-as-png/issues.
5. **Privacy practices** — заполните по `store/privacy-tab.md`: единственное назначение,
   обоснование каждого разрешения, «No remote code», никаких собираемых данных, три галочки.
   Ссылка на политику конфиденциальности:
   https://github.com/P4ULdmit/save-webp-as-png/blob/main/store/privacy-policy.md
6. **Distribution**: бесплатно (платных расширений в магазине больше нет), Visibility — *Public*,
   регионы — все.
7. **Submit for review.** Из-за доступа ко всем сайтам (`<all_urls>`) проверка обычно подробная
   и может занять от нескольких дней до пары недель. После одобрения расширение публикуется само,
   если вы не сняли галочку автопубликации.

## Обновления

Перед каждой новой загрузкой увеличьте `version` в `manifest.json` (например, `1.0.1`)
и пересоберите архив командой `python pack.py`. Тот же ZIP прикрепите к новому релизу на GitHub:

```bash
gh release create v1.0.1 dist/save-webp-as-png-1.0.1.zip --title "v1.0.1" --notes "…"
```
