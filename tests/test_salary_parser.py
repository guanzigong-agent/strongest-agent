import sys,pathlib,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from salary_parser import parse_salary
class SalaryParserTests(unittest.TestCase):
 def test_uses_base_salary_not_cap_hit_or_future_contract(self):
  h='Signing Date : September 29, 2025 <table><tr><td>2025-26</td><td>$0</td><td>$636,434</td><td>$0</td></tr></table> Signing Date : April 12, 2026 <table><tr><td>2025-26</td><td>$13,197</td><td>$13,197</td></tr></table> DEAD CAP <tr><td>2025-26</td><td>$2,710,680</td><td>$2,710,680</td></tr>'
  self.assertEqual(parse_salary(h,'2025-10-21'),636434)
 def test_ignores_deadcap_and_superseded_contract(self):
  h='Signing Date : July 1, 2024 <tr><td>2025-26</td><td>$4,901,400</td><td>$4,901,400</td></tr>Signing Date : July 2, 2025 <tr><td>2025-26</td><td>$2,296,274</td><td>$3,080,921</td></tr> DEAD CAP <tr><td>2025-26</td><td>$100</td><td>$100</td></tr>'
  self.assertEqual(parse_salary(h,'2025-10-21'),3080921)
if __name__=='__main__':unittest.main()
