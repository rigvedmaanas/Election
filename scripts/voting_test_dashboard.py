#!/usr/bin/env python3
"""
API test dashboard for the election app.

Examples:
  python3 scripts/voting_test_dashboard.py --password admin123
  python3 scripts/voting_test_dashboard.py --password admin123 --include-vote-test --clear votes --confirm-clear
  python3 scripts/voting_test_dashboard.py --password admin123 --clear database --confirm-clear
  python3 scripts/voting_test_dashboard.py --password admin123 --mock-elections 20 --mock-votes 50 --confirm-clear
  python3 scripts/voting_test_dashboard.py --password admin123 --elections 20 --votes-per-election 50 --confirm-clear

All checks and resets use HTTP API endpoints only.
"""

from __future__ import annotations

import argparse
import base64
import getpass
import json
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from test_voting_api import (
    ApiClient,
    ApiError,
    SCHOOL_CLASSES,
    assert_increment,
    candidate_vote_count,
    class_total,
    pick_ballot,
)


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


MOCK_IMAGE_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB"
    "/6XfX8sAAAAASUVORK5CYII="
)


def format_count(value: Any) -> int:
    return int(value or 0)


def run_check(name: str, check: Callable[[], str]) -> CheckResult:
    try:
        return CheckResult(name=name, ok=True, detail=check())
    except Exception as error:
        return CheckResult(name=name, ok=False, detail=str(error))


def login_check(client: ApiClient, password: str) -> str:
    payload = client.post("/api/admin/login", {"password": password})
    if payload.get("ok") is not True:
        raise AssertionError(f"Unexpected login response: {payload}")
    return "admin login accepted"


def protected_admin_check(base_url: str) -> str:
    anonymous_client = ApiClient(base_url)
    try:
        anonymous_client.get("/api/admin/results")
    except ApiError as error:
        if "HTTP 401" in str(error):
            return "anonymous admin results request was rejected"
        raise

    raise AssertionError("anonymous admin results request was not rejected")


def results_shape_check(client: ApiClient) -> str:
    payload = client.get("/api/admin/results")
    required_keys = {"total_votes", "valid_votes", "invalid_ballots", "results"}
    missing = sorted(required_keys - set(payload))
    if missing:
        raise AssertionError(f"Missing result keys: {', '.join(missing)}")
    if not isinstance(payload.get("results"), list):
        raise AssertionError("results is not a list")

    return (
        f"total={payload['total_votes']}, "
        f"valid={payload['valid_votes']}, "
        f"invalid={payload['invalid_ballots']}"
    )


def kiosk_state_check(client: ApiClient, class_name: str | None) -> str:
    target_class = class_name or SCHOOL_CLASSES[0]
    query = urllib.parse.urlencode({"class_name": target_class})
    payload = client.get(f"/api/kiosk/state?{query}")
    if payload.get("class_name") != target_class:
        raise AssertionError(f"Unexpected class_name in response: {payload}")
    if not isinstance(payload.get("candidates"), list):
        raise AssertionError("candidates is not a list")

    return f"{target_class} has {len(payload['candidates'])} candidates"


def invalid_class_check(client: ApiClient) -> str:
    query = urllib.parse.urlencode({"class_name": "Definitely Not A Class"})
    try:
        client.get(f"/api/kiosk/state?{query}")
    except ApiError as error:
        if "HTTP 400" in str(error):
            return "invalid class was rejected"
        raise

    raise AssertionError("invalid class was not rejected")


def invalid_ballot_check(client: ApiClient, class_name: str | None) -> str:
    target_class = class_name or SCHOOL_CLASSES[0]
    try:
        client.post(
            "/api/kiosk/submit-vote",
            {"class_name": target_class, "ballot": "not-a-valid-ballot"},
        )
    except ApiError as error:
        if "HTTP 400" in str(error):
            return "invalid ballot format was rejected"
        raise

    raise AssertionError("invalid ballot format was not rejected")


def vote_readback_check(
    client: ApiClient,
    class_name: str | None,
    male_name: str | None,
    female_name: str | None,
) -> str:
    selected_class, selected_male, selected_female = pick_ballot(
        client,
        class_name,
        male_name,
        female_name,
    )
    before = client.get("/api/admin/results")
    submit_result = client.post(
        "/api/kiosk/submit-vote",
        {
            "class_name": selected_class,
            "ballot": f"{selected_male}|{selected_female}",
        },
    )
    if submit_result.get("ok") is not True:
        raise AssertionError(f"Vote submit response was not ok: {submit_result}")

    after = client.get("/api/admin/results")
    assert_increment(
        "total_votes",
        format_count(before.get("total_votes")),
        format_count(after.get("total_votes")),
    )
    assert_increment(
        "valid_votes",
        format_count(before.get("valid_votes")),
        format_count(after.get("valid_votes")),
    )
    assert_increment(
        "class total",
        class_total(before, selected_class),
        class_total(after, selected_class),
    )
    assert_increment(
        f"male candidate {selected_male}",
        candidate_vote_count(before, selected_class, "male", selected_male),
        candidate_vote_count(after, selected_class, "male", selected_male),
    )
    assert_increment(
        f"female candidate {selected_female}",
        candidate_vote_count(before, selected_class, "female", selected_female),
        candidate_vote_count(after, selected_class, "female", selected_female),
    )

    return (
        f"vote_id={submit_result.get('vote_id')} "
        f"{selected_class}: {selected_male}|{selected_female}"
    )


def reset_check(client: ApiClient, mode: str, password: str) -> str:
    payload = client.post("/api/admin/reset", {"mode": mode, "password": password})
    if payload.get("ok") is not True:
        raise AssertionError(f"Unexpected reset response: {payload}")

    results = client.get("/api/admin/results")
    if mode in {"votes", "database"} and format_count(results.get("total_votes")) != 0:
        raise AssertionError(f"Votes were not cleared: {results}")
    if mode == "database" and results.get("results") != []:
        raise AssertionError(f"Database still has result rows: {results}")

    return f"{mode} reset completed"


def multipart_post(
    client: ApiClient,
    path: str,
    fields: dict[str, str],
    files: dict[str, tuple[str, str, bytes]],
) -> dict[str, Any]:
    boundary = f"----ElectionBoundary{random.randrange(10**12)}"
    chunks: list[bytes] = []

    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                value.encode("utf-8"),
                b"\r\n",
            ]
        )

    for name, (filename, content_type, data) in files.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                (
                    f'Content-Disposition: form-data; name="{name}"; '
                    f'filename="{filename}"\r\n'
                ).encode("utf-8"),
                f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"),
                data,
                b"\r\n",
            ]
        )

    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(chunks)
    request = urllib.request.Request(
        f"{client.base_url}{path}",
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )

    for attempt in range(client.retries + 1):
        try:
            with client.opener.open(request, timeout=30) as response:
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
                f"POST {path} multipart failed with HTTP {error.code}: {payload}",
                status=error.code,
                response_text=text,
            )
            if api_error.is_transient_next_dev_error and attempt < client.retries:
                print(
                    f"retry {attempt + 1}/{client.retries}: transient Next dev 500 "
                    f"from POST {path} multipart",
                    file=sys.stderr,
                    flush=True,
                )
                time.sleep(client.retry_delay * (attempt + 1))
                continue
            raise api_error from error
        except urllib.error.URLError as error:
            if attempt < client.retries:
                print(
                    f"retry {attempt + 1}/{client.retries}: connection error "
                    f"from POST {path} multipart: {error.reason}",
                    file=sys.stderr,
                    flush=True,
                )
                time.sleep(client.retry_delay * (attempt + 1))
                continue
            raise ApiError(f"POST {path} multipart failed: {error.reason}") from error

    raise ApiError(f"POST {path} multipart failed after retries")


def create_candidate(
    client: ApiClient,
    class_name: str,
    gender: str,
    name: str,
) -> None:
    payload = multipart_post(
        client,
        "/api/admin/candidates",
        {"name": name, "class_name": class_name, "gender": gender},
        {"image": (f"{name.lower().replace(' ', '-')}.png", "image/png", MOCK_IMAGE_BYTES)},
    )
    if "candidate" not in payload:
        raise AssertionError(f"Unexpected candidate create response: {payload}")


def seed_mock_candidates(
    client: ApiClient,
    classes: list[str],
    candidates_per_gender: int,
    election_number: int,
) -> dict[str, dict[str, list[str]]]:
    seeded: dict[str, dict[str, list[str]]] = {}

    for class_name in classes:
        seeded[class_name] = {"Male": [], "Female": []}
        class_token = class_name.replace(" ", "")

        for index in range(1, candidates_per_gender + 1):
            male_name = f"Mock.E{election_number} {class_token} Male {index}"
            female_name = f"Mock.E{election_number} {class_token} Female {index}"
            create_candidate(client, class_name, "Male", male_name)
            create_candidate(client, class_name, "Female", female_name)
            seeded[class_name]["Male"].append(male_name)
            seeded[class_name]["Female"].append(female_name)

    return seeded


def verify_mock_results(
    client: ApiClient,
    expected: dict[tuple[str, str, str], int],
    expected_class_totals: dict[str, int],
    expected_total_votes: int,
) -> None:
    payload = client.get("/api/admin/results")
    total_votes = format_count(payload.get("total_votes"))
    valid_votes = format_count(payload.get("valid_votes"))
    invalid_ballots = format_count(payload.get("invalid_ballots"))

    if total_votes != expected_total_votes:
        raise AssertionError(f"total_votes expected {expected_total_votes}, got {total_votes}")
    if valid_votes != expected_total_votes:
        raise AssertionError(f"valid_votes expected {expected_total_votes}, got {valid_votes}")
    if invalid_ballots != 0:
        raise AssertionError(f"invalid_ballots expected 0, got {invalid_ballots}")

    for class_name, expected_total in expected_class_totals.items():
        actual_total = class_total(payload, class_name)
        if actual_total != expected_total:
            raise AssertionError(
                f"{class_name} total expected {expected_total}, got {actual_total}"
            )

    for (class_name, gender, name), expected_votes in expected.items():
        gender_key = "male" if gender == "Male" else "female"
        actual_votes = candidate_vote_count(payload, class_name, gender_key, name)
        if actual_votes != expected_votes:
            raise AssertionError(
                f"{class_name} {name} expected {expected_votes}, got {actual_votes}"
            )


def run_mock_election(
    client: ApiClient,
    password: str,
    election_number: int,
    classes: list[str],
    candidates_per_gender: int,
    vote_count: int,
    rng: random.Random,
    request_delay: float,
    progress_every: int,
) -> str:
    print(f"  election {election_number}: clearing database", flush=True)
    reset_check(client, "database", password)
    print(
        f"  election {election_number}: creating "
        f"{len(classes) * candidates_per_gender * 2} mock candidates",
        flush=True,
    )
    seeded = seed_mock_candidates(client, classes, candidates_per_gender, election_number)
    expected: dict[tuple[str, str, str], int] = {}
    expected_class_totals = {class_name: 0 for class_name in classes}

    for class_name in classes:
        for gender in ("Male", "Female"):
            for name in seeded[class_name][gender]:
                expected[(class_name, gender, name)] = 0

    print(f"  election {election_number}: casting {vote_count} votes", flush=True)
    for vote_number in range(1, vote_count + 1):
        class_name = rng.choice(classes)
        male_name = rng.choice(seeded[class_name]["Male"])
        female_name = rng.choice(seeded[class_name]["Female"])
        payload = client.post(
            "/api/kiosk/submit-vote",
            {"class_name": class_name, "ballot": f"{male_name}|{female_name}"},
        )
        if payload.get("ok") is not True:
            raise AssertionError(f"Unexpected vote response: {payload}")

        expected[(class_name, "Male", male_name)] += 1
        expected[(class_name, "Female", female_name)] += 1
        expected_class_totals[class_name] += 1
        if progress_every and (
            vote_number == 1
            or vote_number == vote_count
            or vote_number % progress_every == 0
        ):
            print(
                f"  election {election_number}: vote {vote_number}/{vote_count} "
                f"ok ({class_name}: {male_name}|{female_name})",
                flush=True,
            )
        if request_delay:
            time.sleep(request_delay)

    print(f"  election {election_number}: verifying API results", flush=True)
    verify_mock_results(client, expected, expected_class_totals, vote_count)
    print(f"  election {election_number}: tally verified", flush=True)
    return f"{vote_count} votes across {len(classes)} class(es)"


def run_mock_elections(
    client: ApiClient,
    password: str,
    election_count: int,
    classes: list[str],
    candidates_per_gender: int,
    vote_count: int,
    seed: int,
    request_delay: float,
    progress_every: int,
) -> list[CheckResult]:
    rng = random.Random(seed)
    results: list[CheckResult] = []

    print(
        f"Conducting {election_count} independent mock election"
        f"{'' if election_count == 1 else 's'} "
        f"({vote_count} votes each, {len(classes)} class"
        f"{'' if len(classes) == 1 else 'es'}, seed={seed})",
        flush=True,
    )
    print()

    for election_number in range(1, election_count + 1):
        results.append(
            run_check(
                f"mock election {election_number}",
                lambda election_number=election_number: run_mock_election(
                    client,
                    password,
                    election_number,
                    classes,
                    candidates_per_gender,
                    vote_count,
                    rng,
                    request_delay,
                    progress_every,
                ),
            )
        )
        if not results[-1].ok:
            break

    return results


def print_results(results: list[CheckResult]) -> None:
    width = max(len(result.name) for result in results) if results else 0
    for result in results:
        status = "PASS" if result.ok else "FAIL"
        print(f"[{status}] {result.name.ljust(width)}  {result.detail}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run election API checks and optionally clear votes/candidates/database."
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
        help="Class to use for kiosk checks, for example 'Class 5A'.",
    )
    parser.add_argument(
        "--male",
        help="Male candidate name for --include-vote-test.",
    )
    parser.add_argument(
        "--female",
        help="Female candidate name for --include-vote-test.",
    )
    parser.add_argument(
        "--include-vote-test",
        action="store_true",
        help="Submit one real vote and verify it is read back correctly.",
    )
    parser.add_argument(
        "--clear",
        choices=["none", "votes", "candidates", "database"],
        default="none",
        help="Clear data through /api/admin/reset after checks. Default: none.",
    )
    parser.add_argument(
        "--confirm-clear",
        action="store_true",
        help="Required when --clear is not none.",
    )
    parser.add_argument(
        "--mock-elections",
        "--elections",
        dest="mock_elections",
        type=int,
        default=0,
        help="Run this many full mock elections. Each one resets the database first.",
    )
    parser.add_argument(
        "--mock-votes",
        "--votes-per-election",
        dest="mock_votes",
        type=int,
        default=50,
        help="Votes to cast in each mock election. Default: 50.",
    )
    parser.add_argument(
        "--mock-class-count",
        type=int,
        default=3,
        help="Number of classes to seed when --class-name is not set. Default: 3.",
    )
    parser.add_argument(
        "--mock-candidates-per-gender",
        type=int,
        default=2,
        help="Male and female candidates to create per mock class. Default: 2.",
    )
    parser.add_argument(
        "--mock-seed",
        type=int,
        default=20260612,
        help="Random seed for reproducible mock elections.",
    )
    parser.add_argument(
        "--request-delay",
        type=float,
        default=0.02,
        help="Seconds to pause between mock vote submissions. Default: 0.02.",
    )
    parser.add_argument(
        "--progress-every",
        type=int,
        default=10,
        help="Print mock vote progress every N votes. Use 1 for every vote. Default: 10.",
    )
    parser.add_argument(
        "--skip-preflight",
        action="store_true",
        help="Skip login/auth/shape checks and only run requested election/reset actions.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.clear != "none" and not args.confirm_clear:
        print(
            f"FAIL: --clear {args.clear} requires --confirm-clear",
            file=sys.stderr,
        )
        return 1
    if args.mock_elections and not args.confirm_clear:
        print(
            "FAIL: --mock-elections resets the database and requires --confirm-clear",
            file=sys.stderr,
        )
        return 1
    if args.mock_elections < 0:
        print("FAIL: --mock-elections must be zero or greater", file=sys.stderr)
        return 1
    if args.mock_votes < 1:
        print("FAIL: --mock-votes must be at least 1", file=sys.stderr)
        return 1
    if args.mock_class_count < 1 or args.mock_class_count > len(SCHOOL_CLASSES):
        print(
            f"FAIL: --mock-class-count must be between 1 and {len(SCHOOL_CLASSES)}",
            file=sys.stderr,
        )
        return 1
    if args.mock_candidates_per_gender < 1:
        print(
            "FAIL: --mock-candidates-per-gender must be at least 1",
            file=sys.stderr,
        )
        return 1
    if args.request_delay < 0:
        print("FAIL: --request-delay must be zero or greater", file=sys.stderr)
        return 1
    if args.progress_every < 0:
        print("FAIL: --progress-every must be zero or greater", file=sys.stderr)
        return 1

    password = args.password or getpass.getpass("Admin password: ")
    client = ApiClient(args.base_url)
    results: list[CheckResult] = []
    mock_classes = [args.class_name] if args.class_name else SCHOOL_CLASSES[: args.mock_class_count]

    print(f"Election API dashboard: {args.base_url}")
    print()

    results.append(run_check("admin login", lambda: login_check(client, password)))

    if not args.skip_preflight:
        results.append(
            run_check("admin auth guard", lambda: protected_admin_check(args.base_url))
        )
        results.append(run_check("results shape", lambda: results_shape_check(client)))
        results.append(
            run_check("kiosk state", lambda: kiosk_state_check(client, args.class_name))
        )
        results.append(run_check("invalid class", lambda: invalid_class_check(client)))
        results.append(
            run_check("invalid ballot", lambda: invalid_ballot_check(client, args.class_name))
        )

    if args.include_vote_test:
        results.append(
            run_check(
                "vote readback",
                lambda: vote_readback_check(
                    client,
                    args.class_name,
                    args.male,
                    args.female,
                ),
            )
        )

    if args.clear != "none":
        results.append(
            run_check(
                f"clear {args.clear}",
                lambda: reset_check(client, args.clear, password),
            )
        )

    if args.mock_elections:
        results.extend(
            run_mock_elections(
                client,
                password,
                args.mock_elections,
                mock_classes,
                args.mock_candidates_per_gender,
                args.mock_votes,
                args.mock_seed,
                args.request_delay,
                args.progress_every,
            )
        )

    print_results(results)

    failed = [result for result in results if not result.ok]
    if failed:
        print()
        print(f"{len(failed)} check(s) failed.")
        return 1

    print()
    print("All selected checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
