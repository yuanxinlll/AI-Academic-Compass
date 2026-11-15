"""Run all port-free checks without network access or real credentials."""

import unittest


if __name__ == '__main__':
    names = ['test_engine', 'test_resume', 'test_gemini', 'test_worker',
             'test_qualifications', 'test_flow', 'test_contract_adapter', 'test_service', 'test_api.ProfileMergeTests']
    suite = unittest.defaultTestLoader.loadTestsFromNames(names)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)
