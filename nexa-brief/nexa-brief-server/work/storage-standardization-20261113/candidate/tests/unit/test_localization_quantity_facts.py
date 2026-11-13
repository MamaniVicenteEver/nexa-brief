"""Natural cardinals and quantified units without treating generic articles as facts."""
from decimal import Decimal

import pytest

from src.core.localization.texts import TextEntry, TextTable, numbers, quantity_units, same_figures, validate_table


@pytest.mark.parametrize("text,locale,value", [
    ("dois mil e um", "pt-BR", 2001), ("vinte e um", "pt-BR", 21),
    ("vinte e uma", "pt-BR", 21), ("cento e um", "pt-BR", 101),
    ("dois mil e vinte e um", "pt-BR", 2021), ("mil e um", "pt-BR", 1001),
    ("treinta y un", "es-419", 31), ("treinta y una", "es-419", 31),
    ("un millón", "es-419", 1000000), ("um milhão", "pt-BR", 1000000),
    ("two thousand and one", "en-US", 2001), ("twenty-one", "en-US", 21),
])
def test_cardinal_article_forms_keep_the_final_one(text, locale, value):
    assert numbers(text, locale) == {Decimal(value)}


@pytest.mark.parametrize("source,target,locale", [
    ("En 2001, el usuario eligiera borrar el historial.", "Em dois mil e um, a pessoa escolhesse apagar o histórico.", "pt-BR"),
    ("En 2025, el usuario eligiera una opción.", "In twenty twenty-five, a person chose an option.", "en-US"),
    ("En 2025, el usuario eligiera una opción.", "Em dois mil e vinte e cinco, a pessoa escolhesse uma opção.", "pt-BR"),
    ("Hay 21 millones de usuarios.", "Há vinte e um milhões de usuários.", "pt-BR"),
    ("Hay 31 usuarios.", "There are thirty-one users.", "en-US"),
])
def test_native_dates_and_real_user_counts_preserve_facts(source, target, locale):
    assert same_figures(source, "es-419", target, locale)


@pytest.mark.parametrize("text", [
    "En 2025, el usuario eligiera una opción.", "In 2025 a user chose an option.",
    "Em 2025, um usuário escolheu uma opção.", "Em 2025 e um usuário escolheu uma opção.",
    "El usuario recibió 20 millones de registros.", "Users compared the records from 2001.",
])
def test_generic_user_near_a_year_or_other_quantity_is_not_a_count_unit(text):
    assert "users" not in quantity_units(text)


@pytest.mark.parametrize("text", [
    "20 millones de usuarios", "twenty million users", "vinte milhões de usuários",
    "vinte e um usuários", "treinta y una usuarias", "one user", "2 usuarios activos",
    "20 million monthly active users", "usuarios: 20 millones", "usuários: 21 milhões",
    "20 million of the users", "20 millones de los usuarios", "20 milhões dos usuários",
    "vinte e um dos usuários", "twenty-one of the active users",
    "twenty million registered users", "twenty million paying users", "twenty million subscribed users",
    "twenty million concurrent users", "twenty million new users",
    "veinte millones de nuevos usuarios", "veinte millones de usuarios registrados",
    "vinte milhões de novos usuários", "vinte milhões de usuários pagantes",
])
def test_quantified_users_remain_a_protected_counting_unit(text):
    assert "users" in quantity_units(text)


@pytest.mark.parametrize("source,target,locale", [
    ("20 millones de usuarios", "twenty million records", "en-US"),
    ("20 millones de usuarios", "vinte milhões de registros", "pt-BR"),
    ("En 2001", "Em dois mil", "pt-BR"),
    ("21 usuarios", "vinte usuários", "pt-BR"),
    ("20 por ciento", "twenty dollars", "en-US"),
    ("20 dólares", "vinte euros", "pt-BR"),
    ("20 segundos", "twenty users", "en-US"),
    ("20 dólares", "minus twenty dollars", "en-US"),
])
def test_changed_counts_dates_units_and_signs_still_fail(source, target, locale):
    assert not same_figures(source, "es-419", target, locale)


@pytest.mark.parametrize("source,locale", [
    ("twenty million registered users", "en-US"), ("twenty million paying users", "en-US"),
    ("twenty million subscribed users", "en-US"), ("twenty million concurrent users", "en-US"),
    ("twenty million new users", "en-US"), ("veinte millones de nuevos usuarios", "es-419"),
    ("veinte millones de usuarios registrados", "es-419"), ("vinte milhões de novos usuários", "pt-BR"),
    ("vinte milhões de usuários pagantes", "pt-BR"),
])
def test_user_count_modifiers_do_not_allow_switching_the_count_to_records(source, locale):
    assert not same_figures(source, locale, "twenty million records", "en-US")


def test_articles_after_numeric_year_are_not_added_to_the_year():
    assert numbers("Em 2025 e um usuário escolheu uma opção.", "pt-BR") == {Decimal(2025)}


def test_narration_validates_native_year_and_generic_person_without_weakening_user_units():
    table = TextTable(source_locale="es-419", source_revision="source", entries={
        "seg.s32": TextEntry(text="En 2025, el usuario eligiera una opción.", type="narration"),
        "seg.s36": TextEntry(text="El correo fue de 2001.", type="narration"),
    })
    assert validate_table(table, {"seg.s32": "Em dois mil e vinte e cinco, a pessoa escolhesse uma opção.",
                                  "seg.s36": "O e-mail era de dois mil e um."}, "pt-BR") == {}
    counted = TextTable(source_locale="es-419", source_revision="source", entries={
        "seg.count": TextEntry(text="20 millones de usuarios.", type="narration"),
    })
    assert "quantity units changed" in validate_table(counted, {"seg.count": "Vinte milhões de registros."}, "pt-BR")["seg.count"]
