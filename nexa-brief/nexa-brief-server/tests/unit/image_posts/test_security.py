"""La sanitización de archivo conserva el texto editorial completo."""

from src.core.image_posts.security import redact_persisted_value


def test_caption_largo_conserva_credito_y_oculta_secretos():
    caption = "Contexto verificado. " * 35
    credito = "Foto: null0 · CC BY 2.0 · https://creativecommons.org/licenses/by/2.0"
    result = redact_persisted_value({"caption": caption + credito, "error": "access_token=privado"})

    assert result["caption"] == caption + credito
    assert len(result["caption"]) > 500
    assert "privado" not in result["error"]
