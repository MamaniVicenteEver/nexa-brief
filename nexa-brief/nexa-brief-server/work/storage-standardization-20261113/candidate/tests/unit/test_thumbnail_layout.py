from src.core.explainer.editions.thumbnail_layout import wrap_image_intro


def test_long_titles_wrap_without_losing_words():
    for text in ("THE WHOLE WEB LIVED HERE", "TODA LA WEB VIVÍA AQUÍ", "TODA A WEB VIVIA AQUI"):
        result = wrap_image_intro(text)
        assert "\n" in result
        assert result.split() == text.split()


def test_short_titles_and_editorial_breaks_are_preserved():
    assert wrap_image_intro("SHORT TITLE") == "SHORT TITLE"
    assert wrap_image_intro("THE WHOLE WEB\nLIVED HERE") == "THE WHOLE WEB\nLIVED HERE"
    assert wrap_image_intro("SUPERCALIFRAGILISTIC") == "SUPERCALIFRAGILISTIC"
