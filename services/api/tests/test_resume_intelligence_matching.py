from app.resume_intelligence import analyze_resume, build_resume_preview, resources_for
from app.schemas import (
    CompetencyMap,
    EvidenceItem,
    ResumeJobMatchAnalysis,
    ResumeRequirementMatch,
)


class SourceLinkedAI:
    def competency_map(self, resume_text: str, job_text: str):
        return (
            CompetencyMap(
                summary="Strong analytics overlap with several tool gaps.",
                resume_skills=[
                    "Python",
                    "Machine learning",
                    "Pandas",
                    "NumPy",
                    "Predictive modeling",
                    "Data analysis",
                    "Cross-functional collaboration",
                ],
                required_skills=[
                    "Python",
                    "SQL",
                    "Data engineering",
                    "Mathematical modeling",
                    "Model evaluation",
                    "Business problem solving",
                    "Communication",
                    "Collaboration",
                ],
                overlapping_skills=[
                    "Python",
                    "Machine learning",
                    "Predictive modeling",
                    "Data analysis",
                    "Mathematical modeling",
                    "Model evaluation",
                    "Business insights",
                    "Problem solving",
                    "Communication",
                    "Collaboration",
                ],
                missing_skills=["SQL", "Excel", "SAS", "Data engineering"],
                evidence=[
                    EvidenceItem(
                        name="Machine learning",
                        source="both",
                        evidence="Resume: built machine learning models. Role: requires mathematical model building.",
                    ),
                    EvidenceItem(
                        name="Predictive modeling",
                        source="both",
                        evidence="Resume: built predictive models for traffic forecasting. Role: requires modeling.",
                    ),
                    EvidenceItem(
                        name="Model evaluation",
                        source="both",
                        evidence="Resume: evaluated multiple regression algorithms using confusion matrices. Role: requires evaluation.",
                    ),
                    EvidenceItem(
                        name="Business insights",
                        source="both",
                        evidence="Resume: translated insights into business recommendations. Role: requires insight delivery.",
                    ),
                    EvidenceItem(
                        name="Communication",
                        source="both",
                        evidence="Resume: presented business recommendations to stakeholders. Role: requires communication.",
                    ),
                    EvidenceItem(
                        name="Collaboration",
                        source="both",
                        evidence="Resume: collaborated with developers and stakeholders. Role: requires collaboration.",
                    ),
                ],
            ),
            "openai",
        )


class DedicatedOpenAIMatcher:
    def resume_job_match(self, resume_text: str, job_text: str):
        return (
            ResumeJobMatchAnalysis(
                summary="OpenAI found direct and transferable evidence for most role requirements.",
                requirements=[
                    ResumeRequirementMatch(
                        requirement="Python",
                        category="technical",
                        priority="essential",
                        match_level="strong",
                        confidence=98,
                        jd_evidence="Python",
                        resume_evidence="Python, Pandas, NumPy",
                        rationale="Python is explicitly listed and demonstrated in analytics work.",
                        recommendation="Keep a measurable Python project near the top of the resume.",
                    ),
                    ResumeRequirementMatch(
                        requirement="Mathematical modeling",
                        category="domain",
                        priority="essential",
                        match_level="related",
                        confidence=92,
                        jd_evidence="mathematical model building",
                        resume_evidence="Built predictive models and evaluated multiple regression algorithms",
                        rationale="Predictive regression work is semantically equivalent evidence.",
                        recommendation="Describe the model-selection rationale and validation approach.",
                    ),
                    ResumeRequirementMatch(
                        requirement="Cloud capabilities",
                        category="technical",
                        priority="preferred",
                        match_level="transferable",
                        confidence=86,
                        jd_evidence="cloud capabilities",
                        resume_evidence="AWS EC2 and S3 foundational",
                        rationale="Foundational AWS exposure transfers to the requested cloud capability.",
                        recommendation="Build and deploy one small workload on AWS.",
                    ),
                    ResumeRequirementMatch(
                        requirement="SQL",
                        category="technical",
                        priority="essential",
                        match_level="missing",
                        confidence=95,
                        jd_evidence="SQL",
                        resume_evidence="",
                        rationale="No SQL evidence is present.",
                        recommendation="Practice joins, aggregations, and window functions.",
                    ),
                ],
                resume_strengths=["Python analytics", "Predictive modeling"],
                improvement_suggestions=["Make cloud deployment evidence more concrete."],
                gap_analysis="SQL is the main essential gap.",
            ),
            "openai",
        )


def test_dedicated_openai_matcher_drives_scoring_and_semantic_matches():
    resume = """
    Python, Pandas, NumPy
    Built predictive models and evaluated multiple regression algorithms.
    AWS EC2 and S3 foundational
    """
    job = "Python, SQL, mathematical model building, and cloud capabilities"

    payload, provider = analyze_resume(resume, job, DedicatedOpenAIMatcher())

    assert provider == "openai"
    assert payload["matching_method"] == "openai_structured"
    assert payload["alignment_score"] == 61
    assert payload["matched_skills"] == ["Python", "Mathematical Modeling", "Cloud Computing"]
    assert payload["missing_skills"] == ["SQL"]
    assert payload["match_details"][1]["match_level"] == "related"
    assert "Built predictive models" in payload["evidence"][1]["snippet"]


def test_composite_openai_gap_labels_receive_multiple_resource_links():
    resources = resources_for(
        [
            "Cloud capabilities",
            "QC or validate code in Python/R/SAS or similar technologies",
            "Experience with Excel, VBA/Macros, SQL, SAS or R",
            "Manage multiple tasks under tight deadlines",
        ]
    )
    urls = {item["url"] for item in resources}

    assert any("skillbuilder.aws" in url for url in urls)
    assert any("pytest.org" in url for url in urls)
    assert any("support.microsoft.com" in url for url in urls)
    assert any("tutorial-sql" in url for url in urls)
    assert any("office/vba" in url for url in urls)
    assert any("atlassian.com" in url for url in urls)


def test_semantic_overlaps_are_not_discarded_and_generic_words_are_not_highlighted():
    resume = """
    Python, Pandas, NumPy, Machine Learning
    Built predictive models and evaluated multiple regression algorithms using confusion matrices.
    Processed customer data and performed data analysis to identify trends.
    Translated insights into business recommendations and presented them to stakeholders.
    Collaborated with developers and resolved usability issues.
    Achieved 85% accuracy.
    """
    job = """
    Requirements
    Python, SQL, Excel, SAS, data engineering, mathematical model building and evaluation.
    Strong business problem solving, communication, collaboration, and insight delivery.
    """

    payload, provider = analyze_resume(resume, job, SourceLinkedAI())

    assert provider == "openai"
    assert payload["alignment_score"] >= 60
    assert len(payload["matched_skills"]) >= 9
    assert "Machine Learning" in payload["matched_skills"]
    assert "Predictive Modeling" in payload["matched_skills"]
    assert "Mathematical Modeling" in payload["matched_skills"]
    assert "Business Insights" in payload["matched_skills"]
    assert "Collaboration" in payload["matched_qualities"]
    assert "Communication" in payload["matched_qualities"]
    assert "SQL" in payload["missing_skills"]

    preview = build_resume_preview(resume, payload["matched_skills"])
    highlighted_text = {
        preview["text"][item["start"]:item["end"]].casefold()
        for item in preview["highlights"]
    }
    assert "analyzed" not in highlighted_text
    assert "evaluated" not in highlighted_text
    assert "accuracy" not in highlighted_text
    assert "python" in highlighted_text
    assert "machine learning" in highlighted_text
