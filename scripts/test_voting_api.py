#!/usr/bin/env python3
"""
Smoke-test the voting API by submitting one ballot and checking that results
read it back correctly.

Example:
  python3 scripts/test_voting_api.py --password admin123

This script uses API endpoints only. It logs in as admin, picks a class with at
least one male and one female candidate unless explicit names are provided,
submits one kiosk vote, then verifies totals and candidate counts increment.
"""

from __future__ import annotations

import argparse
import getpass
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from typing import Any


SCHOOL_CLASSES = [
    f"Class {grade}{section}"
    for grade in range(5, 13)
    for section in ("A", "B", "C")
]


class ApiError(RuntimeError):
    def __init__(
        self,
        message: str,
        status: int | None = None,
        response_text: str = "",
    ) -> None:
        super().__init__(message)
        self.status = status
        self.response_text = response_text

    @property
    def is_transient_next_dev_error(self) -> bool:
        if self.status != 500:
            return False

        return (
            "loadManifest" in self.response_text
            or "Unexpected end of JSON input" in self.response_text
        )


class ApiClient:
    def __init__(self, base_url: str, retries: int = 3, retry_delay: float = 0.35) -> None:
        self.base_url = base_url.rstrip("/")
        self.retries = retries
        self.retry_delay = retry_delay
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(CookieJar())
        )

    def request(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        body = None
        headers = {"Accept": "application/json"}

        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(
            url,
            data=body,
            headers=headers,
            method=method,
        )

        for attempt in range(self.retries + 1):
            try:
                with self.opener.open(request, timeout=15) as response:
                    text = response.read().decode("utf-8")
                    return json.loads(text) if text else {}
            except urllib.error.HTTPError as error:
                text = error.read().decode("utf-8", errors="replace")
                try:
                    payload = json.loads(text)
                except json.JSONDecodeError:
                    summary = "non-JSON response"
                    if "Unexpected end of JSON input" in text:
                        summary = "Next dev server manifest parse error"
                    payload = {"error": summary}

                api_error = ApiError(
                    f"{method} {path} failed with HTTP {error.code}: {payload}",
                    status=error.code,
                    response_text=text,
                )
                if api_error.is_transient_next_dev_error and attempt < self.retries:
                    print(
                        f"retry {attempt + 1}/{self.retries}: transient Next dev 500 "
                        f"from {method} {path}",
                        file=sys.stderr,
                        flush=True,
                    )
                    time.sleep(self.retry_delay * (attempt + 1))
                    continue
                raise api_error from error
            except urllib.error.URLError as error:
                if attempt < self.retries:
                    print(
                        f"retry {attempt + 1}/{self.retries}: connection error "
                        f"from {method} {path}: {error.reason}",
                        file=sys.stderr,
                        flush=True,
                    )
                    time.sleep(self.retry_delay * (attempt + 1))
                    continue
                raise ApiError(f"{method} {path} failed: {error.reason}") from error

        raise ApiError(f"{method} {path} failed after retries")

    def get(self, path: str) -> dict[str, Any]:
        return self.request("GET", path)

    def post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self.request("POST", path, payload)


def candidate_vote_count(
    results_payload: dict[str, Any],
    class_name: str,
    gender_key: str,
    candidate_name: str,
) -> int:
    for class_result in results_payload.get("results", []):
        if class_result.get("class_name") != class_name:
            continue

        for candidate in class_result.get(gender_key, []):
            if candidate.get("name") == candidate_name:
                return int(candidate.get("votes", 0))

    return 0


def class_total(results_payload: dict[str, Any], class_name: str) -> int:
    for class_result in results_payload.get("results", []):
        if class_result.get("class_name") == class_name:
            return int(class_result.get("total_votes", 0))

    return 0


def pick_ballot(
    client: ApiClient,
    class_name: str | None,
    male_name: str | None,
    female_name: str | None,
) -> tuple[str, str, str]:
    if class_name and male_name and female_name:
        return class_name, male_name, female_name

    classes_to_try = [class_name] if class_name else SCHOOL_CLASSES

    for current_class in classes_to_try:
        if not current_class:
            continue

        query = urllib.parse.urlencode({"class_name": current_class})
        state = client.get(f"/api/kiosk/state?{query}")
        candidates = state.get("candidates", [])
        males = [candidate for candidate in candidates if candidate.get("gender") == "Male"]
        females = [
            candidate for candidate in candidates if candidate.get("gender") == "Female"
        ]

        selected_male = male_name or (males[0].get("name") if males else None)
        selected_female = female_name or (females[0].get("name") if females else None)

        has_selected_male = any(candidate.get("name") == selected_male for candidate in males)
        has_selected_female = any(
            candidate.get("name") == selected_female for candidate in females
        )

        if selected_male and selected_female and has_selected_male and has_selected_female:
            return current_class, selected_male, selected_female

    raise ApiError(
        "Could not find a class with the requested candidates. "
        "Pass --class-name, --male, and --female explicitly."
    )


def assert_increment(label: str, before: int, after: int) -> None:
    if after != before + 1:
        raise AssertionError(f"{label}: expected {before + 1}, got {after}")


def run(args: argparse.Namespace) -> None:
    password = args.password or getpass.getpass("Admin password: ")
    client = ApiClient(args.base_url)

    client.post("/api/admin/login", {"password": password})

    class_name, male_name, female_name = pick_ballot(
        client,
        args.class_name,
        args.male,
        args.female,
    )
    before = client.get("/api/admin/results")

    submit_payload = {
        "class_name": class_name,
        "ballot": f"{male_name}|{female_name}",
    }
    submit_result = client.post("/api/kiosk/submit-vote", submit_payload)
    if submit_result.get("ok") is not True:
        raise AssertionError(f"Vote submit response was not ok: {submit_result}")

    after = client.get("/api/admin/results")

    assert_increment("total_votes", int(before.get("total_votes", 0)), int(after.get("total_votes", 0)))
    assert_increment("valid_votes", int(before.get("valid_votes", 0)), int(after.get("valid_votes", 0)))
    assert_increment("class total", class_total(before, class_name), class_total(after, class_name))
    assert_increment(
        f"male candidate {male_name}",
        candidate_vote_count(before, class_name, "male", male_name),
        candidate_vote_count(after, class_name, "male", male_name),
    )
    assert_increment(
        f"female candidate {female_name}",
        candidate_vote_count(before, class_name, "female", female_name),
        candidate_vote_count(after, class_name, "female", female_name),
    )

    print("PASS: voting API submitted and read back one ballot correctly.")
    print(f"  class: {class_name}")
    print(f"  ballot: {male_name}|{female_name}")
    print(f"  vote_id: {submit_result.get('vote_id')}")
    print(f"  total_votes: {before.get('total_votes', 0)} -> {after.get('total_votes', 0)}")
    print(f"  valid_votes: {before.get('valid_votes', 0)} -> {after.get('valid_votes', 0)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Submit one test vote through kiosk APIs and verify admin results "
            "read the new vote correctly."
        )
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:3000",
        help="Base URL for the running Next.js app. Default: http://localhost:3000",
    )
    parser.add_argument(
        "--password",
        help="Admin password. If omitted, the script prompts securely.",
    )
    parser.add_argument(
        "--class-name",
        help="Class to vote in, for example 'Class 5A'. Defaults to the first usable class.",
    )
    parser.add_argument(
        "--male",
        help="Male candidate name. Defaults to the first male candidate in the class.",
    )
    parser.add_argument(
        "--female",
        help="Female candidate name. Defaults to the first female candidate in the class.",
    )
    return parser.parse_args()


def main() -> int:
    try:
        run(parse_args())
    except (ApiError, AssertionError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
