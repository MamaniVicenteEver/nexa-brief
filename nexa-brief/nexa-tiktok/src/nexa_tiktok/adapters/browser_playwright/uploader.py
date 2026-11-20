"""TikTok Studio browser uploader with a one-click publication boundary."""

from __future__ import annotations

import asyncio
import os
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from playwright.async_api import BrowserContext, Locator, Page

from nexa_tiktok.adapters.browser_playwright.selectors import (
    CAPTION_INPUTS,
    COMMENT_SETTING_LABELS,
    COMMENT_TOGGLES,
    CONTENT_URL,
    DIALOGS,
    DISCARD_BUTTONS,
    EDITOR_READY,
    FILE_INPUTS,
    KNOWN_MODAL_MARKERS,
    MORE_SETTINGS_BUTTONS,
    PRIVACY_CONTROLS,
    PRIVACY_VALUES,
    PUBLISH_BUTTONS,
    SELECT_VIDEO_BUTTONS,
    STATUS_TEXTS,
    UNKNOWN_MODAL_MARKERS,
    UNSAVED_EDIT_MARKERS,
    UPLOAD_COMPLETE_TEXTS,
    UPLOAD_PROGRESS_TEXTS,
    UPLOAD_URL,
    Candidate,
    first_visible,
    locator_for,
)

MAX_CAPTION_LENGTH = 2200
UPLOAD_TIMEOUT_SECONDS = 240
PUBLISH_TIMEOUT_SECONDS = 90
_HASHTAG_RE = re.compile(r"#[\wáéíóúüñÁÉÍÓÚÜÑ]+", re.UNICODE)
_PUBLICATION_PATH_RE = re.compile(r"/(?:api/)?(?:post|creator|video|item)[^/?]*(?:publish|upload|create|submit)|/api/(?:post|creator|video|item)/", re.I)


class TikTokUploadError(RuntimeError):
    """Upload error with a stable machine-readable code."""

    def __init__(self, message: str, *, code: str, after_publish_click: bool = False) -> None:
        super().__init__(message)
        self.code = code
        self.after_publish_click = after_publish_click


class RequiresReauthError(TikTokUploadError):
    def __init__(self) -> None:
        super().__init__("TikTok redirigió al login; se requiere reautenticación.", code="requires_reauth")


class ManualInterventionRequired(TikTokUploadError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code="challenge_required")


@dataclass
class UploadOutcome:
    post_id: str | None
    url: str | None
    status: str
    published: bool
    dry_run: bool
    publication_endpoint: str | None = None
    draft_discarded: bool | None = None


def build_caption(title: str, description: str, tags: list[str] | None = None) -> str:
    """Combine title, description and hashtags, respecting TikTok's 2200-char cap."""
    title = " ".join((title or "").split())
    description = " ".join((description or "").split())
    parts: list[str] = []
    if title:
        parts.append(title)
    if description and description.casefold() != title.casefold():
        parts.append(description)

    body = " ".join(parts)
    hashtags: list[str] = []
    for tag in tags or []:
        normalized = re.sub(r"[^\wáéíóúüñÁÉÍÓÚÜÑ]", "", str(tag).lstrip("#"), flags=re.UNICODE)
        if normalized:
            hashtag = f"#{normalized}"
            if hashtag.casefold() not in {item.casefold() for item in _HASHTAG_RE.findall(body)}:
                hashtags.append(hashtag)
    suffix = " ".join(hashtags)
    if suffix:
        room = max(0, MAX_CAPTION_LENGTH - len(suffix) - (1 if body else 0))
        body = body[:room].rstrip()
        return f"{body} {suffix}".strip()
    return body[:MAX_CAPTION_LENGTH].rstrip()


def select_visible_status(text: str) -> str:
    """Return TikTok's status wording from a content-row text, preserving its spelling."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines:
        for label in STATUS_TEXTS:
            if re.search(rf"(?<!\w){re.escape(label)}(?!\w)", line, re.IGNORECASE):
                match = re.search(re.escape(label), line, re.IGNORECASE)
                if match:
                    return match.group(0)
    return "desconocido"


def extract_post_id(value: Any) -> str | None:
    """Find a TikTok item identifier in a publication response JSON object."""
    id_keys = {"item_id", "itemid", "item_id_str", "post_id", "postid", "video_id", "videoid", "aweme_id", "awemeid"}
    seen: set[int] = set()

    def walk(node: Any, depth: int = 0) -> str | None:
        if depth > 10 or id(node) in seen:
            return None
        if isinstance(node, dict):
            seen.add(id(node))
            for key, item in node.items():
                if key.lower() in id_keys and isinstance(item, (str, int)):
                    candidate = str(item)
                    if candidate.isdigit() and len(candidate) >= 6:
                        return candidate
            for item in node.values():
                found = walk(item, depth + 1)
                if found:
                    return found
        elif isinstance(node, list):
            seen.add(id(node))
            for item in node[:300]:
                found = walk(item, depth + 1)
                if found:
                    return found
        return None

    return walk(value)


def _secure_shots_dir(shots_dir: Path) -> None:
    shots_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    shots_dir.chmod(0o700)


async def _screenshot(page: Page, path: Path, *, challenge: bool = False) -> None:
    # Never capture sensitive form values or verification screens.
    try:
        masks = [page.locator("body")] if challenge else [page.locator(
            'input:not([type=checkbox]):not([type=radio]), textarea, [autocomplete="current-password"], [data-e2e*="token"], [data-e2e*="cookie"]'
        )]
        await page.screenshot(path=str(path), mask=masks, timeout=5000)
        path.chmod(0o600)
    except Exception:
        pass


async def _requires_full_mask(page: Page) -> bool:
    try:
        if "/login" in page.url.casefold():
            return True
        await _detect_manual_intervention(page)
    except Exception:
        return True
    return False


async def capture_step(page: Page, shots_dir: Path, number: int, label: str) -> Path:
    _secure_shots_dir(shots_dir)
    path = shots_dir / f"{number:02d}-{label}.png"
    await _screenshot(page, path, challenge=await _requires_full_mask(page))
    return path


async def capture_failure(page: Page, shots_dir: Path, error: Exception, *, after_publish_click: bool) -> Path:
    _secure_shots_dir(shots_dir)
    challenge = getattr(error, "code", "") in {"challenge_required", "requires_reauth"}
    await _screenshot(page, shots_dir / "failure.png", challenge=challenge or await _requires_full_mask(page))
    return shots_dir / "failure.txt"


async def _human_pause() -> None:
    await asyncio.sleep(random.uniform(0.8, 3.0))


async def _move_and_click(page: Page, locator: Locator, *, scroll_timeout: int = 3_000) -> None:
    await locator.scroll_into_view_if_needed(timeout=scroll_timeout)
    box = await locator.bounding_box()
    if not box:
        raise TikTokUploadError("No se pudo localizar el control visible para pulsarlo.", code="control_position_unavailable")
    x = box["x"] + box["width"] * random.uniform(0.35, 0.65)
    y = box["y"] + box["height"] * random.uniform(0.35, 0.65)
    await page.mouse.move(x, y, steps=random.randint(10, 22))
    await asyncio.sleep(random.uniform(0.2, 0.6))
    await page.mouse.click(x, y)


async def _type_human(page: Page, text: str) -> None:
    # Studio can restore an old caret position after an editor rerender.
    # Put it back at the end before each keystroke and allow rerenders to settle.
    for character in text:
        await page.keyboard.press("Control+End")
        await page.keyboard.type(character, delay=random.randint(40, 110))
        await asyncio.sleep(0.15)


async def _page_text(page: Page) -> str:
    try:
        return await page.locator("body").inner_text(timeout=2_000)
    except Exception:
        return ""


async def _detect_manual_intervention_once(page: Page, text: str | None = None) -> None:
    if "/login" in page.url.casefold():
        raise RequiresReauthError()
    body = (text if text is not None else await _page_text(page)).casefold()
    if any(marker in body for marker in UNKNOWN_MODAL_MARKERS):
        raise ManualInterventionRequired("TikTok mostró una verificación/captcha; se detuvo sin resolverla.")
    if any(marker in page.url.casefold() for marker in ("captcha", "verify", "verification")):
        raise ManualInterventionRequired("TikTok mostró una página de verificación; se detuvo sin resolverla.")
    try:
        frames = await page.locator("iframe").evaluate_all(
            "els => els.map(el => (el.title || '') + ' ' + (el.src || '')).join(' ').toLowerCase()"
        )
        if any(token in frames for token in ("captcha", "challenge", "verification", "verify")):
            raise ManualInterventionRequired("TikTok mostró un iframe de verificación; se detuvo sin resolverlo.")
    except ManualInterventionRequired:
        raise
    except Exception:
        pass


async def _detect_manual_intervention(page: Page, text: str | None = None) -> None:
    """Recheck the current page twice; never replay a click or submit an operation."""
    for attempt in range(3):
        try:
            await _detect_manual_intervention_once(page, text if attempt == 0 else None)
            return
        except (ManualInterventionRequired, RequiresReauthError):
            if attempt == 2 or getattr(page, '_nexa_publish_clicked', False):
                raise
            await asyncio.sleep(0.5)


async def _is_visible_text(page: Page, texts: tuple[str, ...]) -> bool:
    for text in texts:
        try:
            if await page.get_by_text(text, exact=False).first.is_visible(timeout=100):
                return True
        except Exception:
            continue
    return False


async def _wait_for_editor(page: Page, timeout_seconds: int = UPLOAD_TIMEOUT_SECONDS) -> None:
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while asyncio.get_running_loop().time() < deadline:
        await _detect_manual_intervention(page)
        editor = await first_visible(page, EDITOR_READY, timeout_ms=200)
        if editor:
            progress_visible = await _is_visible_text(page, UPLOAD_PROGRESS_TEXTS)
            complete_visible = await _is_visible_text(page, UPLOAD_COMPLETE_TEXTS)
            if not progress_visible and (complete_visible or await editor.is_visible(timeout=100)):
                return
        await asyncio.sleep(1.2)
    raise TikTokUploadError("TikTok no terminó la carga ni mostró el editor dentro del tiempo esperado.", code="editor_timeout")


async def _wait_for_file_control(page: Page, timeout_seconds: int = 60) -> Locator | None:
    """Wait for TikTok Studio's upload screen to finish hydrating."""
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while asyncio.get_running_loop().time() < deadline:
        await _detect_manual_intervention(page)
        file_input = locator_for(page, FILE_INPUTS[0]).first
        if await file_input.count() > 0:
            return file_input
        button = await first_visible(page, SELECT_VIDEO_BUTTONS, timeout_ms=200)
        if button is not None:
            return None
        await asyncio.sleep(1.0)
    return None


async def _dismiss_unsaved_edit_prompt(page: Page, shots_dir: Path, step: int) -> None:
    """Discard a previous incomplete upload when TikTok offers its explicit discard control."""
    deadline = asyncio.get_running_loop().time() + 20
    while asyncio.get_running_loop().time() < deadline:
        body = await _page_text(page)
        marker_seen = any(marker.casefold() in body.casefold() for marker in UNSAVED_EDIT_MARKERS)
        if marker_seen:
            await capture_step(page, shots_dir, step, "borrador-previo-sin-guardar")
            discard = await first_visible(page, DISCARD_BUTTONS, timeout_ms=500)
            if discard is None:
                raise TikTokUploadError("TikTok ofreció continuar un borrador previo, pero no apareció Descartar.", code="draft_cleanup_failed")
            await _move_and_click(page, discard)
            await _human_pause()
            dialog, dialog_text = await _visible_dialog_text(page)
            if dialog is not None:
                if "descartar esta publicación" not in dialog_text.casefold() and "discard this post" not in dialog_text.casefold():
                    raise TikTokUploadError("La confirmación del borrador no coincide con el descarte esperado.", code="draft_cleanup_failed")
                confirm = await _dialog_discard_button(dialog)
                if confirm is None:
                    raise TikTokUploadError("La confirmación no ofreció un botón Descartar reconocible.", code="draft_cleanup_failed")
                await capture_step(page, shots_dir, step + 1, "confirmar-descarte-borrador")
                await _move_and_click(page, confirm)
                await _human_pause()
            remaining = await _page_text(page)
            if any(marker.casefold() in remaining.casefold() for marker in UNSAVED_EDIT_MARKERS):
                raise TikTokUploadError("TikTok mantuvo el aviso del borrador previo después de descartarlo.", code="draft_cleanup_failed")
            return
        file_input = locator_for(page, FILE_INPUTS[0]).first
        if await file_input.count() > 0 or await first_visible(page, SELECT_VIDEO_BUTTONS, timeout_ms=150):
            return
        await asyncio.sleep(1.0)


async def _enter_caption(page: Page, caption: str) -> Locator:
    if len(caption) > MAX_CAPTION_LENGTH:
        raise TikTokUploadError("La descripción excede el límite de 2200 caracteres.", code="caption_too_long")
    locator = await first_visible(page, CAPTION_INPUTS, timeout_ms=500)
    if locator is None:
        raise TikTokUploadError("No se encontró el campo de descripción en el editor.", code="caption_input_missing")
    await _move_and_click(page, locator)
    await locator.focus()
    focused = await locator.evaluate("element => element === document.activeElement || element.contains(document.activeElement)")
    if not focused:
        raise TikTokUploadError("El campo de descripción no recibió el foco; se detuvo antes de continuar.", code="caption_focus_failed")
    for attempt in range(3):
        await locator.focus()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        await _wait_caption_state(locator, "", require_counter=False)
        await _type_human(page, caption)
        try:
            await _wait_caption_state(locator, caption, require_counter=True)
            return locator
        except TikTokUploadError as exc:
            if exc.code != "caption_mismatch" or attempt == 2:
                raise
    raise AssertionError("unreachable")


async def _wait_caption_state(locator: Locator, expected: str, *, require_counter: bool) -> None:
    """Wait for the editor and its nearby character counter to agree."""
    expected_count = len(expected.encode("utf-16-le")) // 2
    deadline = asyncio.get_running_loop().time() + 10
    while asyncio.get_running_loop().time() < deadline:
        state = await locator.evaluate("""element => {
            let node = element;
            let counters = [];
            while (node && !counters.length && node !== document.body) {
                counters = Array.from(node.querySelectorAll('*')).filter(e =>
                    /^\\s*\\d+\\s*\\/\\s*\\d+\\s*$/.test(e.textContent || '')
                ).map(e => e.textContent.trim());
                node = node.parentElement;
            }
            return {text: element.innerText, counters};
        }""", timeout=3000)
        text_matches = " ".join(state["text"].split()) == " ".join(expected.split())
        count_matches = any(int(re.match(r"\s*(\d+)", value).group(1)) == expected_count
                            for value in state["counters"])
        if text_matches and (not require_counter or count_matches):
            return
        await asyncio.sleep(0.25)
    if not expected:
        raise TikTokUploadError("No se pudo confirmar que la descripción anterior se haya borrado.", code="caption_clear_failed")
    raise TikTokUploadError("La descripción escrita o su contador no coincide con el texto previsto.", code="caption_mismatch")


async def _set_privacy(page: Page, privacy: str) -> str:
    privacy = privacy.casefold()
    if privacy not in PRIVACY_VALUES:
        raise TikTokUploadError("Privacidad no admitida.", code="invalid_privacy")
    control = await first_visible(page, PRIVACY_CONTROLS)
    if control is None:
        raise TikTokUploadError("No se encontró el control de visibilidad de la publicación.", code="privacy_control_missing")
    await _move_and_click(page, control)
    await _human_pause()
    chosen: str | None = None
    for label in PRIVACY_VALUES[privacy]:
        candidates = (
            Candidate("role", label, role="option", exact=True),
            Candidate("role", label, role="menuitem", exact=True),
            Candidate("role", label, role="radio", exact=True),
            Candidate("role", label, role="button", exact=True),
            Candidate("text", label, exact=True),
        )
        control_element = await control.element_handle()
        for candidate in candidates:
            matches = locator_for(page, candidate)
            for index in range(min(await matches.count(), 20)):
                option = matches.nth(index)
                if not await option.is_visible() or await option.evaluate(
                    '(e, control) => e === control || control.contains(e)', control_element
                ):
                    continue
                # Resolve the container before selection and re-query it afterwards.
                menu_info = await option.evaluate("""e => {
                    const menu = e.closest('[role="listbox"], [role="menu"], [role="radiogroup"]');
                    if (menu) return {role: menu.getAttribute('role')};
                    const parent = e.parentElement;
                    if (!parent || parent === document.body || parent === document.documentElement) return null;
                    const marker = `privacy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                    parent.setAttribute('data-nexa-privacy-menu', marker);
                    return {marker};
                }""")
                if not menu_info:
                    raise TikTokUploadError("No se pudo identificar el menú de visibilidad; se detuvo.", code="privacy_selection_unconfirmed")
                if "role" in menu_info:
                    menu = page.locator(f'[role="{menu_info["role"]}"]')
                else:
                    menu = page.locator(f'[data-nexa-privacy-menu="{menu_info["marker"]}"]')
                await _move_and_click(page, option, scroll_timeout=15_000)
                chosen = label
                break
            if chosen:
                break
        if chosen:
            break
    if chosen is None:
        body = await _page_text(page)
        if privacy == "public" and re.search(r"Seguidores[\s\S]{0,220}Amigos[\s\S]{0,220}Solo tú", body, re.IGNORECASE):
            raise TikTokUploadError(
                "TikTok solo ofrece Seguidores, Amigos y Solo tú; la cuenta parece privada. No se cambió la privacidad global.",
                code="public_visibility_unavailable",
            )
        raise TikTokUploadError("TikTok abrió el menú de visibilidad, pero no apareció una opción reconocida.", code="privacy_option_missing")
    # A fresh locator observes the current menu even if its options were replaced.
    async def menu_visible() -> bool:
        count = await menu.count()
        if not count and "marker" in menu_info:
            # An unidentifiable replacement of the fallback container is ambiguous.
            raise TikTokUploadError("No se pudo confirmar el cierre del menú de visibilidad; se detuvo.", code="privacy_selection_unconfirmed")
        return any([await menu.nth(index).is_visible() for index in range(count)])

    if await menu_visible():
        await page.keyboard.press("Escape")
    deadline = asyncio.get_running_loop().time() + 5
    while await menu_visible():
        if asyncio.get_running_loop().time() >= deadline:
            raise TikTokUploadError("TikTok no cerró el menú de visibilidad; se detuvo.", code="privacy_selection_unconfirmed")
        await asyncio.sleep(0.1)
    deadline = asyncio.get_running_loop().time() + 5
    while asyncio.get_running_loop().time() < deadline:
        current = await first_visible(page, PRIVACY_CONTROLS, timeout_ms=250)
        if (current and " ".join((await current.inner_text(timeout=1000)).split()).casefold() == chosen.casefold()
                and not await menu_visible()):
            return chosen
        await asyncio.sleep(0.1)
    raise TikTokUploadError("TikTok no confirmó la visibilidad seleccionada; se detuvo.", code="privacy_selection_unconfirmed")


async def _set_comments_enabled(page: Page) -> bool:
    toggle = await first_visible(page, COMMENT_TOGGLES)
    if toggle is None:
        body = await _page_text(page)
        if not any(label.casefold() in body.casefold() for label in COMMENT_SETTING_LABELS):
            raise TikTokUploadError("No se pudo confirmar el ajuste de comentarios.", code="comments_setting_missing")
        raise TikTokUploadError("TikTok muestra los comentarios, pero no se encontró un control verificable.", code="comments_control_missing")
    checked: bool | None = None
    try:
        value = await toggle.get_attribute("aria-checked")
        if value is not None:
            checked = value.casefold() == "true"
        else:
            checked = await toggle.is_checked()
    except Exception:
        pass
    if checked is False:
        await _move_and_click(page, toggle)
        await _human_pause()
        value = await toggle.get_attribute("aria-checked")
        if value is not None:
            checked = value.casefold() == "true"
        else:
            checked = await toggle.is_checked()
    if checked is not True:
        raise TikTokUploadError("No se pudo verificar que los comentarios estén activados.", code="comments_unconfirmed")
    return True


async def _expand_settings_for_comments(page: Page) -> bool:
    if await first_visible(page, COMMENT_TOGGLES):
        return False
    more = await first_visible(page, MORE_SETTINGS_BUTTONS)
    if more is None:
        return False
    await _move_and_click(page, more)
    await _human_pause()
    return True


async def _ensure_no_dialog(page: Page, stage: str) -> None:
    dialog, text = await _visible_dialog_text(page)
    if dialog is None:
        return
    await _detect_manual_intervention(page, text)
    raise TikTokUploadError(f"TikTok mostró un modal no reconocido durante {stage}; se detuvo.", code="unknown_modal")


async def _visible_dialog_text(page: Page) -> tuple[Locator | None, str]:
    dialog = await first_visible(page, DIALOGS, timeout_ms=150)
    if dialog is None:
        return None, ""
    try:
        return dialog, await dialog.inner_text(timeout=1_000)
    except Exception:
        return dialog, ""


async def _dialog_button(dialog: Locator, names: tuple[str, ...]) -> Locator | None:
    for name in names:
        button = dialog.get_by_role("button", name=name, exact=True).first
        try:
            if await button.is_visible(timeout=250):
                return button
        except Exception:
            continue
    return None


async def _dialog_discard_button(dialog: Locator) -> Locator | None:
    return await _dialog_button(dialog, ("Descartar", "Discard", "Descartar cambios", "Discard changes"))


async def _handle_known_modals(page: Page, shots_dir: Path, start_number: int) -> int:
    current_number = start_number
    for _ in range(3):
        await asyncio.sleep(0.8)
        dialog, text = await _visible_dialog_text(page)
        if dialog is None:
            return current_number
        await _detect_manual_intervention(page, text)
        lowered = text.casefold()
        if not any(marker in lowered for marker in KNOWN_MODAL_MARKERS):
            raise TikTokUploadError("TikTok abrió un modal no reconocido después de publicar; se detuvo.", code="unknown_modal", after_publish_click=True)
        button = await _dialog_button(
            dialog,
            (
                "Publicar ahora",
                "Publicar",
                "Post now",
                "Publish now",
                "Continuar publicando",
                "Continuar",
                "Continue posting",
                "Continue",
            ),
        )
        if button is None:
            raise TikTokUploadError("La comprobación conocida no ofreció un botón de continuación reconocible.", code="unknown_modal", after_publish_click=True)
        await capture_step(page, shots_dir, current_number, "modal-comprobacion-contenido")
        current_number += 1
        await _move_and_click(page, button)
        await _human_pause()
    dialog, _ = await _visible_dialog_text(page)
    if dialog is not None:
        raise TikTokUploadError("TikTok mantuvo un modal después de las opciones conocidas.", code="unknown_modal", after_publish_click=True)
    return current_number


async def _dismiss_pre_publish_prompts(page: Page, shots_dir: Path, start_number: int) -> int:
    """Dismiss only TikTok's known optional content-review settings prompt."""
    dialog, text = await _visible_dialog_text(page)
    if dialog is None:
        return start_number
    lowered = text.casefold()
    if "activar las revisiones automáticas de contenido" not in lowered and "automatic content checks" not in lowered:
        await _detect_manual_intervention(page, text)
        raise TikTokUploadError("TikTok mostró un modal no reconocido antes de completar la publicación.", code="unknown_modal")
    await capture_step(page, shots_dir, start_number, "modal-revisiones-opcionales")
    cancel = await _dialog_button(dialog, ("Cancelar", "Cancel"))
    if cancel is None:
        raise TikTokUploadError("El modal de revisiones opcionales no ofreció un botón Cancelar reconocible.", code="unknown_modal")
    await _move_and_click(page, cancel)
    await _human_pause()
    if await first_visible(page, DIALOGS, timeout_ms=250):
        raise TikTokUploadError("TikTok mantuvo abierto el modal de revisiones opcionales.", code="unknown_modal")
    return start_number + 1


async def _capture_publication_response(
    page: Page,
) -> tuple[asyncio.Event, dict[str, str | None], Any]:
    event = asyncio.Event()
    result: dict[str, str | None] = {"post_id": None, "endpoint": None}

    async def on_response(response: Any) -> None:
        try:
            parts = urlsplit(response.url)
            if parts.hostname not in {"www.tiktok.com", "tiktok.com"}:
                return
            if response.request.method.upper() != "POST" or not _PUBLICATION_PATH_RE.search(parts.path):
                return
            endpoint = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
            result["endpoint"] = endpoint
            try:
                payload = await response.json()
            except Exception:
                payload = None
            result["post_id"] = extract_post_id(payload)
            event.set()
        except Exception:
            return

    page.on("response", on_response)
    return event, result, on_response


async def _find_content_row(page: Page, caption: str) -> tuple[str, str | None, str | None]:
    """Find a content row by a unique caption fragment and return row text, ID and status."""
    caption_fragment = " ".join(caption.split())[:48]
    try:
        data = await page.evaluate(
            """caption => {
              const norm = value => (value || '').replace(/\\s+/g, ' ').trim();
              const nodes = [...document.querySelectorAll('tr,[role="row"],li,[class*="ContentItem"],[class*="content-item"],[class*="video-item"]')];
              let row = nodes.find(node => norm(node.innerText).includes(caption));
              if (!row) {
                const matches = [...document.querySelectorAll('a,span,div,p')]
                  .filter(node => node.children.length < 4 && norm(node.innerText).includes(caption))
                  .sort((a,b) => norm(a.innerText).length - norm(b.innerText).length);
                row = matches[0] || null;
                for (let i = 0; row && i < 5 && row.parentElement; i++) {
                  const parent = row.parentElement;
                  if (norm(parent.innerText).length > 900) break;
                  row = parent;
                }
              }
              if (!row) return null;
              const text = norm(row.innerText);
              const links = [...row.querySelectorAll('a[href]')].map(a => a.href);
              return {text, links};
            }""",
            caption_fragment,
        )
    except Exception:
        data = None
    if not data:
        return "", None, None
    row_text = str(data.get("text") or "")
    post_id = None
    for href in data.get("links", []):
        match = re.search(r"/(?:video|photo)/(\d+)", str(href))
        if match:
            post_id = match.group(1)
            break
    return row_text, post_id, select_visible_status(row_text)


async def _inspect_content(page: Page, caption: str, response_id: str | None, *, username: str) -> UploadOutcome:
    response = await page.goto(CONTENT_URL, wait_until="domcontentloaded", timeout=45_000)
    del response
    if "/login" in page.url.casefold():
        raise TikTokUploadError("TikTok redirigió al login al verificar la publicación.", code="publish_unknown", after_publish_click=True)
    try:
        await page.wait_for_load_state("networkidle", timeout=8_000)
    except Exception:
        pass
    row_text = ""
    row_id: str | None = None
    status = "desconocido"
    for _ in range(15):
        row_text, row_id, status = await _find_content_row(page, caption)
        if row_text:
            break
        await asyncio.sleep(2)
    # A matching caption can belong to an older video. Only the publication
    # response identifies this attempt sufficiently to allow a first comment.
    post_id = response_id
    if row_id and response_id and row_id != response_id:
        status = 'desconocido'
    url = f"https://www.tiktok.com/@{username}/video/{post_id}" if post_id else None
    return UploadOutcome(
        post_id=post_id,
        url=url,
        status=status,
        published=bool(post_id and status.casefold() in {"publicado", "publicada", "published", "posted"}),
        dry_run=False,
    )


async def _discard_draft(page: Page, shots_dir: Path, number: int) -> bool:
    await capture_step(page, shots_dir, number, "dry-run-antes-de-descartar")
    button = await first_visible(page, DISCARD_BUTTONS, timeout_ms=500)
    if button is None:
        # Closing the work page does not submit the post; record if Studio has no discard control.
        return False
    await _move_and_click(page, button)
    await _human_pause()
    dialog, text = await _visible_dialog_text(page)
    if dialog is not None:
        lowered = text.casefold()
        if not any(marker in lowered for marker in ("descartar", "discard", "borrador", "draft", "cambios", "changes")):
            raise TikTokUploadError("El modal de descarte no fue reconocido; no se confirmó.", code="discard_dialog_unknown")
        confirm = await _dialog_discard_button(dialog)
        if confirm is None:
            raise TikTokUploadError("TikTok pidió confirmar el descarte con un control no reconocido.", code="discard_confirmation_missing")
        await capture_step(page, shots_dir, number + 1, "confirmacion-descarte")
        await _move_and_click(page, confirm)
        await _human_pause()
    await capture_step(page, shots_dir, number + 2, "borrador-descartado")
    return True


async def upload_video(
    context: BrowserContext,
    video_path: Path,
    caption: str,
    *,
    privacy: str,
    dry_run: bool,
    shots_dir: Path,
    before_click,
    username: str,
) -> UploadOutcome:
    """Upload one video, optionally stopping before the single publish click."""
    video_path = Path(video_path)
    if not video_path.is_file():
        raise TikTokUploadError("No existe el archivo de video.", code="video_missing")
    caption = caption.strip()
    if not caption or len(caption) > MAX_CAPTION_LENGTH:
        raise TikTokUploadError("La descripción debe tener entre 1 y 2200 caracteres.", code="invalid_caption")
    _secure_shots_dir(shots_dir)
    page = context.pages[0] if context.pages else await context.new_page()
    publish_clicked = False
    try:
        await capture_step(page, shots_dir, 1, "sesion-verificada")
        await page.goto(UPLOAD_URL, wait_until="domcontentloaded", timeout=45_000)
        await _detect_manual_intervention(page)
        await _dismiss_unsaved_edit_prompt(page, shots_dir, 2)
        file_input = await _wait_for_file_control(page)
        if file_input is None:
            select_button = await first_visible(page, SELECT_VIDEO_BUTTONS, timeout_ms=700)
            if select_button is None:
                raise TikTokUploadError("No se encontró el selector de archivo de TikTok Studio.", code="file_selector_missing")
            await _human_pause()
            await capture_step(page, shots_dir, 2, "selector-video")
            async with page.expect_file_chooser(timeout=5_000) as chooser_info:
                await _move_and_click(page, select_button)
            chooser = await chooser_info.value
            await chooser.element.set_input_files(str(video_path))
        else:
            await file_input.set_input_files(str(video_path))
        await capture_step(page, shots_dir, 3, "video-seleccionado-carga-iniciada")
        await _wait_for_editor(page)
        next_step = await _dismiss_pre_publish_prompts(page, shots_dir, 4)
        await capture_step(page, shots_dir, next_step, "carga-completa-editor-listo")
        await _human_pause()
        await _enter_caption(page, caption)
        next_step += 1
        await capture_step(page, shots_dir, next_step, "descripcion-hashtags")
        await _human_pause()
        chosen_privacy = await _set_privacy(page, privacy)
        if privacy.casefold() == "public" and chosen_privacy not in PRIVACY_VALUES["public"]:
            raise TikTokUploadError("La visibilidad no quedó en público.", code="public_privacy_unconfirmed")
        await _ensure_no_dialog(page, "el ajuste de visibilidad")
        next_step += 1
        await capture_step(page, shots_dir, next_step, "visibilidad")
        await _human_pause()
        if await _expand_settings_for_comments(page):
            next_step += 1
            await capture_step(page, shots_dir, next_step, "ajustes-avanzados")
            await _human_pause()
        await _set_comments_enabled(page)
        await _ensure_no_dialog(page, "el ajuste de comentarios")
        next_step += 1
        await capture_step(page, shots_dir, next_step, "comentarios-activados")
        if dry_run:
            discarded = await _discard_draft(page, shots_dir, next_step + 1)
            return UploadOutcome(None, None, "dry_run", False, True, draft_discarded=discarded)

        await _human_pause()
        publish_button = await first_visible(page, PUBLISH_BUTTONS, timeout_ms=700)
        if publish_button is None:
            raise TikTokUploadError("No se encontró el botón principal Publicar; no se hizo ningún intento.", code="publish_button_missing")
        event, response_data, response_listener = await _capture_publication_response(page)
        await capture_step(page, shots_dir, next_step + 2, "antes-de-publicar")
        await _detect_manual_intervention(page)
        # This is the only click on the primary Publicar button. Nothing below retries it.
        await before_click()
        publish_clicked = True
        page._nexa_publish_clicked = True
        await _move_and_click(page, publish_button)
        await capture_step(page, shots_dir, next_step + 3, "publicar-pulsado-una-vez")
        await _handle_known_modals(page, shots_dir, next_step + 4)
        deadline = asyncio.get_running_loop().time() + PUBLISH_TIMEOUT_SECONDS
        while asyncio.get_running_loop().time() < deadline and not event.is_set():
            await _detect_manual_intervention(page)
            await asyncio.sleep(1.5)
        response_id = response_data.get("post_id")
        endpoint = response_data.get("endpoint")
        if not response_id and not endpoint:
            # TikTok may publish through a response shape not recognized above; verify by caption only.
            pass
        await capture_step(page, shots_dir, next_step + 5, "respuesta-publicacion")
        outcome = await _inspect_content(page, caption, response_id, username=username)
        outcome.publication_endpoint = endpoint
        await capture_step(page, shots_dir, next_step + 6, "estado-en-tiktok-studio")
        if outcome.post_id is None:
            raise TikTokUploadError(
                "Se pulsó Publicar una vez, pero TikTok no confirmó ID ni coincidencia en Contenido; estado desconocido, no se reintentará.",
                code="publish_unknown",
                after_publish_click=True,
            )
        return outcome
    except Exception as exc:
        error_path = await capture_failure(
            page,
            shots_dir,
            exc,
            after_publish_click=publish_clicked or getattr(exc, "after_publish_click", False),
        )
        if dry_run and not publish_clicked:
            cleanup_result = "fallido"
            try:
                await page.keyboard.press("Escape")
                discarded = await _discard_draft(page, shots_dir, 90)
                cleanup_result = "descartado" if discarded else "no había control de descarte visible"
            except Exception as cleanup_error:
                cleanup_result = f"fallido:{type(cleanup_error).__name__}"
            try:
                fd = os.open(error_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
                with os.fdopen(fd, "a", encoding="utf-8") as error_file:
                    error_file.write(f"dry_run_cleanup={cleanup_result}\n")
            except Exception:
                pass
        raise
    finally:
        listener = locals().get("response_listener")
        if listener is not None:
            try:
                page.remove_listener("response", listener)
            except Exception:
                pass

