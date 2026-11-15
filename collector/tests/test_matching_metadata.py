import tempfile
import unittest
from pathlib import Path
from collector.matching_metadata import validate_metadata, numeric_audit, build


class MetadataTests(unittest.TestCase):
    def test_missing_fields_stay_null_and_explicit_term_has_no_invented_year(self):
        row={'department':None,'discipline':None,'project_term':{'value':'Winter and Spring','raw_text':'Participation during Winter and Spring.'}}
        values,evidence=validate_metadata(row,'Participation during Winter and Spring.')
        self.assertIsNone(values['department'])
        self.assertIsNone(values['discipline'])
        self.assertEqual(values['project_term'],'Winter and Spring')
        self.assertNotIn('2026',values['project_term'])

    def test_hallucinated_department_or_quote_is_rejected(self):
        for row in ({'department':{'value':'Psychology','raw_text':'Computer Science Department'}},
                    {'discipline':{'value':'Biology','raw_text':'Biology research'}}):
            with self.assertRaises(ValueError):validate_metadata(row,'Computer Science Department')

    def test_model_output_with_bad_evidence_is_not_exported_as_fact(self):
        record=dict(opportunity_id='synthetic-id',source_url='https://ucsd.edu/example',title='Synthetic',category='research')
        def extractor(batch):return [dict(index=0,department={'value':'Psychology','raw_text':'Psychology'},discipline=None,project_term=None)]
        with tempfile.TemporaryDirectory() as directory:
            output=build([record],{record['source_url']:'No department published.'},Path(directory),extractor)
            self.assertIsNone(output[0]['department'])
            self.assertTrue(output[0]['validation_error'])

    def test_numeric_audit_rejects_strings_and_boolean_but_allows_unknown(self):
        record=dict(opportunity_id='synthetic-id',source_url='https://ucsd.edu/example',eligibility=[
            dict(type='gpa',value=3.5),dict(type='hours_per_week',value=None),
            dict(type='hours_per_week',value='10'),dict(type='gpa',value=True)])
        self.assertEqual(len(numeric_audit([record])),2)

    def test_student_organization_is_not_a_department_and_duration_is_not_a_term(self):
        for row,text in [({'department':{'value':'Triton XR','raw_text':'Triton XR'}},'Triton XR'),
                         ({'project_term':{'value':'up to three quarters','raw_text':'up to three quarters'}},'up to three quarters'),
                         ({'project_term':{'value':'Winter 2024','raw_text':'Meeting times for Winter 2024'}},'Meeting times for Winter 2024')]:
            with self.assertRaises(ValueError):validate_metadata(row,text)
