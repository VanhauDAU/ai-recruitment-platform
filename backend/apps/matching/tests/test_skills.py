from django.test import SimpleTestCase

from ..services.skills import SkillCatalog, cv_skills

CATALOG_ROWS = [
    (1, 'ReactJS', ['React', 'React.js'], 'Frontend'),
    (2, 'Java', [], ''),
    (3, 'JavaScript', ['JS'], ''),
    (4, 'AI', [], ''),
    (5, 'Cẩn thận', [], 'Phẩm chất cá nhân'),
    (6, 'Power Query', [], ''),
    (7, 'C#', [], ''),
]


def catalog():
    return SkillCatalog(CATALOG_ROWS)


class SkillCatalogTests(SimpleTestCase):
    def test_resolves_names_and_aliases_ignoring_case_and_spacing(self):
        self.assertEqual(catalog().resolve('react.js').name, 'ReactJS')
        self.assertEqual(catalog().resolve('  power   query ').name, 'Power Query')
        self.assertIsNone(catalog().resolve('Kotlin'))

    def test_finds_whole_terms_only_with_the_sentence_as_evidence(self):
        found = catalog().find(['Viết JavaScript và C# cho dự án.', 'Dùng Power  Query hằng ngày.'])
        self.assertEqual(
            [(skill.name, sentence[:10]) for skill, sentence in found],
            [('JavaScript', 'Viết JavaS'), ('C#', 'Viết JavaS'), ('Power Query', 'Dùng Power')],
        )

    def test_short_terms_must_match_case(self):
        self.assertEqual(catalog().find(['Ứng dụng AI vào sản phẩm.'])[0][0].name, 'AI')
        self.assertEqual(catalog().find(['Nhân viên hỗ trợ ai cũng được.']), [])

    def test_personal_traits_are_kept_but_not_counted(self):
        self.assertFalse(catalog().resolve('Cẩn thận').counted)
        self.assertTrue(catalog().resolve('Java').counted)


class CvSkillsTests(SimpleTestCase):
    def test_sources_and_evidence_follow_the_no_invention_rule(self):
        skills = cv_skills(
            catalog(),
            declared_names=['React', 'Java', 'Kotlin'],
            listings=['C#'],
            sentences=['Xây dựng giao diện bằng ReactJS cho cổng bán hàng.', 'AI'],
        )
        by_name = {skill['name']: skill for skill in skills}
        self.assertEqual(set(by_name), {'ReactJS', 'Java', 'C#'})
        self.assertEqual(by_name['ReactJS']['source'], 'declared')
        self.assertIn('ReactJS cho cổng', by_name['ReactJS']['evidence'])
        # Chỉ có trong danh sách: không có bằng chứng, không lấy danh sách làm bằng chứng.
        self.assertEqual(by_name['Java']['evidence'], '')
        self.assertEqual(by_name['C#']['source'], 'listed')
        # "AI" đứng một mình không phải câu kể việc nên không thành kỹ năng `text`.
        self.assertNotIn('AI', by_name)

    def test_skill_only_in_content_is_text_with_evidence(self):
        skills = cv_skills(catalog(), sentences=['Tự động hóa báo cáo bằng Power Query.'])
        self.assertEqual(skills[0]['source'], 'text')
        self.assertEqual(skills[0]['evidence'], 'Tự động hóa báo cáo bằng Power Query.')
