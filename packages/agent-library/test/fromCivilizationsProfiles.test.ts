import { describe, expect, it } from "vitest";
import { importCivilizationsProfiles } from "../src/fromCivilizationsProfiles.js";

const SHARED_FIXTURE = `
export const CIV_IDS = ["rome", "egypt"] as const;

export const DEFAULT_CIVILIZATIONS: Record<string, unknown> = {
  rome: {
    id: "rome",
    name: "Roma",
    adjective: "romana",
    color: "#c0392b",
    leaderName: "César",
    personality: ["Expansionista", "militarista"],
    priorities: ["military", "economy"],
    riskTolerance: 0.7,
    diplomacyStyle: "aggressive",
    startingTechnologies: [],
    startingResources: { food: 5, gold: 60, science: 0 },
  },
  egypt: {
    id: "egypt",
    name: "Egito",
    adjective: "egípcia",
    color: "#d4a72c",
    leaderName: "Cleópatra",
    personality: ["Defensiva", "comercial"],
    priorities: ["economy", "diplomacy"],
    riskTolerance: 0.4,
    diplomacyStyle: "balanced",
    startingTechnologies: [],
    startingResources: { food: 5, gold: 60, science: 0 },
    model: "gpt-4o-mini",
  },
};
`;

describe("importCivilizationsProfiles — cada civilização vira o agente do líder", () => {
  it("mapeia as duas civilizações para agentes do canon", () => {
    const agents = importCivilizationsProfiles(SHARED_FIXTURE);
    expect(agents).toHaveLength(2);

    const cesar = agents.find((a) => a.id === "rome");
    expect(cesar).toMatchObject({ nome: "César", area: "Roma", origem: "importado" });
    expect(cesar?.skills).toEqual(["military", "economy"]);
    expect(cesar?.descricao).toContain("aggressive");

    const cleopatra = agents.find((a) => a.id === "egypt");
    expect(cleopatra?.modelPolicy).toEqual({ default: "gpt-4o-mini" });
  });
});
