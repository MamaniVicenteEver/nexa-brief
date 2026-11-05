from src.core.social_caption import brief_caption, social_video_parts


def test_social_video_keeps_one_title_one_question_and_relevant_caption_tags():
    body, tags = social_video_parts("Amazon y la IA", "Texto largo.\n\nFuentes: https://example.org\n\n¿Qué opinas?\n\n#IA #ia #Amazon", ["Barclays", "FORTRAN"])
    assert body == "Amazon y la IA\n\n¿Qué opinas?"
    assert tags == ["IA", "Amazon"]
    assert "http" not in body and "#" not in body


def test_brief_copy_does_not_duplicate_question_or_case_variants():
    assert brief_caption("¿Qué cambió?", "¿Qué cambió?", ["IA", "ia"]) == "¿Qué cambió?\n\n#IA"
