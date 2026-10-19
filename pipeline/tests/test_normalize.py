"""Tests for normalize.py. Greek strings are copied verbatim from the kaikki dump."""
import unicodedata

from normalize import final_sigma, key, nfc, strip_accents, strip_all, strip_length


def test_nfc_composes_decomposed_input():
    decomposed = unicodedata.normalize("NFD", "λόγου")
    assert nfc(decomposed) == "λόγου"
    assert unicodedata.is_normalized("NFC", nfc(decomposed))


def test_strip_length_removes_macron_and_breve_only():
    assert strip_length("φῠ́λᾰκος") == nfc("φύλακος")
    assert strip_length("χώρᾱς") == "χώρας"
    assert strip_length("ᾰ̓γᾰθός") == nfc("ἀγαθός")


def test_strip_length_handles_combined_macron_and_breve():
    # The dump writes "λῡ̆́ω" when the vowel may be long or short.
    assert strip_length("λῡ̆́ω") == nfc("λύω")


def test_strip_accents_keeps_breathing_and_iota_subscript():
    assert strip_accents("ᾰ̓γᾰθός") == nfc("ἀγαθος")
    assert strip_accents("λόγῳ") == nfc("λογῳ")
    assert strip_accents("τῇ") == nfc("τῃ")


def test_strip_all_removes_every_diacritic():
    assert strip_all("ᾰ̓γᾰθός") == "αγαθος"
    assert strip_all("λόγῳ") == "λογω"


def test_final_sigma():
    assert final_sigma("λογοσ") == "λογος"
    assert final_sigma("λογος λογοσ") == "λογος λογος"
    assert final_sigma("λυςω") == "λυσω"


def test_key_is_nfc_without_length_marks():
    assert key("θᾰ́λᾰσσᾰ") == nfc("θάλασσα")
    assert key(unicodedata.normalize("NFD", "λόγος")) == "λόγος"
