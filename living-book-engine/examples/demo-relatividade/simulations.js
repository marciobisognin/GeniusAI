// =========================================================================
// RELATIVISTIC 3D APPARATUS BUILDERS (A DANÇA DO ESPAÇO-TEMPO)
// =========================================================================

// --- LIÇÃO 1: O Interferômetro de Michelson-Morley ---
function buildLesson1(s, t = {}) {
  const pen = new ks({ speed: 320, gap: 0.016, max: 0.42 });
  const l = new R(s.ink({ widthPx: 1.4 }));
  const matPaper = s.paper({ hatchA: [0.6, 0.5, 0.6], hatchB: [0.9, 0.2, -0.4], spacing: 1.8, seed: 101 });
  
  // Base: Heavy Stone Table (Laje de Arenito)
  drawBox(s, pen, l, { x0: 25, x1: 145, y0: 2, y1: 22, z0: -130, z1: -60 }, { mat: matPaper, width: 1.2 });
  
  // Central Beam Splitter Mirror (Espelho Divisor a 45 graus)
  const cx = 85, cy = 45, cz = -95;
  drawBox(s, pen, l, { x0: cx - 4, x1: cx + 4, y0: cy - 14, y1: cy + 14, z0: cz - 4, z1: cz + 4 }, { mat: matPaper, width: 1.5 });
  
  // Arm 1 End Mirror (Braço Longitudinal)
  drawBox(s, pen, l, { x0: 135, x1: 140, y0: cy - 12, y1: cy + 12, z0: cz - 12, z1: cz + 12 }, { mat: matPaper, width: 1.4 });
  
  // Arm 2 End Mirror (Braço Transversal)
  drawBox(s, pen, l, { x0: cx - 12, x1: cx + 12, y0: cy - 12, y1: cy + 12, z0: -128, z1: -124 }, { mat: matPaper, width: 1.4 });
  
  // Light Source Laser / Emissor
  drawBox(s, pen, l, { x0: 30, x1: 42, y0: cy - 8, y1: cy + 8, z0: cz - 8, z1: cz + 8 }, { mat: matPaper, width: 1.3 });
  
  // Detector Plate
  drawBox(s, pen, l, { x0: cx - 10, x1: cx + 10, y0: cy - 10, y1: cy + 10, z0: -66, z1: -62 }, { mat: matPaper, width: 1.4 });
  l.build();
  s.addLines(l);
  
  // Orthogonal Light Beam Tubes (Horizontal & Vertical Arms)
  const beamLaser = new xe([
    m(42, cy, cz),
    m(cx, cy, cz),
    m(135, cy, cz)
  ], { pathway: "light", beads: 14, radial: 8 });
  s.group.add(beamLaser.mesh);
  
  const beamTransverse = new xe([
    m(cx, cy, cz),
    m(cx, cy, -124)
  ], { pathway: "light", beads: 10, radial: 8 });
  s.group.add(beamTransverse.mesh);
  
  const beamDetector = new xe([
    m(cx, cy, cz),
    m(cx, cy, -66)
  ], { pathway: "light", beads: 10, radial: 8 });
  s.group.add(beamDetector.mesh);

  const state = { mode: 0, power: 0.85, rotationAngle: 0, interacted: false };
  let timeClock = 0;

  return {
    state,
    glowObjects: () => [...beamLaser.glowObjects, ...beamTransverse.glowObjects, ...beamDetector.glowObjects],
    lightSources: () => [beamLaser, beamTransverse],
    targets: () => [beamLaser.tube, beamDetector.tube],
    press(obj) {
      state.interacted = true;
      state.mode = (state.mode + 1) % 3;
      state.power = state.mode === 0 ? 0.4 : state.mode === 1 ? 0.85 : 1.0;
      beamLaser.setPower(state.power);
      beamTransverse.setPower(state.power);
      beamDetector.setPower(state.power);
      return "tap";
    },
    hover() {},
    cursor: () => "pointer",
    onLive() {
      beamLaser.setPower(0.85);
      beamTransverse.setPower(0.85);
      beamDetector.setPower(0.85);
    },
    challenge: () => ({ met: state.interacted && state.power >= 0.85 }),
    margin: () => [
      { text: `Velocidade c: 299.792 km/s` },
      { text: `Deslocamento Franjas: 0.000` },
      { text: `Vento de Éter: NULO` }
    ],
    update(dt, camera, isLive, opts = {}) {
      timeClock += dt;
      beamLaser.update(dt);
      beamTransverse.update(dt);
      beamDetector.update(dt);
      if (isLive) {
        beamDetector.mesh.position.y = Math.sin(timeClock * 3.5) * 0.4;
      }
    }
  };
}


// --- LIÇÃO 2: O Relógio de Luz & Dilatação Temporal ---
function buildLesson2(s, t = {}) {
  const pen = new ks({ speed: 300, gap: 0.016, max: 0.42 });
  const l = new R(s.ink({ widthPx: 1.35 }));
  const matPaper = s.paper({ hatchA: [0.5, 0.6, 0.4], hatchB: [0.8, 0.3, -0.3], spacing: 1.6, seed: 102 });
  
  // Upper Mirror Frame
  const cx = 85, cz = -95;
  drawBox(s, pen, l, { x0: 45, x1: 125, y0: 82, y1: 90, z0: cz - 12, z1: cz + 12 }, { mat: matPaper, width: 1.3 });
  
  // Lower Mirror Frame
  drawBox(s, pen, l, { x0: 45, x1: 125, y0: 10, y1: 18, z0: cz - 12, z1: cz + 12 }, { mat: matPaper, width: 1.3 });
  
  // Support Rails & Ticks
  for (let x = 55; x <= 115; x += 30) {
    l.add([m(x, 18, cz), m(x, 82, cz)], { width: 0.8 });
  }
  l.build();
  s.addLines(l);
  
  // Vertical Photon Pulse Tube
  const photonVertical = new xe([
    m(65, 18, cz),
    m(65, 82, cz)
  ], { pathway: "electrical", beads: 12, radial: 8 });
  s.group.add(photonVertical.mesh);
  
  // Diagonal Hypotenuse Path (Moving Frame)
  const photonDiagonal = new xe([
    m(50, 18, cz),
    m(85, 82, cz),
    m(120, 18, cz)
  ], { pathway: "light", beads: 16, radial: 8 });
  s.group.add(photonDiagonal.mesh);

  const state = { speedLevel: 1, vOverC: 0.6, gamma: 1.25, interacted: false };
  let timeClock = 0;

  return {
    state,
    glowObjects: () => [...photonVertical.glowObjects, ...photonDiagonal.glowObjects],
    lightSources: () => [photonDiagonal],
    targets: () => [photonDiagonal.tube, photonVertical.tube],
    press() {
      state.interacted = true;
      state.speedLevel = (state.speedLevel + 1) % 4;
      const speeds = [0.0, 0.6, 0.866, 0.99];
      state.vOverC = speeds[state.speedLevel];
      state.gamma = 1 / Math.sqrt(Math.max(0.01, 1 - state.vOverC * state.vOverC));
      photonDiagonal.setPower(Math.min(1.0, 0.4 + state.vOverC * 0.6));
      return "tap";
    },
    hover() {},
    cursor: () => "pointer",
    onLive() {
      photonVertical.setPower(0.6);
      photonDiagonal.setPower(0.85);
    },
    challenge: () => ({ met: state.interacted && state.gamma >= 2.0 }),
    margin: () => [
      { text: `Velocidade v: ${(state.vOverC * 100).toFixed(1)}% c` },
      { text: `Fator γ (Gama): ${state.gamma.toFixed(2)}x` },
      { text: `Dilatação: Δt' = ${state.gamma.toFixed(2)} · Δt` }
    ],
    update(dt, camera, isLive, opts = {}) {
      timeClock += dt;
      photonVertical.update(dt);
      photonDiagonal.update(dt);
      if (isLive) {
        const pulse = (Math.sin(timeClock * (2.0 + state.vOverC * 4.0)) + 1) * 0.5;
        photonVertical.mesh.position.y = pulse * 1.5;
      }
    }
  };
}


// --- LIÇÃO 3: Contração de Lorentz ---
function buildLesson3(s, t = {}) {
  const pen = new ks({ speed: 320, gap: 0.016, max: 0.42 });
  const l = new R(s.ink({ widthPx: 1.4 }));
  const matPaper = s.paper({ hatchA: [0.7, 0.4, 0.3], hatchB: [0.3, 0.8, -0.4], spacing: 1.5, seed: 103 });
  
  // Relativistic Spacecraft Fuselage
  const cx = 85, cy = 45, cz = -95;
  drawBox(s, pen, l, { x0: 40, x1: 130, y0: 35, y1: 55, z0: cz - 15, z1: cz + 15 }, { mat: matPaper, width: 1.3 });
  
  // Rocket Cockpit Nose Cone (Perfil Triangular)
  l.add([
    m(130, 35, cz - 15), m(155, 45, cz), m(130, 55, cz - 15),
    m(130, 35, cz + 15), m(155, 45, cz), m(130, 55, cz + 15)
  ], { closed: true, width: 1.5 });
  
  // Measurement Grid Caliper / Régua de Laboratório
  l.add([m(30, 20, cz), m(160, 20, cz)], { width: 1.5 });
  for (let x = 30; x <= 160; x += 13) {
    l.add([m(x, 16, cz), m(x, 24, cz)], { width: 0.9 });
  }
  l.build();
  s.addLines(l);
  
  // Relativistic Thrust Vector / Jato de Propulsão
  const thrustBeam = new xe([
    m(40, 45, cz),
    m(15, 45, cz),
    m(-5, 45, cz)
  ], { pathway: "light", beads: 14, radial: 8 });
  s.group.add(thrustBeam.mesh);

  const state = { step: 1, contractionFactor: 0.7, interacted: false };
  let timeClock = 0;

  return {
    state,
    glowObjects: () => thrustBeam.glowObjects,
    lightSources: () => [thrustBeam],
    targets: () => [thrustBeam.tube],
    press() {
      state.interacted = true;
      state.step = (state.step + 1) % 3;
      state.contractionFactor = state.step === 0 ? 1.0 : state.step === 1 ? 0.7 : 0.5;
      thrustBeam.setPower(state.step === 0 ? 0.2 : state.step === 1 ? 0.8 : 1.0);
      return "tap";
    },
    hover() {},
    cursor: () => "pointer",
    onLive() {
      thrustBeam.setPower(0.8);
    },
    challenge: () => ({ met: state.interacted && state.contractionFactor <= 0.5 }),
    margin: () => [
      { text: `Comprimento L0: 100 m` },
      { text: `Comprimento L': ${(100 * state.contractionFactor).toFixed(1)} m` },
      { text: `Contração: ${(1 - state.contractionFactor) * 100}%` }
    ],
    update(dt, camera, isLive, opts = {}) {
      timeClock += dt;
      thrustBeam.update(dt);
      if (isLive) {
        thrustBeam.mesh.scale.x = 0.8 + Math.sin(timeClock * 6.0) * 0.2;
      }
    }
  };
}


// --- LIÇÃO 4: E = mc² (Conversão Massa-Energia) ---
function buildLesson4(s, t = {}) {
  const pen = new ks({ speed: 310, gap: 0.016, max: 0.42 });
  const l = new R(s.ink({ widthPx: 1.4 }));
  const matPaper = s.paper({ hatchA: [0.6, 0.4, 0.5], hatchB: [0.8, 0.5, -0.3], spacing: 1.7, seed: 104 });
  
  // Reaction Core Chamber Box
  const cx = 85, cy = 45, cz = -95;
  drawBox(s, pen, l, { x0: 55, x1: 115, y0: 15, y1: 75, z0: cz - 30, z1: cz + 30 }, { mat: matPaper, width: 1.3 });
  
  // Heavy Nucleus Target
  const nucleus = Os(s, pen, { r: 14, segments: 24, cx, cy, cz, mat: matPaper });
  l.build();
  s.addLines(l);
  
  // Radiating Energy Flow Tubes (Gama Ray Emission)
  const rayLeft = new xe([
    m(cx, cy, cz),
    m(cx - 55, cy + 25, cz)
  ], { pathway: "light", beads: 10, radial: 8 });
  s.group.add(rayLeft.mesh);
  
  const rayRight = new xe([
    m(cx, cy, cz),
    m(cx + 55, cy - 20, cz)
  ], { pathway: "light", beads: 10, radial: 8 });
  s.group.add(rayRight.mesh);

  const state = { active: false, powerLevel: 0.5, interacted: false };
  let timeClock = 0;

  return {
    state,
    glowObjects: () => [...rayLeft.glowObjects, ...rayRight.glowObjects],
    lightSources: () => [rayLeft, rayRight],
    targets: () => [nucleus.hit],
    press() {
      state.interacted = true;
      state.active = !state.active;
      state.powerLevel = state.active ? 1.0 : 0.3;
      rayLeft.setPower(state.powerLevel);
      rayRight.setPower(state.powerLevel);
      return "tap";
    },
    hover() {},
    cursor: () => "pointer",
    onLive() {
      rayLeft.setPower(0.5);
      rayRight.setPower(0.5);
    },
    challenge: () => ({ met: state.interacted && state.powerLevel >= 0.9 }),
    margin: () => [
      { text: `Massa m0: 1.000 g` },
      { text: `c²: 8.987 × 10¹⁶ m²/s²` },
      { text: `Energia E: 8.987 × 10¹³ J` }
    ],
    update(dt, camera, isLive, opts = {}) {
      timeClock += dt;
      rayLeft.update(dt);
      rayRight.update(dt);
      if (isLive && state.active) {
        nucleus.mesh.scale.setScalar(1.0 + Math.sin(timeClock * 8.0) * 0.08);
      }
    }
  };
}


// --- LIÇÃO 5: A Curvatura do Espaço-Tempo ---
function buildLesson5(s, t = {}) {
  const pen = new ks({ speed: 320, gap: 0.016, max: 0.42 });
  const l = new R(s.ink({ widthPx: 1.4 }));
  const matPaper = s.paper({ hatchA: [0.7, 0.4, 0.5], hatchB: [0.3, 0.8, -0.4], spacing: 1.8, seed: 105 });
  
  const cx = 85, cy = 35, cz = -95;
  
  // Concentric Curvature Ring Funnel
  for (let r = 16; r <= 52; r += 12) {
    const pts = [];
    const depth = -Math.exp(-r / 25) * 22;
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push(m(cx + Math.cos(a) * r, cy + depth, cz + Math.sin(a) * r));
    }
    l.add(pts, { closed: true, width: 1.2 });
  }
  
  // Radial Geodesic Crosslines
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pts = [];
    for (let r = 16; r <= 56; r += 8) {
      const depth = -Math.exp(-r / 25) * 22;
      pts.push(m(cx + Math.cos(a) * r, cy + depth, cz + Math.sin(a) * r));
    }
    l.add(pts, { width: 0.9 });
  }
  
  // Central Massive Body (Estrela / Sol)
  const sunSphere = Os(s, pen, { r: 12, segments: 24, cx, cy: cy - 14, cz, mat: matPaper });
  l.build();
  s.addLines(l);
  
  // Orbiting Geodesic Path Tube
  const orbitCurve = [];
  const rOrbit = 36;
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const depth = -Math.exp(-rOrbit / 25) * 22;
    orbitCurve.push(m(cx + Math.cos(a) * rOrbit, cy + depth + 1.2, cz + Math.sin(a) * rOrbit));
  }
  const orbitTube = new xe(orbitCurve, { pathway: "light", beads: 18, radial: 8 });
  s.group.add(orbitTube.mesh);

  const state = { curvatureLevel: 1, mass: 1.0, interacted: false };
  let timeClock = 0;

  return {
    state,
    glowObjects: () => orbitTube.glowObjects,
    lightSources: () => [orbitTube],
    targets: () => [sunSphere.hit],
    press() {
      state.interacted = true;
      state.curvatureLevel = (state.curvatureLevel + 1) % 3;
      state.mass = state.curvatureLevel === 0 ? 0.5 : state.curvatureLevel === 1 ? 1.0 : 2.2;
      orbitTube.setPower(state.curvatureLevel === 0 ? 0.4 : state.curvatureLevel === 1 ? 0.85 : 1.0);
      return "tap";
    },
    hover() {},
    cursor: () => "pointer",
    onLive() {
      orbitTube.setPower(0.85);
    },
    challenge: () => ({ met: state.interacted && state.mass >= 1.0 }),
    margin: () => [
      { text: `Massa M: ${state.mass.toFixed(1)} M☉` },
      { text: `Desvio Geodésico: ${(1.75 * state.mass).toFixed(2)}"` },
      { text: `Curvatura Gμν: Ativa` }
    ],
    update(dt, camera, isLive, opts = {}) {
      timeClock += dt;
      orbitTube.update(dt);
      if (isLive) {
        sunSphere.mesh.scale.setScalar(1.0 + Math.sin(timeClock * 2.0) * 0.04);
      }
    }
  };
}
