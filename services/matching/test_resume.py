"""PDF validation and draft extraction checks without personal data."""

import io
import unittest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
from server import parse_pdf, ResumeError
from resume import draft_from_text


def fictional_pdf():
    writer = PdfWriter()
    page = writer.add_blank_page(612, 792)
    font = DictionaryObject({NameObject('/Type'): NameObject('/Font'),
                             NameObject('/Subtype'): NameObject('/Type1'),
                             NameObject('/BaseFont'): NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'):
        DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
    stream = DecodedStreamObject()
    stream.set_data(b'BT /F1 12 Tf 50 700 Td (Skills: Python, SQL) Tj ET')
    page[NameObject('/Contents')] = writer._add_object(stream)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


class ResumeTests(unittest.TestCase):
    def test_real_pdf_text_extraction(self):
        result = parse_pdf(fictional_pdf())
        self.assertEqual(result['profile_draft']['skills'], ['Python', 'SQL'])
        self.assertTrue(result['requires_confirmation'])
        self.assertEqual(result['parser_mode'], 'labeled_fields_only')

    def test_missing_fields_are_not_inferred(self):
        result = draft_from_text('Project: Python classifier\nGraduation: 2028')
        self.assertIsNone(result['profile_draft']['skills'])
        self.assertIsNone(result['profile_draft']['academic_year'])

    def test_bad_files_return_specific_errors(self):
        for data, code in ((b'hello', 'UNSUPPORTED_FILE_TYPE'),
                           (b'%PDF-broken', 'INVALID_PDF'),
                           (b'x' * (2 * 1024 * 1024 + 1), 'FILE_TOO_LARGE')):
            with self.subTest(code=code), self.assertRaises(ResumeError) as caught:
                parse_pdf(data)
            self.assertEqual(caught.exception.code, code)

    def test_blank_pdf_requires_manual_input(self):
        writer = PdfWriter()
        writer.add_blank_page(612, 792)
        out = io.BytesIO()
        writer.write(out)
        with self.assertRaises(ResumeError) as caught:
            parse_pdf(out.getvalue())
        self.assertEqual(caught.exception.code, 'PDF_TEXT_UNAVAILABLE')


if __name__ == '__main__':
    unittest.main()
