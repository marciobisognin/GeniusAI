import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildSkills,
  groupBySkill,
  loadManifests,
} from "../../scripts/generate-hermes-skills.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SKILLS = join(ROOT, "hermes-skills");

const manifests = loadManifests();
const skills = buildSkills(manifests);

test("os manifestos institucionais continuam completos", () => {
  assert.equal(manifests.length, 453);
  for (const manifest of manifests) {
    assert.ok(manifest.unit?.code, "manifesto sem código de unidade");
    assert.ok(manifest.normativeSource?.title, "manifesto sem fonte normativa");
    assert.ok(manifest.limitations?.length, "manifesto sem limitações declaradas");
  }
});

test("as 8 competências distintas viram 8 skills, mais o contrato de execução", () => {
  assert.equal(groupBySkill(manifests).length, 8);
  assert.equal(skills.length, 9);
  assert.ok(skills.some((skill) => skill.name === "iffar-execucao-institucional"));
});

test("o conteúdo em disco está em dia com os manifestos", () => {
  // Se falhar: rode `npm run generate:skills`.
  for (const skill of skills) {
    const path = join(SKILLS, skill.name, "SKILL.md");
    assert.equal(readFileSync(path, "utf8"), skill.content, `skill defasada: ${skill.name}`);
  }
  assert.deepEqual(
    readdirSync(SKILLS).sort(),
    skills.map((skill) => skill.name).sort(),
    "há skill em disco que o gerador não produz mais",
  );
});

test("toda skill tem front matter no padrão agentskills.io", () => {
  for (const skill of skills) {
    const lines = skill.content.split("\n");
    assert.equal(lines[0], "---", `${skill.name}: sem front matter`);
    const closing = lines.indexOf("---", 1);
    assert.ok(closing > 1, `${skill.name}: front matter não fechado`);
    const header = lines.slice(1, closing).join("\n");
    assert.match(header, /^name: /m, `${skill.name}: sem 'name'`);
    assert.match(header, /^description: /m, `${skill.name}: sem 'description'`);
    assert.ok(header.includes(skill.name), `${skill.name}: 'name' divergente`);
  }
});

test("as limitações normativas sobrevivem à conversão", () => {
  const required = [...new Set(manifests.flatMap((manifest) => manifest.limitations))];
  assert.equal(required.length, 3);
  for (const skill of skills) {
    for (const limitation of required) {
      assert.ok(
        skill.content.includes(limitation),
        `${skill.name} perdeu a limitação: ${limitation}`,
      );
    }
  }
});

test("o contrato de execução preserva os portões do produto", () => {
  const contract = skills.find((skill) => skill.name === "iffar-execucao-institucional");
  // Uma skill que descrevesse o runbook sem o gate humano e sem a verificação
  // de artefatos seria uma degradação do produto, não um porte.
  for (const gate of ["awaiting_human_approval", "SHA-256", "aprovação humana", "triagem"]) {
    assert.ok(contract.content.includes(gate), `contrato sem o portão: ${gate}`);
  }
});

test("cada skill aponta a procedência normativa", () => {
  const source = manifests[0].normativeSource.title;
  for (const skill of skills) {
    assert.ok(skill.content.includes(source), `${skill.name} não cita a Portaria`);
  }
});
