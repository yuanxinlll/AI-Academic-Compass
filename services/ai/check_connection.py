"""Check Gemini with fictional text. Never save or display credentials."""

import getpass
import os
import sys

from gemini import GeminiError, parse_text


def main():
    if not sys.stdin.isatty() and (
            not os.environ.get("GEMINI_API_KEY") or not os.environ.get("GEMINI_MODEL")):
        print("Set GEMINI_API_KEY and GEMINI_MODEL, or run this script in an interactive terminal.")
        return 2
    if not os.environ.get("GEMINI_MODEL"):
        os.environ["GEMINI_MODEL"] = input("Gemini model ID: ").strip()
    if not os.environ.get("GEMINI_API_KEY"):
        os.environ["GEMINI_API_KEY"] = getpass.getpass("Gemini API key (hidden, not saved): ").strip()
    try:
        result = parse_text(
            "Fictional resume for integration testing.\n"
            "University: UCSD\nMajor: Data Science\n"
            "Education level: undergraduate\nSkills: Python, SQL")
    except GeminiError as error:
        print(f"FAIL [{error.code}]: {error}")
        return 1
    print("PASS: Gemini returned a validated draft for fictional resume text.")
    print("Parser mode:", result["parser_mode"])
    print("Review required:", result["requires_confirmation"])
    print("This check does not configure or restart the demo server.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
