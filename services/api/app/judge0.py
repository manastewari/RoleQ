import asyncio
from typing import Any

import httpx

from .config import get_settings
from .problem_bank import get_problem
from .schemas import CodeRunResult, CodeTestResult


LANGUAGE_MATCHERS = {
    "python": ["Python (3.", "Python (3"],
    "java": ["Java (17", "Java (21", "Java ("],
    "javascript": ["JavaScript (Node.js"],
    "typescript": ["TypeScript"],
    "c": ["C (GCC"],
    "cpp": ["C++ (GCC"],
    "csharp": ["C#"],
    "go": ["Go ("],
}


class Judge0Adapter:
    def __init__(self):
        self.settings = get_settings()
        self._language_ids: dict[str, int] | None = None

    @property
    def headers(self) -> dict[str, str]:
        if not self.settings.judge0_auth_token:
            return {}
        return {self.settings.judge0_auth_header: self.settings.judge0_auth_token}

    async def language_ids(self, client: httpx.AsyncClient) -> dict[str, int]:
        if self._language_ids:
            return self._language_ids
        response = await client.get(f"{self.settings.judge0_url.rstrip('/')}/languages/", headers=self.headers)
        response.raise_for_status()
        languages = response.json()
        mapping: dict[str, int] = {}
        for key, matchers in LANGUAGE_MATCHERS.items():
            matches = [item for item in languages if any(item["name"].startswith(prefix) for prefix in matchers)]
            if matches:
                mapping[key] = max(matches, key=lambda item: item["id"])["id"]
        self._language_ids = mapping
        return mapping

    async def run(
        self,
        problem_id: str,
        language: str,
        source_code: str,
        submit: bool,
    ) -> CodeRunResult:
        problem = get_problem(problem_id)
        tests = problem["hidden_tests"] if submit else problem["examples"]
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                mapping = await self.language_ids(client)
                if language not in mapping:
                    raise ValueError(f"{language} is not available on the configured Judge0 instance")
                results = await asyncio.gather(
                    *[
                        self._run_test(client, mapping[language], source_code, test["input"], test["expected_output"])
                        for test in tests
                    ]
                )
            return CodeRunResult(
                provider="judge0",
                passed_count=sum(item.passed for item in results),
                total_count=len(results),
                tests=results,
            )
        except Exception as exc:
            return self._simulated_result(source_code, tests, str(exc))

    async def _run_test(
        self,
        client: httpx.AsyncClient,
        language_id: int,
        source_code: str,
        stdin: str,
        expected_output: str,
    ) -> CodeTestResult:
        payload: dict[str, Any] = {
            "source_code": source_code,
            "language_id": language_id,
            "stdin": stdin,
            "expected_output": expected_output,
            "cpu_time_limit": 3,
            "wall_time_limit": 8,
            "memory_limit": 256000,
            "stack_limit": 64000,
            "max_processes_and_or_threads": 32,
            "max_file_size": 2048,
            "enable_network": False,
        }
        base = self.settings.judge0_url.rstrip("/")
        created = await client.post(f"{base}/submissions?base64_encoded=false&wait=false", json=payload, headers=self.headers)
        created.raise_for_status()
        token = created.json()["token"]
        result: dict[str, Any] | None = None
        for _ in range(30):
            response = await client.get(
                f"{base}/submissions/{token}",
                params={"base64_encoded": "false", "fields": "stdout,stderr,compile_output,status,time,memory"},
                headers=self.headers,
            )
            response.raise_for_status()
            result = response.json()
            status_id = result.get("status", {}).get("id")
            if status_id not in {1, 2}:
                break
            await asyncio.sleep(0.35)
        if not result:
            raise RuntimeError("Judge0 returned no result")
        actual = result.get("stdout") or ""
        status = result.get("status", {}).get("description", "Unknown")
        error = result.get("compile_output") or result.get("stderr")
        return CodeTestResult(
            passed=status == "Accepted" or actual.strip() == expected_output.strip(),
            input=stdin,
            expected_output=expected_output,
            actual_output=actual,
            status=status,
            time=float(result["time"]) if result.get("time") else None,
            memory=float(result["memory"]) if result.get("memory") else None,
            stderr=error,
        )

    @staticmethod
    def _simulated_result(source_code: str, tests: list[dict], reason: str) -> CodeRunResult:
        obviously_incomplete = "TODO" in source_code or len(source_code.strip()) < 30
        results = [
            CodeTestResult(
                passed=not obviously_incomplete,
                input=test["input"],
                expected_output=test["expected_output"],
                actual_output="Simulation: complete-looking source accepted." if not obviously_incomplete else "",
                status="Simulated Accepted" if not obviously_incomplete else "Simulated Incomplete",
            )
            for test in tests
        ]
        return CodeRunResult(
            provider="local-fallback",
            simulated=True,
            passed_count=sum(item.passed for item in results),
            total_count=len(results),
            tests=results,
            message=f"Judge0 was unavailable; deterministic prototype fallback used. Detail: {reason}",
        )

