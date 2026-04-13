#!/usr/bin/env python3

from __future__ import annotations

import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


SITE_ROOT = "https://developer.raindrop.io"
SITEMAP_INDEX = f"{SITE_ROOT}/sitemap.xml"
DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
USER_AGENT = "codex-raindrop-docs-downloader/1.0"
KNOWN_PAGE_PATHS: set[str] = set()


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset)


def parse_xml_urls(xml_text: str) -> list[str]:
    root = ET.fromstring(xml_text)
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [element.text.strip() for element in root.findall(".//sm:loc", namespace) if element.text]


def page_url_to_markdown_url(page_url: str) -> str:
    parsed = urllib.parse.urlsplit(page_url)
    if parsed.netloc != urllib.parse.urlsplit(SITE_ROOT).netloc:
        raise ValueError(f"Unexpected host for page URL: {page_url}")

    path = parsed.path.rstrip("/")
    if not path:
        return f"{SITE_ROOT}/readme.md"
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, f"{path}.md", "", ""))


def page_url_to_output_path(page_url: str) -> Path:
    parsed = urllib.parse.urlsplit(page_url)
    path = parsed.path.strip("/")
    if not path:
        return DOCS_DIR / "README.md"
    return DOCS_DIR / f"{path}.md"


def resolve_known_doc_target(path: str) -> Path:
    normalized = path.strip("/")
    if not normalized:
        return DOCS_DIR / "README.md"

    if normalized in KNOWN_PAGE_PATHS:
        return DOCS_DIR / f"{normalized}.md"

    suffix_matches = sorted(
        candidate
        for candidate in KNOWN_PAGE_PATHS
        if candidate.endswith(f"/{normalized}") or candidate == normalized
    )
    if len(suffix_matches) == 1:
        return DOCS_DIR / f"{suffix_matches[0]}.md"

    basename = normalized.split("/")[-1]
    basename_matches = sorted(
        candidate
        for candidate in KNOWN_PAGE_PATHS
        if candidate.endswith(f"/{basename}") or candidate == basename
    )
    if len(basename_matches) == 1:
        return DOCS_DIR / f"{basename_matches[0]}.md"

    return DOCS_DIR / f"{normalized}.md"


def resolve_internal_link(source_file: Path, href: str) -> str | None:
    if href.startswith("#"):
        return href

    parsed = urllib.parse.urlsplit(href)
    if parsed.scheme and parsed.netloc and parsed.netloc != urllib.parse.urlsplit(SITE_ROOT).netloc:
        return None

    if parsed.scheme and parsed.netloc:
        path = parsed.path
    else:
        path = parsed.path or ""

    target = resolve_known_doc_target(path.rstrip("/"))

    result = os.path.relpath(target, source_file.parent).replace(os.sep, "/")
    if parsed.fragment:
        result = f"{result}#{parsed.fragment}"
    return result


def rewrite_internal_links(markdown: str, source_file: Path) -> str:
    markdown_link_pattern = re.compile(r"(?P<prefix>\[[^\]]+\]\()(?P<href>[^)\s]+)(?P<suffix>\))")
    html_href_pattern = re.compile(r'(?P<prefix>href=")(?P<href>[^"]+)(?P<suffix>")')

    def replace(match: re.Match[str]) -> str:
        href = match.group("href")
        rewritten = resolve_internal_link(source_file, href)
        if rewritten is None:
            return match.group(0)
        return f"{match.group('prefix')}{rewritten}{match.group('suffix')}"

    markdown = markdown_link_pattern.sub(replace, markdown)
    markdown = html_href_pattern.sub(replace, markdown)
    return markdown


def collect_page_urls() -> list[str]:
    sitemap_index = fetch_text(SITEMAP_INDEX)
    sitemap_urls = parse_xml_urls(sitemap_index)
    page_urls: list[str] = []
    for sitemap_url in sitemap_urls:
        page_urls.extend(parse_xml_urls(fetch_text(sitemap_url)))
    return page_urls


def main() -> int:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    page_urls = collect_page_urls()
    KNOWN_PAGE_PATHS.update(urllib.parse.urlsplit(page_url).path.strip("/") for page_url in page_urls)
    downloaded = 0

    for page_url in page_urls:
        markdown_url = page_url_to_markdown_url(page_url)
        output_path = page_url_to_output_path(page_url)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            content = fetch_text(markdown_url)
        except urllib.error.HTTPError as exc:
            print(f"failed: {page_url} -> {markdown_url} ({exc.code})", file=sys.stderr)
            return 1

        content = rewrite_internal_links(content, output_path).rstrip() + "\n"
        output_path.write_text(content, encoding="utf-8")
        downloaded += 1
        print(f"saved {output_path.relative_to(DOCS_DIR.parent)}")

    print(f"downloaded {downloaded} markdown files into {DOCS_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
