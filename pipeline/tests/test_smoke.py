import sys


def test_python_version_supported():
    assert sys.version_info >= (3, 11)
