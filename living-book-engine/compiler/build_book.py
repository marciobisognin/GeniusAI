#!/usr/bin/env python3
"""
Living Book Engine (LBE) — Compiler CLI
Compiles any book_spec.json and simulations.js into a standalone, 100% functional 3D living book.
"""

import os
import sys
import json
import shutil
import argparse
import subprocess
from datetime import datetime

def parse_args():
    parser = argparse.ArgumentParser(description="Living Book Engine (LBE) Compiler")
    parser.add_argument("--spec", required=True, help="Path to book_spec.json")
    parser.add_argument("--sims", required=True, help="Path to simulations.js")
    parser.add_argument("--out", required=True, help="Output directory for the compiled book")
    parser.add_argument("--version", default="", help="Optional cache version string (e.g. v=20261104a)")
    return parser.parse_args()

def validate_spec(spec_data):
    required_top = ["title", "lessons"]
    for field in required_top:
        if field not in spec_data:
            raise ValueError(f"book_spec.json missing required top-level field: '{field}'")
    
    lessons = spec_data["lessons"]
    if not isinstance(lessons, list) or len(lessons) == 0:
        raise ValueError("book_spec.json must contain at least 1 lesson in 'lessons'")
    
    for idx, l in enumerate(lessons):
        n = idx + 1
        req_l = ["title", "explanation", "equation", "keywords", "predict", "explain", "tryHint", "challenge"]
        for rf in req_l:
            if rf not in l:
                raise ValueError(f"Lesson {n} missing required field: '{rf}'")
        
        # explanation: must be list of strings
        if not isinstance(l["explanation"], list):
            l["explanation"] = [str(l["explanation"])]
        
        # equation: must be dict with 'symbols' and 'words'
        if not isinstance(l["equation"], dict):
            raise ValueError(f"Lesson {n} 'equation' must be an object with 'symbols' and 'words'. Got: {type(l['equation']).__name__}")
        if "symbols" not in l["equation"] or "words" not in l["equation"]:
            raise ValueError(f"Lesson {n} 'equation' must contain both 'symbols' and 'words' keys.")
        
        # challenge: must be dict with 'text'
        if not isinstance(l["challenge"], dict):
            raise ValueError(f"Lesson {n} 'challenge' must be an object with 'text'. Got: {type(l['challenge']).__name__}")
        if "text" not in l["challenge"]:
            raise ValueError(f"Lesson {n} 'challenge' must contain 'text' string.")
            
        # keywords: must be list of dicts with 'term' and 'definition'
        if not isinstance(l["keywords"], list):
            raise ValueError(f"Lesson {n} 'keywords' must be a list of objects.")
        for kw_idx, kw in enumerate(l["keywords"]):
            if not isinstance(kw, dict) or "term" not in kw or "definition" not in kw:
                raise ValueError(f"Lesson {n} keyword #{kw_idx+1} must be an object with 'term' and 'definition'.")

        # predict: must be dict with 'question' and 'options' list
        if not isinstance(l["predict"], dict):
            raise ValueError(f"Lesson {n} 'predict' must be an object.")
        if "question" not in l["predict"] or not isinstance(l["predict"].get("options"), list):
            raise ValueError(f"Lesson {n} 'predict' must contain 'question' and 'options' list.")
            
        l["n"] = n

    # glossary validation
    glossary = spec_data.get("glossary", [])
    if not isinstance(glossary, list):
        raise ValueError("book_spec.json 'glossary' must be a list of glossary entries.")
    for g_idx, g_entry in enumerate(glossary):
        if not isinstance(g_entry, dict):
            raise ValueError(f"Glossary entry #{g_idx+1} must be an object.")
        for gf in ["id", "term", "lessons"]:
            if gf not in g_entry:
                raise ValueError(f"Glossary entry #{g_idx+1} missing required field '{gf}'.")
        if not isinstance(g_entry["lessons"], list):
            raise ValueError(f"Glossary entry '{g_entry.get('term')}' 'lessons' must be a list of lesson numbers.")

    return spec_data

def build_book(spec_path, sims_path, out_dir, custom_version=""):
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    core_dir = os.path.join(repo_root, "core")
    core_parts = os.path.join(core_dir, "parts")
    core_assets = os.path.join(core_dir, "assets")

    if not os.path.exists(spec_path):
        raise FileNotFoundError(f"Specification file not found: {spec_path}")
    if not os.path.exists(sims_path):
        raise FileNotFoundError(f"Simulations file not found: {sims_path}")

    with open(spec_path, "r", encoding="utf-8") as f:
        spec = json.load(f)
    validate_spec(spec)

    with open(sims_path, "r", encoding="utf-8") as f:
        sims_code = f.read()

    lessons = spec["lessons"]
    n_lessons = len(lessons)
    glossary = spec.get("glossary", [])
    version = custom_version if custom_version else f"v={datetime.now().strftime('%Y%m%d%H%M')}"
    
    title = spec.get("title", "Livro Vivo 3D")
    subtitle = spec.get("subtitle", "Um Livro Vivo Interativo em 3D")
    author = spec.get("author", "Techartist")
    description = spec.get("description", f"{title}: um livro vivo interativo em 3D com física e ilustrações em nanquim.")
    lang = spec.get("lang", "pt-BR")
    copyright_text = spec.get("copyright", f"© {datetime.now().year} {author} · {title}")

    # Output directories
    out_dir = os.path.abspath(out_dir)
    out_assets = os.path.join(out_dir, "assets")
    os.makedirs(out_assets, exist_ok=True)

    print(f"[*] Compiling '{title}' ({n_lessons} lessons) into '{out_dir}'...")

    # 1. Copy Vendor Assets
    vendor_files = [
        "three-DMk7AhfD.js",
        "post-CiGSGJXB.js",
        "numbers-D7lU_RWT.js",
        "sound-vOpPkm07.js",
        "sourcelist-ugshuCEn.js",
        "index-utElasQ9.css"
    ]
    for vf in vendor_files:
        src = os.path.join(core_assets, vf)
        dst = os.path.join(out_assets, vf)
        if os.path.exists(src):
            shutil.copy2(src, dst)
        else:
            print(f"[!] Warning: vendor file not found: {src}")

    # Copy font files
    for fn in os.listdir(core_assets):
        if fn.endswith(".woff2"):
            shutil.copy2(os.path.join(core_assets, fn), os.path.join(out_assets, fn))

    # 2. Assemble book-content.js (index-quanta.js)
    with open(os.path.join(core_parts, "content-prefix.js"), "r", encoding="utf-8") as f:
        c_prefix = f.read()
    with open(os.path.join(core_parts, "content-bridge.js"), "r", encoding="utf-8") as f:
        c_bridge = f.read()
    with open(os.path.join(core_parts, "content-suffix.js"), "r", encoding="utf-8") as f:
        c_suffix = f.read()

    glossary_json = json.dumps(glossary, ensure_ascii=False)
    lessons_json = json.dumps(lessons, ensure_ascii=False)
    content_code = f"{c_prefix},ge={glossary_json}{c_bridge},K={lessons_json}\n{c_suffix}"

    with open(os.path.join(out_assets, "index-quanta.js"), "w", encoding="utf-8") as f:
        f.write(content_code)
    print("  [+] Generated assets/index-quanta.js")

    # 3. Assemble book-sims.js (sims-quanta.js)
    with open(os.path.join(core_parts, "sims-prefix.js"), "r", encoding="utf-8") as f:
        s_prefix = f.read()

    sims_footer_lines = ["\n\n// --- AUTO-GENERATED LESSON MODULE EXPORTS ---"]
    for i in range(1, n_lessons + 1):
        sims_footer_lines.append(f"const lesson{i} = {{ n: {i}, build: (s, t) => typeof buildLesson{i} === 'function' ? buildLesson{i}(s, t) : {{ state: {{}}, update(){{}}, glowObjects: () => [], lightSources: () => [] }} }};")
        sims_footer_lines.append(f"const s{i} = Object.freeze(Object.defineProperty({{ __proto__: null, lesson: lesson{i} }}, Symbol.toStringTag, {{ value: 'Module' }}));")
    
    export_list = ["Ps as B", "rs as I", "Tt as M", "V as O", "ns as P", "tt as S", "Fe as _", "os as a", "Je as b", "ls as c", "He as d", "Fs as e", "Js as i", "Ds as t"]
    for i in range(1, n_lessons + 1):
        export_list.append(f"s{i}")
        export_list.append(f"lesson{i}")
    export_list.append("s1 as s")

    sims_footer = "\n".join(sims_footer_lines) + f"\n\nexport {{\n  {', '.join(export_list)}\n}};\n"
    full_sims = f"{s_prefix}\n\n// --- CUSTOM APPARATUS SIMULATIONS ---\n{sims_code}\n{sims_footer}"

    with open(os.path.join(out_assets, "sims-quanta.js"), "w", encoding="utf-8") as f:
        f.write(full_sims)
    print("  [+] Generated assets/sims-quanta.js")

    # 4. Assemble main-quanta.js (from engine-core.js)
    with open(os.path.join(core_assets, "engine-core.js"), "r", encoding="utf-8") as f:
        engine_code = f.read()

    # Configure spreads and titles dynamically
    total_spreads = n_lessons + 4
    idx_spread = n_lessons + 2
    quiz_spread = n_lessons + 3
    sources_spread = n_lessons + 4

    lesson_titles = [l["title"] for l in lessons]
    titles_json = json.dumps(lesson_titles, ensure_ascii=False)

    # Patch jr (total spreads)
    engine_code = engine_code.replace("const jr=14", f"const jr={total_spreads}")
    
    # Patch rt array (lesson titles)
    rt_start = engine_code.find(",rt=[")
    if rt_start != -1:
        rt_end = engine_code.find("],St=", rt_start)
        if rt_end != -1:
            engine_code = engine_code[:rt_start] + f",rt={titles_json}" + engine_code[rt_end:]

    # Patch St formula: St=e=>e>=2&&e<=11?e-1:null
    engine_code = engine_code.replace("e<=11?e-1:null", f"e<={n_lessons + 1}?e-1:null")

    # Patch we offsets: we=Object.freeze({index:12,quiz:13,sources:14})
    engine_code = engine_code.replace(
        "we=Object.freeze({index:12,quiz:13,sources:14})",
        f"we=Object.freeze({{index:{idx_spread},quiz:{quiz_spread},sources:{sources_spread}}})"
    )

    # Patch non-lesson spread offset in xt: [e-12]
    engine_code = engine_code.replace("[e-12]", f"[e-{idx_spread}]")

    # Patch 2D Table of Contents / Index spreads in engine
    engine_code = engine_code.replace(
        '[["Index",12],["Quiz",13],["Sources",14]]',
        f'[["Index",{idx_spread}],["Quiz",{quiz_spread}],["Sources",{sources_spread}]]'
    )

    # Patch Sheet Continue Button
    engine_code = engine_code.replace(
        'P=y<=11?`lesson ${y-1}, ${rt[y-2]}`:["the index","the quiz","the sources"][y-12]',
        f'P=y<={n_lessons + 1}?`lesson ${{y-1}}, ${{rt[y-2]}}`:["the index","the quiz","the sources"][y-{idx_spread}]'
    )

    # Patch Sheet Back Matter links list
    engine_code = engine_code.replace(
        '${t>=14?',
        f'${{t>={total_spreads}?'
    )
    engine_code = engine_code.replace(
        '<li><a href="#" data-goto="12">Index</a></li><li><a href="#" data-goto="13">Quiz</a></li><li><a href="#" data-goto="14">Sources</a></li>',
        f'<li><a href="#" data-goto="{idx_spread}">Index</a></li><li><a href="#" data-goto="{quiz_spread}">Quiz</a></li><li><a href="#" data-goto="{sources_spread}">Sources</a></li>'
    )

    # Patch Accessible Navigation Bar Spreads
    engine_code = engine_code.replace(
        'tSpread:u=14,still:f=!1',
        f'tSpread:u={total_spreads},still:f=!1'
    )
    engine_code = engine_code.replace(
        '${c<=11?`: lesson ${c-1}, ${V(rt[c-2])}`:""}',
        f'${{c<={n_lessons + 1}?`: lesson ${{c-1}}, ${{V(rt[c-2])}}`:""}}'
    )

    # Build qo dynamic imports for N lessons
    qo_entries = []
    for i in range(1, n_lessons + 1):
        qo_entries.append(f'  {i}:()=>import("./sims-quanta.js?{version}").then(e=>e.s{i})')
    qo_code = "const qo={\n" + ",\n".join(qo_entries) + "\n}"
    
    # Replace qo in engine_code
    idx_qo_start = engine_code.find("const qo={")
    if idx_qo_start != -1:
        last_item_pos = engine_code.find(".then(e=>e.s", idx_qo_start)
        while True:
            nxt = engine_code.find(".then(e=>e.s", last_item_pos + 10)
            if nxt == -1:
                break
            last_item_pos = nxt
        closing_brace = engine_code.find("}", last_item_pos)
        if closing_brace != -1:
            engine_code = engine_code[:idx_qo_start] + qo_code + engine_code[closing_brace + 1:]

    # Apply version query string across engine imports
    engine_code = engine_code.replace("./sims-quanta.js?v=20261104a", f"./sims-quanta.js?{version}")
    engine_code = engine_code.replace("./index-quanta.js?v=20261104a", f"./index-quanta.js?{version}")
    engine_code = engine_code.replace("O Cântico dos Quanta", title)

    with open(os.path.join(out_assets, "main-quanta.js"), "w", encoding="utf-8") as f:
        f.write(engine_code)
    print("  [+] Generated assets/main-quanta.js")

    # 5. Assemble index.html from template
    with open(os.path.join(core_dir, "template.html"), "r", encoding="utf-8") as f:
        html = f.read()

    html = html.replace("{{TITLE}}", f"{title} · Livro Vivo 3D Interativo")
    html = html.replace("{{DESCRIPTION}}", description)
    html = html.replace("{{BOOK_NAME}}", title)
    html = html.replace("{{SUBTITLE}}", subtitle)
    html = html.replace("{{COPYRIGHT}}", copyright_text)
    html = html.replace("{{BRAND_PRESENTATION}}", spec.get("presentation", "apresenta"))
    html = html.replace("{{BRAND_TITLE}}", spec.get("brand", "Techartist"))
    html = html.replace("{{LANG}}", lang)
    html = html.replace("{{VERSION}}", version)
    html = html.replace("./assets/engine-core.js", "./assets/main-quanta.js")
    html = html.replace("./assets/book-content.js", "./assets/index-quanta.js")
    html = html.replace("./assets/book-sims.js", "./assets/sims-quanta.js")

    with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("  [+] Generated index.html")

    # 6. Syntax validation with node --check
    js_files = ["index-quanta.js", "sims-quanta.js", "main-quanta.js"]
    for jf in js_files:
        fpath = os.path.join(out_assets, jf)
        res = subprocess.run(["node", "--check", fpath], capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Syntax validation failed on {jf}:\n{res.stderr}")
    print("  [*] All generated JavaScript modules validated successfully with node --check!")

    print(f"\n[OK] Book '{title}' compiled successfully into '{out_dir}'!")
    print(f"To run locally:")
    print(f"  python3 compiler/serve.py --book \"{out_dir}\" --port 8766\n")

if __name__ == "__main__":
    args = parse_args()
    try:
        build_book(args.spec, args.sims, args.out, args.version)
    except Exception as e:
        print(f"\n[!] Compilation Error: {e}", file=sys.stderr)
        sys.exit(1)
