import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

from .ai_provider import AIProvider


SKILL_ALIASES: dict[str, tuple[str, ...]] = {
    "Python": ("python",),
    "Java": ("java",),
    "JavaScript": ("javascript", "js"),
    "TypeScript": ("typescript",),
    "C": ("c language",),
    "C++": ("c++", "cpp"),
    "C#": ("c#", "c sharp"),
    "Go": ("golang", "go language"),
    "Kotlin": ("kotlin",),
    "Swift": ("swift",),
    "PHP": ("php",),
    "Ruby": ("ruby",),
    "R": ("r programming", "r language"),
    "HTML": ("html", "html5"),
    "CSS": ("css", "css3"),
    "Sass": ("sass", "scss"),
    "React": ("react", "react.js", "reactjs"),
    "Angular": ("angular", "angularjs"),
    "Vue.js": ("vue", "vue.js", "vuejs"),
    "Next.js": ("next.js", "nextjs"),
    "Node.js": ("node.js", "nodejs"),
    "Express.js": ("express.js", "expressjs", "express"),
    "NestJS": ("nestjs", "nest.js"),
    "Redux": ("redux", "redux toolkit"),
    "Tailwind CSS": ("tailwind", "tailwind css"),
    "Bootstrap": ("bootstrap",),
    "FastAPI": ("fastapi",),
    "Django": ("django",),
    "Flask": ("flask",),
    "Spring Boot": ("spring boot",),
    ".NET": (".net", "dotnet", "asp.net"),
    "Laravel": ("laravel",),
    "SQL": ("sql", "structured query language"),
    "PostgreSQL": ("postgresql", "postgres"),
    "MySQL": ("mysql",),
    "SQLite": ("sqlite",),
    "SQL Server": ("sql server", "mssql"),
    "Oracle Database": ("oracle database", "oracle db"),
    "MongoDB": ("mongodb",),
    "Redis": ("redis",),
    "DynamoDB": ("dynamodb",),
    "Firebase": ("firebase", "firestore"),
    "Elasticsearch": ("elasticsearch", "elastic search"),
    "REST APIs": ("rest api", "rest APIs", "restful api"),
    "GraphQL": ("graphql",),
    "WebSockets": ("websocket", "websockets"),
    "gRPC": ("grpc",),
    "API Integration": ("api integration", "integrated apis", "third-party api"),
    "AWS": ("aws", "amazon web services"),
    "Azure": ("azure",),
    "GCP": ("gcp", "google cloud"),
    "Docker": ("docker",),
    "Kubernetes": ("kubernetes", "k8s"),
    "Terraform": ("terraform", "infrastructure as code", "iac"),
    "Ansible": ("ansible",),
    "Git": ("git", "github"),
    "GitHub Actions": ("github actions",),
    "Jenkins": ("jenkins",),
    "GitLab CI": ("gitlab ci", "gitlab pipelines"),
    "CI/CD": ("ci/cd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"),
    "Linux": ("linux", "unix"),
    "Shell Scripting": ("shell scripting", "bash", "powershell"),
    "Nginx": ("nginx",),
    "Apache": ("apache server", "apache http"),
    "Microservices": ("microservice", "microservices"),
    "Distributed Systems": ("distributed system", "distributed systems"),
    "Cloud Computing": ("cloud computing", "cloud infrastructure", "cloud services"),
    "Serverless": ("serverless", "lambda functions", "aws lambda"),
    "DevOps": ("devops", "dev ops"),
    "Monitoring": ("monitoring", "observability", "prometheus", "grafana"),
    "Machine Learning": ("machine learning", "ml model"),
    "Deep Learning": ("deep learning", "neural network", "neural networks"),
    "Generative AI": ("generative ai", "genai", "large language model", "large language models", "llm", "llms"),
    "Natural Language Processing": ("natural language processing", "nlp"),
    "Computer Vision": ("computer vision", "image recognition"),
    "Data Analysis": ("data analysis", "data analytics"),
    "Data Science": ("data science",),
    "Data Engineering": ("data engineering", "data pipelines", "etl", "elt"),
    "Predictive Modeling": ("predictive modeling", "predictive models", "prediction model", "forecasting model"),
    "Mathematical Modeling": ("mathematical modeling", "mathematical model", "regression model", "regression models"),
    "Model Evaluation": (
        "model evaluation", "evaluated regression models", "evaluated multiple regression algorithms",
        "confusion matrix", "confusion matrices", "validation metrics",
    ),
    "Feature Engineering": ("feature engineering", "engineered features", "feature extraction"),
    "Business Insights": (
        "business insights", "business recommendations", "translated insights", "decision-making",
        "decision making",
    ),
    "Decision Support": ("decision support", "decision-support", "data-driven decision"),
    "UI/UX Design": ("ui/ux", "user experience design", "user interface design", "usability"),
    "Speech Recognition": ("speech recognition", "voice command recognition", "mfcc"),
    "Pandas": ("pandas",),
    "NumPy": ("numpy",),
    "Scikit-learn": ("scikit-learn", "sklearn"),
    "TensorFlow": ("tensorflow",),
    "PyTorch": ("pytorch",),
    "Hugging Face": ("hugging face", "huggingface", "transformers library"),
    "OpenAI API": ("openai api", "openai"),
    "LangChain": ("langchain",),
    "Apache Spark": ("apache spark", "pyspark"),
    "Kafka": ("kafka", "apache kafka"),
    "Airflow": ("airflow", "apache airflow"),
    "Power BI": ("power bi", "powerbi"),
    "Tableau": ("tableau",),
    "Excel": ("excel", "microsoft excel"),
    "Data Structures": ("data structures", "dsa"),
    "Algorithms": ("algorithms", "algorithm"),
    "Object-Oriented Programming": ("object-oriented programming", "object oriented programming", "oop"),
    "Functional Programming": ("functional programming",),
    "Operating Systems": ("operating systems", "operating system concepts"),
    "Computer Networks": ("computer networks", "computer networking", "networking"),
    "DBMS": ("dbms", "database management systems", "database management"),
    "System Design": ("system design", "software architecture", "architecture design"),
    "Design Patterns": ("design patterns", "solid principles", "solid"),
    "Performance Optimization": ("performance optimization", "performance tuning", "optimized performance", "latency reduction"),
    "Debugging": ("debugging", "debugged", "troubleshooting", "troubleshot", "root cause analysis"),
    "Unit Testing": ("unit testing", "unit tests", "pytest", "junit", "jest"),
    "Integration Testing": ("integration testing", "integration tests"),
    "Test Automation": ("test automation", "automated testing", "selenium", "cypress", "playwright"),
    "Quality Assurance": ("quality assurance", "qa testing", "software testing"),
    "Secure Coding": ("secure coding", "application security", "owasp", "cybersecurity"),
    "Authentication": ("authentication", "authorization", "oauth", "jwt"),
    "Agile": ("agile", "agile methodology", "agile development"),
    "Scrum": ("scrum",),
    "Project Management": ("project management", "managed projects", "project planning"),
    "Product Development": ("product development", "product lifecycle"),
    "Technical Documentation": ("technical documentation", "documented", "documentation"),
    "Communication": (
        "communicated with", "presented to", "presented the", "technical presentation", "technical writing",
        "explained technical", "written and verbal", "translated insights", "business recommendations",
    ),
    "Collaboration": (
        "cross-functional collaboration", "cross functional collaboration", "collaborated with",
        "worked with the team", "worked with developers", "partnered with", "team environment",
    ),
    "Leadership": (
        "leadership", "led a team", "team lead", "technical lead", "managed a team",
        "spearheaded", "directed", "guided the team",
    ),
    "Problem Solving": (
        "problem solving", "problem-solving", "resolved issues", "resolving issues", "troubleshooting",
        "root cause analysis", "complex problems",
    ),
    "Analytical Thinking": (
        "analytical thinking", "analytical skills", "requirements analysis", "data analysis",
        "predictive modeling", "data-driven analysis",
    ),
    "Adaptability": (
        "adaptability", "adaptable", "fast-paced", "fast paced", "learn quickly",
        "quick learner", "rapidly learned",
    ),
    "Ownership": (
        "ownership", "owned", "independently", "self-driven", "self motivated",
        "self-motivated", "end-to-end", "end to end",
    ),
    "Time Management": (
        "time management", "prioritized", "prioritised", "multiple deadlines",
        "meet deadlines", "on time",
    ),
    "Attention to Detail": (
        "attention to detail", "detail-oriented", "detail oriented", "quality standards",
        "quality assurance",
    ),
    "Stakeholder Management": (
        "stakeholder management", "stakeholders", "client-facing", "client facing",
        "business teams", "product managers",
    ),
    "Mentoring": ("mentoring", "mentored", "coached", "onboarded", "trained team"),
    "Customer Focus": (
        "customer focus", "customer-focused", "customer focused", "user needs",
        "customer requirements", "user feedback",
    ),
    "Creativity": ("creativity", "creative thinking", "innovative", "innovation", "prototyped"),
}

QUALITY_SKILLS = {
    "Communication",
    "Collaboration",
    "Leadership",
    "Problem Solving",
    "Analytical Thinking",
    "Adaptability",
    "Ownership",
    "Time Management",
    "Attention to Detail",
    "Stakeholder Management",
    "Mentoring",
    "Customer Focus",
    "Creativity",
}

REQUIREMENT_ALIASES: dict[str, tuple[str, ...]] = {
    "Communication": (
        "communication", "communication skills", "interpersonal skills", "written communication",
        "verbal communication", "presentation skills",
    ),
    "Collaboration": ("collaboration", "collaborative", "teamwork", "team player", "work with teams"),
    "Leadership": ("leadership", "leadership skills", "lead teams"),
    "Problem Solving": ("problem solving", "problem-solving", "solve complex problems"),
    "Analytical Thinking": ("analytical thinking", "analytical skills", "logical thinking"),
    "Adaptability": ("adaptability", "adaptable", "fast-paced environment"),
    "Ownership": ("ownership", "take ownership", "accountability"),
    "Time Management": ("time management", "manage deadlines", "tight deadlines"),
    "Attention to Detail": ("attention to detail", "detail-oriented", "high quality delivery"),
    "Stakeholder Management": ("stakeholder management", "stakeholders", "client relationships"),
    "Mentoring": ("mentoring", "mentor team members", "coaching"),
    "Customer Focus": ("customer focus", "customer-focused", "customer requirements"),
    "Creativity": ("creativity", "creative thinking", "innovation"),
}

RESOURCE_CATALOG: dict[str, tuple[str, str]] = {
    "Python": ("Python Tutorial", "https://docs.python.org/3/tutorial/"),
    "Java": ("Learn Java", "https://dev.java/learn/"),
    "JavaScript": ("MDN JavaScript Guide", "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide"),
    "FastAPI": ("FastAPI Tutorial", "https://fastapi.tiangolo.com/tutorial/"),
    "React": ("React Learn", "https://react.dev/learn"),
    "TypeScript": ("TypeScript Handbook", "https://www.typescriptlang.org/docs/handbook/intro.html"),
    "Next.js": ("Next.js Learn", "https://nextjs.org/learn"),
    "Node.js": ("Introduction to Node.js", "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs"),
    "Django": ("Django Tutorial", "https://docs.djangoproject.com/en/stable/intro/tutorial01/"),
    "Flask": ("Flask Quickstart", "https://flask.palletsprojects.com/en/stable/quickstart/"),
    "Spring Boot": ("Spring Boot Guides", "https://spring.io/guides/gs/spring-boot"),
    "SQL": ("PostgreSQL SQL Tutorial", "https://www.postgresql.org/docs/current/tutorial-sql.html"),
    "PostgreSQL": ("PostgreSQL Tutorial", "https://www.postgresql.org/docs/current/tutorial.html"),
    "MySQL": ("MySQL Tutorial", "https://dev.mysql.com/doc/refman/8.4/en/tutorial.html"),
    "MongoDB": ("MongoDB Developer Path", "https://learn.mongodb.com/learning-paths/mongodb-developer-path"),
    "Redis": ("Redis Get Started", "https://redis.io/docs/latest/get-started/"),
    "REST APIs": ("MDN HTTP Overview", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview"),
    "GraphQL": ("Introduction to GraphQL", "https://graphql.org/learn/"),
    "AWS": ("AWS Skill Builder", "https://skillbuilder.aws/"),
    "Azure": ("Microsoft Azure Fundamentals", "https://learn.microsoft.com/en-us/training/paths/azure-fundamentals-describe-cloud-concepts/"),
    "GCP": ("Google Cloud Training", "https://cloud.google.com/learn/training"),
    "Docker": ("Docker Get Started", "https://docs.docker.com/get-started/"),
    "Kubernetes": ("Kubernetes Basics", "https://kubernetes.io/docs/tutorials/kubernetes-basics/"),
    "Git": ("Pro Git Book", "https://git-scm.com/book/en/v2"),
    "CI/CD": ("GitHub Actions Documentation", "https://docs.github.com/en/actions"),
    "Data Structures": ("MIT OpenCourseWare Algorithms", "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/"),
    "Algorithms": ("MIT OpenCourseWare Algorithms", "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/"),
    "Machine Learning": ("Google ML Crash Course", "https://developers.google.com/machine-learning/crash-course"),
    "Data Analysis": ("Pandas Getting Started", "https://pandas.pydata.org/docs/getting_started/index.html"),
    "Data Science": ("Python Data Science Handbook", "https://jakevdp.github.io/PythonDataScienceHandbook/"),
    "Pandas": ("Pandas Getting Started", "https://pandas.pydata.org/docs/getting_started/index.html"),
    "NumPy": ("NumPy Learn", "https://numpy.org/learn/"),
    "TensorFlow": ("TensorFlow Tutorials", "https://www.tensorflow.org/tutorials"),
    "PyTorch": ("PyTorch Tutorials", "https://pytorch.org/tutorials/"),
    "Power BI": ("Microsoft Power BI Learning", "https://learn.microsoft.com/en-us/training/powerplatform/power-bi"),
    "Tableau": ("Tableau Training", "https://www.tableau.com/learn/training"),
    "Excel": ("Microsoft Excel Learning", "https://support.microsoft.com/en-us/excel"),
    "System Design": ("System Design Primer", "https://github.com/donnemartin/system-design-primer"),
    "Agile": ("Agile Practice Guide", "https://www.atlassian.com/agile"),
    "Scrum": ("The Scrum Guide", "https://scrumguides.org/scrum-guide.html"),
    "Communication": ("Google Technical Writing", "https://developers.google.com/tech-writing"),
    "Problem Solving": ("Problem Solving with Algorithms", "https://runestone.academy/ns/books/published/pythonds3/index.html"),
    "Cloud Computing": ("AWS Cloud Practitioner Essentials", "https://skillbuilder.aws/learn/course/134/aws-cloud-practitioner-essentials"),
    "Unit Testing": ("pytest Good Practices", "https://docs.pytest.org/en/stable/explanation/goodpractices.html"),
    "Time Management": ("Time Management Strategies", "https://www.atlassian.com/blog/productivity/time-management-strategies"),
    "VBA": ("Getting Started with VBA in Office", "https://learn.microsoft.com/en-us/office/vba/library-reference/concepts/getting-started-with-vba-in-office"),
    "R": ("R Manuals and Documentation", "https://cran.r-project.org/manuals.html"),
    "SAS": ("SAS Documentation", "https://support.sas.com/en/documentation.html"),
    "Resume Education": ("Purdue Resume Workshop", "https://owl.purdue.edu/owl/job_search_writing/resumes_and_vitas/resume_workshop/index.html"),
}

RESOURCE_RULES: tuple[tuple[tuple[str, ...], tuple[tuple[str, str], ...]], ...] = (
    (
        ("academic eligibility", "cgpa", "class 10th", "class 12th", "education eligibility"),
        (RESOURCE_CATALOG["Resume Education"],),
    ),
    (
        ("cloud", "aws", "azure", "gcp", "ec2", "s3"),
        (
            RESOURCE_CATALOG["Cloud Computing"],
            RESOURCE_CATALOG["Azure"],
            RESOURCE_CATALOG["GCP"],
        ),
    ),
    (
        ("qc", "quality control", "validate code", "code validation", "testing", "unit test", "debug"),
        (
            RESOURCE_CATALOG["Unit Testing"],
            RESOURCE_CATALOG["Git"],
        ),
    ),
    (
        ("excel", "spreadsheet"),
        (RESOURCE_CATALOG["Excel"],),
    ),
    (
        ("vba", "macro"),
        (RESOURCE_CATALOG["VBA"],),
    ),
    (
        ("sql", "database query"),
        (RESOURCE_CATALOG["SQL"],),
    ),
    (
        ("sas",),
        (RESOURCE_CATALOG["SAS"],),
    ),
    (
        (" r ", "r programming", "sas or r", "python/r/sas"),
        (RESOURCE_CATALOG["R"],),
    ),
    (
        ("deadline", "multiple tasks", "multitask", "time management"),
        (RESOURCE_CATALOG["Time Management"],),
    ),
    (
        ("communication", "presentation", "client conversation", "stakeholder", "insight delivery"),
        (RESOURCE_CATALOG["Communication"],),
    ),
    (
        ("problem solving", "first principles", "logical thinking", "analytical thinking"),
        (RESOURCE_CATALOG["Problem Solving"],),
    ),
    (
        ("model", "machine learning", "predictive", "regression"),
        (RESOURCE_CATALOG["Machine Learning"],),
    ),
    (
        ("data analysis", "analytics", "pandas", "numpy"),
        (
            RESOURCE_CATALOG["Data Analysis"],
            RESOURCE_CATALOG["NumPy"],
        ),
    ),
    (
        ("system design", "architecture", "solution design"),
        (RESOURCE_CATALOG["System Design"],),
    ),
)

START_HEADINGS = {
    "requirements", "job requirements", "required skills", "required qualifications",
    "minimum qualifications", "preferred qualifications", "skills", "technical skills",
    "must have", "nice to have", "what we are looking for", "what we're looking for",
}
STOP_HEADINGS = {
    "about us", "about the company", "benefits", "perks", "compensation", "salary",
    "equal opportunity", "privacy", "how to apply",
}


@dataclass(frozen=True)
class Match:
    skill: str
    snippet: str
    reason: str


def _normalized_heading(line: str) -> str:
    line = line.strip().strip(":-").replace("’", "'")
    return re.sub(r"\s+", " ", re.sub(r"[^a-zA-Z0-9' ]+", " ", line)).lower().strip()


def extract_requirements_text(jd_text: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in jd_text.splitlines() if line.strip()]
    start = next((index for index, line in enumerate(lines) if _normalized_heading(line.split(":", 1)[0]) in START_HEADINGS), None)
    if start is None:
        return "\n".join(line for line in lines if _normalized_heading(line) not in STOP_HEADINGS)
    selected: list[str] = []
    for line in lines[start:]:
        if selected and _normalized_heading(line) in STOP_HEADINGS:
            break
        selected.append(line)
    return "\n".join(selected)


def _pattern(alias: str) -> str:
    return rf"(?<![A-Za-z0-9]){re.escape(alias.strip())}(?![A-Za-z0-9])"


def extract_skills(text: str, *, requirements: bool = False) -> list[str]:
    return [
        skill
        for skill, aliases in SKILL_ALIASES.items()
        if any(
            re.search(_pattern(alias), text, re.IGNORECASE)
            for alias in aliases + (REQUIREMENT_ALIASES.get(skill, ()) if requirements else ())
        )
    ]


def _canonical_term(term: str) -> str:
    cleaned = re.sub(r"\s+", " ", term).strip(" -•\t")
    key = cleaned.casefold()
    for skill, aliases in SKILL_ALIASES.items():
        if key == skill.casefold() or any(key == alias.casefold() for alias in aliases):
            return skill
    replacements = {
        "team collaboration": "Collaboration",
        "cross-functional collaboration": "Collaboration",
        "cross functional collaboration": "Collaboration",
        "analytical thinking": "Analytical Thinking",
        "attention to detail": "Attention to Detail",
        "problem solving": "Problem Solving",
        "machine learning": "Machine Learning",
        "data analysis": "Data Analysis",
        "predictive modeling": "Predictive Modeling",
        "mathematical modeling": "Mathematical Modeling",
        "model evaluation": "Model Evaluation",
        "business insights": "Business Insights",
        "cloud capabilities": "Cloud Computing",
        "architecture design": "System Design",
        "design architecture": "System Design",
        "presentation of insights": "Communication",
    }
    return replacements.get(key, cleaned)


def _term_tokens(term: str) -> set[str]:
    ignored = {"and", "the", "of", "skills", "skill", "capabilities", "fundamentals"}
    return {
        token
        for token in re.findall(r"[a-z0-9+#.]+", _canonical_term(term).casefold())
        if token not in ignored
    }


def _term_similarity(left: str, right: str) -> float:
    left_key = _canonical_term(left).casefold()
    right_key = _canonical_term(right).casefold()
    if left_key == right_key:
        return 1.0
    left_tokens = _term_tokens(left)
    right_tokens = _term_tokens(right)
    overlap = len(left_tokens & right_tokens) / max(1, len(left_tokens | right_tokens))
    sequence = SequenceMatcher(None, left_key, right_key).ratio()
    return max(overlap, sequence)


def _is_quality(skill: str) -> bool:
    canonical = _canonical_term(skill)
    if canonical in QUALITY_SKILLS:
        return True
    lowered = canonical.casefold()
    return any(
        marker in lowered
        for marker in (
            "thinking", "solving", "communication", "collaboration", "leadership",
            "ownership", "quality delivery", "client relationship", "multitasking",
            "learning agility", "time management", "attention to detail",
        )
    )


def _unique_terms(*groups: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for group in groups:
        for term in group:
            cleaned = _canonical_term(term)
            key = cleaned.casefold()
            if not cleaned or len(cleaned) > 80 or key in seen:
                continue
            seen.add(key)
            output.append(cleaned)
    return output


def _best_competency_evidence(term: str, evidence_items: list[Any]) -> Any | None:
    candidates = [
        item
        for item in evidence_items
        if item.source in {"resume", "both"} and item.evidence.strip()
    ]
    if not candidates:
        return None
    ranked = sorted(
        ((_term_similarity(term, item.name), item) for item in candidates),
        key=lambda pair: pair[0],
        reverse=True,
    )
    return ranked[0][1] if ranked[0][0] >= 0.5 else None


def _resume_evidence_text(evidence: str) -> str:
    text = re.sub(r"\s+", " ", evidence).strip()
    resume_match = re.search(r"(?:Resume|Candidate)\s*:\s*(.*?)(?:\s+(?:Job|Role)\s*:|$)", text, re.IGNORECASE)
    return (resume_match.group(1) if resume_match else text)[:240]


def _validated_excerpt(text: str, excerpt: str) -> str:
    cleaned = excerpt.strip().strip("\"'“”")
    if not cleaned:
        return ""
    direct = text.casefold().find(cleaned.casefold())
    if direct >= 0:
        return text[direct:direct + len(cleaned)]
    pattern = re.escape(cleaned)
    pattern = re.sub(r"(?:\\\s)+", r"\\s+", pattern)
    found = re.search(pattern, text, re.IGNORECASE)
    return found.group(0) if found else ""


def _openai_match_payload(resume_text: str, analysis: Any) -> dict[str, Any]:
    level_values = {"strong": 1.0, "related": 0.82, "transferable": 0.62, "missing": 0.0}
    validated: list[dict[str, Any]] = []

    for item in analysis.requirements:
        match_level = item.match_level
        resume_evidence = _validated_excerpt(resume_text, item.resume_evidence)
        if match_level != "missing" and not resume_evidence:
            match_level = "missing"
        validated.append(
            {
                "requirement": _canonical_term(item.requirement),
                "category": item.category,
                "priority": item.priority,
                "match_level": match_level,
                "confidence": item.confidence,
                "jd_evidence": item.jd_evidence.strip()[:240],
                "resume_evidence": resume_evidence[:240],
                "rationale": item.rationale.strip(),
                "recommendation": item.recommendation.strip(),
            }
        )

    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in validated:
        key = item["requirement"].casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    denominator = sum(2 if item["priority"] == "essential" else 1 for item in deduped)
    earned = sum(
        (2 if item["priority"] == "essential" else 1) * level_values[item["match_level"]]
        for item in deduped
    )
    score = round((earned / denominator) * 100) if denominator else 0

    matched_items = [item for item in deduped if item["match_level"] != "missing"]
    missing_items = [item for item in deduped if item["match_level"] == "missing"]
    matched = [item["requirement"] for item in matched_items]
    missing = [item["requirement"] for item in missing_items]
    matched_qualities = [item["requirement"] for item in matched_items if item["category"] == "quality"]
    missing_qualities = [item["requirement"] for item in missing_items if item["category"] == "quality"]
    matched_technical = [item["requirement"] for item in matched_items if item["category"] != "quality"]
    missing_technical = [item["requirement"] for item in missing_items if item["category"] != "quality"]

    gap_items = [
        {
            "skill": item["requirement"],
            "priority": "high" if item["priority"] == "essential" else "medium",
            "actions": [
                item["recommendation"],
                f"Build or extend one project that demonstrates {item['requirement']} in a role-relevant context.",
                "Prepare a concise explanation of your approach, trade-offs, and measurable outcome.",
            ],
            "resume_action": (
                f"Add {item['requirement']} only after you can support it with truthful project, coursework, "
                "or experience evidence."
            ),
            "resource": next(iter(resources_for([item["requirement"]])), None),
        }
        for item in missing_items[:8]
    ]

    return {
        "summary": analysis.summary,
        "alignment_score": min(max(score, 0), 100),
        "matched_skills": matched,
        "missing_skills": missing,
        "matched_technical_skills": matched_technical,
        "missing_technical_skills": missing_technical,
        "matched_qualities": matched_qualities,
        "missing_qualities": missing_qualities,
        "resume_skills": _unique_terms(extract_skills(resume_text), matched),
        "required_skills": [item["requirement"] for item in deduped],
        "evidence": [
            {
                "skill": item["requirement"],
                "snippet": item["resume_evidence"],
                "reason": (
                    f"{item['match_level'].capitalize()} OpenAI match ({item['confidence']}% classification "
                    f"confidence): {item['rationale']}"
                ),
            }
            for item in matched_items
        ],
        "match_details": deduped,
        "gap_analysis": analysis.gap_analysis,
        "improvement_suggestions": analysis.improvement_suggestions[:8],
        "gap_recommendations": gap_items,
        "resource_links": resources_for(missing or matched_technical[:4]),
        "matching_method": "openai_structured",
        "disclaimer": (
            "Alignment measures document evidence against this job description. It does not measure candidate "
            "quality, verify proficiency, or make a hiring decision."
        ),
    }


def _sentence_snippet(text: str, start: int, end: int, limit: int = 240) -> str:
    left = max(text.rfind("\n", 0, start), text.rfind(".", 0, start)) + 1
    newline = text.find("\n", end)
    period = text.find(".", end)
    candidates = [value for value in (newline, period + 1 if period >= 0 else -1) if value >= 0]
    right = min(candidates) if candidates else min(len(text), end + 140)
    snippet = re.sub(r"\s+", " ", text[left:right]).strip(" -•\t")
    return snippet[:limit]


def match_resume(resume_text: str, required_skills: list[str]) -> list[Match]:
    matches: list[Match] = []
    for skill in required_skills:
        for alias in SKILL_ALIASES.get(skill, (skill,)):
            found = re.search(_pattern(alias), resume_text, re.IGNORECASE)
            if found:
                matches.append(
                    Match(
                        skill=skill,
                        snippet=_sentence_snippet(resume_text, found.start(), found.end()),
                        reason="Required skill found in the resume's skills, project, coursework, or experience evidence.",
                    )
                )
                break
    return matches


def resources_for(skills: list[str]) -> list[dict[str, str]]:
    output: list[dict[str, str]] = []
    seen: set[str] = set()

    def add(skill: str, resource: tuple[str, str]) -> None:
        if resource[1] in seen:
            return
        seen.add(resource[1])
        output.append(
            {
                "skill": skill,
                "title": resource[0],
                "url": resource[1],
                "description": f"Use this guided resource to build truthful, role-relevant evidence for {skill}.",
            }
        )

    for skill in skills:
        resource = RESOURCE_CATALOG.get(skill)
        if resource:
            add(skill, resource)

        searchable = f" {skill.casefold()} "
        for keywords, resources in RESOURCE_RULES:
            if any(keyword in searchable for keyword in keywords):
                for matched_resource in resources:
                    add(skill, matched_resource)

    if not output and skills:
        add(
            skills[0],
            (
                "Coursera skill courses",
                f"https://www.coursera.org/search?query={skills[0].replace(' ', '%20')}",
            ),
        )
    return output[:12]


def gap_recommendations(skills: list[str]) -> list[dict[str, Any]]:
    resources = {item["skill"]: item for item in resources_for(skills)}
    return [
        {
            "skill": skill,
            "priority": "high" if index < 2 else "medium",
            "actions": [
                f"Learn the core concepts and common interview questions for {skill}.",
                f"Build one small, focused project that demonstrates practical use of {skill}.",
                "Practice explaining your approach, trade-offs, and results in two minutes.",
            ],
            "resume_action": (
                f"Once you have truthful evidence, add a concise project or experience bullet showing how you used {skill}."
            ),
            "resource": resources.get(skill),
        }
        for index, skill in enumerate(skills[:8])
    ]


def build_resume_preview(
    resume_text: str,
    matched_skills: list[str],
    evidence: list[dict[str, str]] | None = None,
    limit: int = 16_000,
) -> dict[str, Any]:
    """Build an ephemeral preview. This object must never be stored in ResumeAnalysisRecord."""
    text = resume_text.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n").strip()
    text = text[:limit]
    candidates: list[dict[str, Any]] = []
    for item in evidence or []:
        excerpt = _validated_excerpt(text, item.get("snippet", ""))
        if not excerpt:
            continue
        start = text.casefold().find(excerpt.casefold())
        if start >= 0:
            candidates.append(
                {
                    "skill": item.get("skill", "Matched evidence"),
                    "start": start,
                    "end": start + len(excerpt),
                }
            )
    for skill in matched_skills:
        for alias in SKILL_ALIASES.get(skill, (skill,)):
            for found in re.finditer(_pattern(alias), text, re.IGNORECASE):
                candidates.append(
                    {
                        "skill": skill,
                        "start": found.start(),
                        "end": found.end(),
                    }
                )

    candidates.sort(key=lambda item: (item["start"], -(item["end"] - item["start"])))
    highlights: list[dict[str, Any]] = []
    last_end = -1
    for item in candidates:
        if item["start"] < last_end:
            continue
        highlights.append(item)
        last_end = item["end"]

    return {
        "text": text,
        "highlights": highlights,
        "truncated": len(resume_text.strip()) > len(text),
    }


def analyze_resume(resume_text: str, jd_text: str, ai: AIProvider) -> tuple[dict[str, Any], str]:
    requirements_text = extract_requirements_text(jd_text)
    match_method = getattr(ai, "resume_job_match", None)
    if callable(match_method):
        openai_analysis, match_provider = match_method(resume_text, requirements_text)
        if openai_analysis is not None:
            return _openai_match_payload(resume_text, openai_analysis), match_provider

    competency, provider = ai.competency_map(resume_text, requirements_text)
    local_required = extract_skills(requirements_text, requirements=True)
    ai_overlaps = _unique_terms(competency.overlapping_skills)
    ai_missing = _unique_terms(competency.missing_skills)
    # The AI competency map has already classified requirements into overlaps and gaps.
    # Using every raw extracted phrase as an equal denominator produced duplicate,
    # vague requirements and discarded semantically equivalent evidence.
    required = _unique_terms(ai_overlaps, ai_missing, local_required)
    resume_skills = _unique_terms(extract_skills(resume_text), competency.resume_skills)
    evidence = match_resume(resume_text, required)
    matched_lookup = {item.skill.casefold() for item in evidence}

    for overlap in ai_overlaps:
        required_skill = next(
            (item for item in required if _term_similarity(item, overlap) >= 0.82),
            overlap,
        )
        grounded = _best_competency_evidence(overlap, competency.evidence)
        if grounded and required_skill.casefold() not in matched_lookup:
            evidence.append(
                Match(
                    skill=required_skill,
                    snippet=_resume_evidence_text(grounded.evidence),
                    reason="Source-linked analysis connected this resume evidence to a semantically equivalent role requirement.",
                )
            )
            matched_lookup.add(required_skill.casefold())

    matched = [skill for skill in required if skill.casefold() in matched_lookup]
    missing = [skill for skill in required if skill.casefold() not in matched_lookup]
    matched_qualities = [skill for skill in matched if _is_quality(skill)]
    missing_qualities = [skill for skill in missing if _is_quality(skill)]
    matched_technical = [skill for skill in matched if not _is_quality(skill)]
    missing_technical = [skill for skill in missing if not _is_quality(skill)]
    score = round((len(set(matched)) / len(required)) * 100) if required else 0

    suggestions = [
        "Move the most role-relevant technical skills near the top of the resume.",
        "Connect project bullets to a concrete decision, measurable result, or scale.",
    ]
    suggestions.extend(f"If truthful, add project or coursework evidence for {skill}." for skill in missing[:2])
    payload = {
        "summary": (
            f"This document alignment review found evidence for {len(matched)} of "
            f"{len(required)} recognized role requirements."
        ),
        "alignment_score": min(score, 100),
        "matched_skills": matched,
        "missing_skills": missing,
        "matched_technical_skills": matched_technical,
        "missing_technical_skills": missing_technical,
        "matched_qualities": matched_qualities,
        "missing_qualities": missing_qualities,
        "resume_skills": resume_skills,
        "required_skills": required,
        "evidence": [
            {"skill": item.skill, "snippet": item.snippet, "reason": item.reason}
            for item in evidence[:30]
        ],
        "gap_analysis": (
            "Prioritize the missing requirements that appear repeatedly in the role description. "
            "Only add them to the resume when supported by truthful experience, projects, or coursework."
            if missing
            else "The local matcher found coverage for every recognized requirement; strengthen the evidence with outcomes."
        ),
        "improvement_suggestions": suggestions[:4],
        "gap_recommendations": gap_recommendations(missing),
        "resource_links": resources_for(missing or required[:4]),
        "competency_snapshot": competency.model_dump(mode="json"),
        "disclaimer": "Alignment measures document coverage only, not candidate quality or hiring suitability.",
    }
    return payload, provider
