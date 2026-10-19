"""Unicode -> Morpheus beta code. Greek inputs are copied from the kaikki dump; expected beta
strings are the spellings Morpheus itself accepted and echoed back in its analyses."""
import pytest

from betacode import to_beta


@pytest.mark.parametrize(
    "greek, beta",
    [
        ("λόγου", "lo/gou"),
        ("ἔλῡσᾰ", "e)/lusa"),
        ("χώρᾱς", "xw/ras"),
        ("θᾰλᾰ́ττης", "qala/tths"),
        ("λόγῳ", "lo/gw|"),
        ("τῇ", "th=|"),
        ("ἡ", "h("),
        ("αἱ", "ai("),
        ("ᾰ̓́στεως", "a)/stews"),
        ("ἐλῡ́θην", "e)lu/qhn"),
        ("νεᾱνῐ́ου", "neani/ou"),
        ("φῠ́λᾰξ", "fu/lac"),
        ("σώφρονος", "sw/fronos"),
    ],
)
def test_to_beta(greek, beta):
    assert to_beta(greek) == beta


def test_to_beta_rejects_non_greek():
    with pytest.raises(ValueError):
        to_beta("logos")
