#!/usr/bin/env python3
"""Optional headed Chromium/WebGL2 smoke test.

Run in a Linux CI image with:
    xvfb-run -a python3 tests/browser-smoke.py

Requires Python Playwright and Chromium. It has no bearing on the dependency-free
Node core and is therefore intentionally excluded from `npm run check`.
"""

from __future__ import annotations

import base64
import json
import os
import pathlib
import posixpath
import re
import tempfile
import zipfile
from typing import Any

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = pathlib.Path(os.environ.get("LML_SMOKE_OUTPUT", tempfile.mkdtemp(prefix="latent-mechanics-smoke-")))
OUTPUT.mkdir(parents=True, exist_ok=True)


def inline_application() -> str:
    modules: dict[str, str] = {}
    pending = [ROOT / "src" / "main.js"]
    visited: set[pathlib.Path] = set()
    import_pattern = re.compile(r"(?:from\s+|import\s+)([\"'])([^\"']+)\1")

    while pending:
        path = pending.pop()
        path = path.resolve()
        if path in visited:
            continue
        visited.add(path)
        relative = path.relative_to(ROOT).as_posix()
        source = path.read_text(encoding="utf-8")

        for match in import_pattern.finditer(source):
            specifier = match.group(2)
            if not specifier.startswith("."):
                continue
            target = (path.parent / specifier).resolve()
            if target.suffix == "":
                target = target.with_suffix(".js")
            if ROOT / "src" not in target.parents:
                raise RuntimeError(f"Browser import escapes src: {relative} -> {specifier}")
            pending.append(target)

        def replace_from(match: re.Match[str]) -> str:
            quote, specifier = match.group(1), match.group(2)
            if not specifier.startswith("."):
                return match.group(0)
            target = posixpath.normpath(posixpath.join(posixpath.dirname(relative), specifier))
            return f"from {quote}lml/{target}{quote}"

        def replace_import(match: re.Match[str]) -> str:
            quote, specifier = match.group(1), match.group(2)
            if not specifier.startswith("."):
                return match.group(0)
            target = posixpath.normpath(posixpath.join(posixpath.dirname(relative), specifier))
            return f"import {quote}lml/{target}{quote}"

        source = re.sub(r"""from\s+(['"])([^'"]+)\1""", replace_from, source)
        source = re.sub(r"""import\s+(['"])([^'"]+)\1""", replace_import, source)
        modules[f"lml/{relative}"] = (
            "data:text/javascript;base64," + base64.b64encode(source.encode("utf-8")).decode("ascii")
        )

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "app.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="./app.css">', f"<style>{css}</style>")
    html = html.replace('<script type="module" src="./src/main.js"></script>', "")
    bootstrap = (
        f'<script type="importmap">{json.dumps({"imports": modules})}</script>'
        '<script type="module">import "lml/src/main.js";</script>'
    )
    return html.replace("</body>", f"{bootstrap}</body>")


def main() -> None:
    environment = dict(os.environ)
    swiftshader_icd = "/usr/lib/chromium/vk_swiftshader_icd.json"
    if pathlib.Path(swiftshader_icd).exists():
        environment.setdefault("VK_ICD_FILENAMES", swiftshader_icd)

    executable = os.environ.get("LML_CHROMIUM", "/usr/bin/chromium")
    launch_args = [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--enable-unsafe-swiftshader",
        "--use-angle=vulkan",
        "--enable-features=Vulkan",
    ]

    report: dict[str, Any] = {"output": str(OUTPUT), "checks": {}}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=False,
            executable_path=executable,
            env=environment,
            args=launch_args,
        )
        page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
        console: list[str] = []
        page.on("console", lambda message: console.append(f"{message.type}: {message.text}"))
        page.on("pageerror", lambda error: console.append(f"PAGEERROR: {error}"))
        page.set_content(inline_application(), wait_until="load", timeout=30_000)
        page.wait_for_function("window.__KINESCOPE_READY__ === true", timeout=30_000)
        page.wait_for_timeout(800)

        report["gpu"] = page.locator("#rendererValue").inner_text()
        report["checks"]["ready"] = page.evaluate("window.__KINESCOPE_READY__")
        report["checks"]["compatibilityAliases"] = page.evaluate(
            """() => ({
              legacyReady: window.__TWISTYWORLD_READY__ === true,
              evaluatorSame: window.twistyWorld === window.kinescope,
              agentSame: window.twistyAgent === window.kineScopeAgent,
            })"""
        )
        report["checks"]["initialPuzzle"] = page.evaluate("window.kinescope.getSnapshot().puzzle.name")
        report["checks"]["agentSurface"] = page.evaluate(
            """() => ({
              keys: Object.keys(window.kineScopeAgent).sort(),
              leakedGroundTruth: typeof window.kineScopeAgent.getGroundTruth !== 'undefined',
              observation: window.kineScopeAgent.observe(),
            })"""
        )
        report["checks"]["agentReceipt"] = page.evaluate(
            """async () => {
              const before = window.kineScopeAgent.observe().stateId;
              const receipt = await window.kineScopeAgent.act('A0', { animated: false });
              return {
                before,
                receipt,
                keys: Object.keys(receipt).sort(),
                leaksSelectedPieces: 'selectedIds' in receipt,
                leaksInternalToken: receipt.action !== 'A0',
              };
            }"""
        )
        page.evaluate("window.kinescope.reset()")
        page.screenshot(path=str(OUTPUT / "studio-ui.png"), full_page=True)

        page.evaluate("window.kinescope.apply('R', { animated: false })")
        report["checks"]["rMovePerturbsState"] = not page.evaluate("window.kinescope.getState().solved")
        normal_capture = page.evaluate(
            """async () => {
              const blob = await window.kinescope.capture('normal', { width: 256, height: 256 });
              return { size: blob.size, type: blob.type };
            }"""
        )
        report["checks"]["normalCapture"] = normal_capture
        episode = page.evaluate(
            """async () => {
              const blob = await window.kinescope.exportBundle({
                width: 256,
                height: 256,
                includeStudio: false,
              });
              const bytes = new Uint8Array(await blob.arrayBuffer());
              let binary = '';
              const chunk = 0x8000;
              for (let offset = 0; offset < bytes.length; offset += chunk) {
                binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
              }
              return { size: blob.size, type: blob.type, base64: btoa(binary) };
            }"""
        )
        episode_bytes = base64.b64decode(episode.pop("base64"))
        episode_path = OUTPUT / "withheld-episode.zip"
        episode_path.write_bytes(episode_bytes)
        with zipfile.ZipFile(episode_path) as archive:
            public_episode = json.loads(archive.read("episode_public.json"))
            private_episode = json.loads(archive.read("private/ground_truth.json"))
        episode["publicManifest"] = {
            "mechanics": public_episode["mechanics"],
            "puzzleName": public_episode["puzzle"]["name"],
            "hasLegalMask": "legalActionMask" in public_episode,
            "stateLeaksPieceIds": "p-" in public_episode["stateId"],
        }
        episode["privateManifest"] = {
            "puzzleId": private_episode["puzzleSpec"]["id"],
            "hasExactState": "state" in private_episode and "hash" in private_episode["state"],
            "hasDynamics": "dynamics" in private_episode,
            "idealRigidDisplayValid": private_episode["idealRigidDisplay"]["valid"],
        }
        report["checks"]["episodeBundle"] = episode

        page.evaluate("window.kinescope.setPreset('ghost-4')")
        four_snapshot = page.evaluate("window.kinescope.getSnapshot()")
        report["checks"]["ghost4"] = {
            "logicalPieces": four_snapshot["puzzle"]["stats"]["logicalPieces"],
            "renderablePieces": four_snapshot["puzzle"]["stats"]["renderablePieces"],
            "topologyWarnings": four_snapshot["puzzle"]["stats"]["topologyWarnings"],
        }
        page.evaluate("window.kinescope.applySequence(['R', 'U'], { animated: false })")
        page.evaluate("window.kinescope.setObservationMode('piece')")
        page.wait_for_timeout(150)
        page.screenshot(path=str(OUTPUT / "ghost4-piece-ui.png"), full_page=True)

        page.evaluate("window.kinescope.setPreset('bandaged-relay-3')")
        page.evaluate("window.kinescope.setMechanicsWithheld(true)")
        hidden_bandaged = page.evaluate("window.kineScopeAgent.observe()")
        hidden_buttons = page.evaluate(
            """() => ({
              disabled: document.querySelectorAll('.move-button:disabled').length,
              markedBlocked: document.querySelectorAll('.move-button.blocked').length,
            })"""
        )
        hidden_blocked = page.evaluate(
            """async () => {
              const before = window.kineScopeAgent.observe().stateId;
              try {
                await window.kineScopeAgent.act('A2', { animated: false });
                return { accepted: true };
              } catch (error) {
                return {
                  accepted: false,
                  code: error.code,
                  message: error.message,
                  hasViolatedBandages: 'violatedBandages' in error,
                  unchanged: before === window.kineScopeAgent.observe().stateId,
                };
              }
            }"""
        )
        page.evaluate("window.kinescope.setMechanicsWithheld(false)")
        disclosed_bandaged = page.evaluate("window.kineScopeAgent.observe()")
        bandaged = page.evaluate("window.kinescope.getSnapshot()")
        blocked_attempt = page.evaluate(
            """async () => {
              const before = window.kinescope.getState().hash;
              try {
                await window.kinescope.apply('U', { animated: false });
                return { accepted: true };
              } catch (error) {
                return {
                  accepted: false,
                  code: error.code,
                  unchanged: before === window.kinescope.getState().hash,
                };
              }
            }"""
        )
        dynamics = page.evaluate("window.kinescope.analyzeDynamics({ maxOrder: 8 })")
        before_view = page.evaluate("window.kineScopeAgent.observe().camera")
        after_view = page.evaluate(
            "window.kineScopeAgent.requestView({ yawDelta: 0.25, pitchDelta: -0.1, distanceScale: 0.95 })"
        )
        report["checks"]["bandaged"] = {
            "bandageCount": bandaged["puzzle"]["stats"]["bandageCount"],
            "legalActionMask": bandaged["mechanics"]["legalActionMask"],
            "blockedAttempt": blocked_attempt,
            "dynamicsActions": dynamics["actionCount"],
            "blockedButtonCount": page.locator(".move-button.blocked:disabled").count(),
            "hiddenAlphabet": hidden_bandaged["actionAlphabet"],
            "hiddenHasLegalMask": "legalActionMask" in hidden_bandaged,
            "hiddenPuzzle": hidden_bandaged["puzzle"],
            "hiddenStateLeaksPieceIds": "p-" in hidden_bandaged["stateId"],
            "hiddenButtons": hidden_buttons,
            "hiddenBlockedAttempt": hidden_blocked,
            "disclosedAlphabet": disclosed_bandaged["actionAlphabet"],
            "disclosedLegalMask": disclosed_bandaged["legalActionMask"],
            "viewChanged": before_view != after_view,
        }
        page.wait_for_timeout(150)
        page.screenshot(path=str(OUTPUT / "bandaged-ui.png"), full_page=True)
        page.evaluate("window.kineScopeAgent.act('R', { animated: false })")
        report["checks"]["bandaged"]["uUnlockedAfterR"] = page.evaluate(
            "window.kineScopeAgent.observe().legalActionMask.U"
        )

        page.evaluate("window.kinescope.setPreset('alien', 'browser-validation-seed')")
        alien = page.evaluate("window.kinescope.getSnapshot()")
        report["checks"]["alien"] = {
            "name": alien["puzzle"]["name"],
            "warnings": alien["puzzle"]["stats"]["topologyWarnings"],
        }

        fatal = [entry for entry in console if entry.startswith("PAGEERROR") or entry.startswith("error:")]
        report["console"] = console
        report["fatalConsoleEntries"] = fatal
        browser.close()

    report_path = OUTPUT / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    assert report["checks"]["ready"] is True
    assert report["checks"]["compatibilityAliases"] == {
        "legacyReady": True,
        "evaluatorSame": True,
        "agentSame": True,
    }
    assert report["checks"]["agentSurface"]["leakedGroundTruth"] is False
    assert report["checks"]["agentSurface"]["keys"] == [
        "act",
        "actSequence",
        "capture",
        "listActions",
        "observe",
        "requestView",
        "setObservationMode",
        "version",
    ]
    initial_agent_observation = report["checks"]["agentSurface"]["observation"]
    assert initial_agent_observation["mechanics"] == "withheld"
    assert initial_agent_observation["actionAlphabet"] == ["A0", "A1", "A2", "A3", "A4", "A5"]
    assert "legalActionMask" not in initial_agent_observation
    assert initial_agent_observation["puzzle"]["name"] == "Unfamiliar Artifact"
    assert "p-" not in initial_agent_observation["stateId"]
    assert report["checks"]["agentReceipt"]["keys"] == ["accepted", "action", "schema", "stateId"]
    assert report["checks"]["agentReceipt"]["receipt"]["schema"] == "kinescope.agent-transition.v1"
    assert report["checks"]["agentReceipt"]["receipt"]["accepted"] is True
    assert report["checks"]["agentReceipt"]["receipt"]["action"] == "A0"
    assert report["checks"]["agentReceipt"]["receipt"]["stateId"] != report["checks"]["agentReceipt"]["before"]
    assert report["checks"]["agentReceipt"]["leaksSelectedPieces"] is False
    assert report["checks"]["agentReceipt"]["leaksInternalToken"] is False
    assert report["checks"]["rMovePerturbsState"] is True
    assert report["checks"]["normalCapture"]["type"] == "image/png"
    assert report["checks"]["normalCapture"]["size"] > 1000
    assert report["checks"]["episodeBundle"]["type"] == "application/zip"
    assert report["checks"]["episodeBundle"]["size"] > 20_000
    assert report["checks"]["episodeBundle"]["publicManifest"] == {
        "mechanics": "withheld",
        "puzzleName": "Unfamiliar Artifact",
        "hasLegalMask": False,
        "stateLeaksPieceIds": False,
    }
    assert report["checks"]["episodeBundle"]["privateManifest"] == {
        "puzzleId": "ghost-3",
        "hasExactState": True,
        "hasDynamics": True,
        "idealRigidDisplayValid": True,
    }
    assert report["checks"]["ghost4"] == {
        "logicalPieces": 64,
        "renderablePieces": 56,
        "topologyWarnings": [],
    }
    assert report["checks"]["alien"]["warnings"] == []
    bandaged = report["checks"]["bandaged"]
    assert bandaged["bandageCount"] == 2
    assert bandaged["legalActionMask"] == {
        "R": True,
        "L": True,
        "U": False,
        "D": True,
        "F": True,
        "B": False,
    }
    assert bandaged["blockedAttempt"] == {
        "accepted": False,
        "code": "KineScope_ILLEGAL_MOVE",
        "unchanged": True,
    }
    assert bandaged["dynamicsActions"] == 6
    assert bandaged["blockedButtonCount"] == 4
    assert bandaged["hiddenAlphabet"] == ["A0", "A1", "A2", "A3", "A4", "A5"]
    assert bandaged["hiddenHasLegalMask"] is False
    assert bandaged["hiddenPuzzle"]["name"] == "Unfamiliar Artifact"
    assert bandaged["hiddenStateLeaksPieceIds"] is False
    assert bandaged["hiddenButtons"] == {"disabled": 0, "markedBlocked": 0}
    assert bandaged["hiddenBlockedAttempt"] == {
        "accepted": False,
        "code": "KineScope_ACTION_REJECTED",
        "message": "Action A2 is unavailable in the current state.",
        "hasViolatedBandages": False,
        "unchanged": True,
    }
    assert bandaged["disclosedAlphabet"] == ["R", "L", "U", "D", "F", "B"]
    assert bandaged["disclosedLegalMask"] == bandaged["legalActionMask"]
    assert bandaged["viewChanged"] is True
    assert bandaged["uUnlockedAfterR"] is True
    assert report["fatalConsoleEntries"] == []

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
